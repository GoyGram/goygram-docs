---
---

# МТПрото Транспорт

`MTNet` (`goygram/vendor/mtproto.py`) — это необработанный транспорт TCP MTProto. Он обрабатывает все: от подключения к сокету до обмена ключами DH, шифрования пакетов AES-IGE и анализа сообщений TL. Это самый сложный компонент в GoyGram.

## Архитектура


```python
class MTNet:
    def __init__(self, host, port, bus, key=None, iv=None, *, proxy=None,
                 app_name=None, app_version=None, device_model=None,
                 system_version=None, system_lang_code="en",
                 lang_pack="", lang_code="en"):
        self.host = host              # MTProto server host
        self.port = port              # MTProto server port (443)
        self.bus = bus                # shared event bus
        self.rd = None                # asyncio.StreamReader
        self.wr = None                # asyncio.StreamWriter
        self.buf = bytearray()        # receive buffer
        self.stop_ev = asyncio.Event()
        self.seq = 0                  # message sequence number
        self.pending = {}             # {msg_id: (Future, request_obj)}
        self.auth_key = None          # 256-byte shared key (post-DH)
        self.server_salt = b'\x00'*8  # 8-byte server salt
        self.session_id = secrets.token_bytes(8)
        self.auth_ready = asyncio.Event()
        self.qr_update_ev = asyncio.Event()  # signals QR login updates
        self._init_done = False       # has initConnection been sent?
        self._api_id = None
```


## Жизненный цикл соединения

### Загрузка (TCP Connect + сокращенный тег)


```python
async def boot(self):
    if self.rd and self.wr and not self.wr.is_closing():
        return  # already connected

    px = self.proxy_cfg()
    if px is not None:
        self.rd, self.wr = await self.open_via_proxy(px)
    else:
        self.rd, self.wr = await asyncio.open_connection(self.host, self.port)

    # Send transport abridged tag
    self.wr.write(b"\xee\xee\xee\xee")
    await self.wr.drain()
    self.wrote_tag = True
```


4-байтовый `0xEEEEEEEE` — это «промежуточный» транспортный маркер Telegram. Он сообщает серверу, что этот клиент использует формат кадра с префиксом длины.

### Выключение


```python
async def close(self):
    if self.wr:
        self.wr.close()
        await self.wr.wait_closed()
        self.wr = None
        self.rd = None
```


## Формирование пакетов: промежуточный транспорт

MTProto использует кадрирование с **префиксом длины** через класс `IntermediateTransport`:


```python
class IntermediateTransport:
    def pack(self, payload: bytes) -> bytes:
        return len(payload).to_bytes(4, 'little') + payload
```


Каждый пакет в проводе:

```
┌────────────────────┬──────────────────────┐
│ length (4 bytes LE)│     payload          │
└────────────────────┴──────────────────────┘
```


### Буфер приема и разделение кадров


```python
def cut(self) -> list[bytes]:
    out = []
    i = 0
    raw = bytes(self.buf)
    while i < len(raw):
        if i + 4 > len(raw):
            break
        ln = int.from_bytes(raw[i:i+4], 'little')
        i += 4
        if i + ln > len(raw):
            i -= 4  # incomplete frame — wait for more data
            break
        out.append(raw[i:i+ln])
        i += ln
    self.buf[:] = raw[i:]  # keep remainder
    return out
```


Фреймы разделяются на стороне Python. Расширение Rust предоставляет `cut()` в качестве альтернативы, но оно не используется в текущем коде.

## Цикл чтения


```python
async def read_packet(self) -> bytes:
    while True:
        for p in self.cut():
            return p  # found a complete frame
        raw = await self.rd.read(65536)
        if not raw:
            self._log_socket_close()
            raise ConnectionError('mt socket closed')
        self.buf.extend(raw)
```


Считывает до 64 КБ на системный вызов, накапливает в буфере, разбивает кадры по завершении.

Если сокет неожиданно закрывается:

```python
def _log_socket_close(self):
    if self.buf:
        log.debug(f"[RX] Socket closed. Left in buffer: {self.buf.hex()}")
        if len(self.buf) >= 4:
            err = int.from_bytes(self.buf[:4], 'little', signed=True)
            log.debug(f"[RX] Possible Telegram int32 error: {err}")
```


## Незашифрованные сообщения (Pre-DH)

До завершения обмена ключами DH все сообщения отправляются в незашифрованном виде:


```python
async def invoke_unencrypted(self, body: bytes) -> bytes:
    await self.boot()
    pkt = self.pack(MTMessage.unencrypted(self.msg_ids.next(), body))
    self.wr.write(pkt)
    await self.wr.drain()
    resp = await self.read_packet()
    return resp
```


Незашифрованный формат сообщения:

```
auth_key_id: 0 (i64)
message_id: i64
message_length: i32
body: bytes
```


## Зашифрованные сообщения (Post-DH)

После обмена DH каждое сообщение шифруется с помощью AES-256-IGE:


```python
async def send(self, obj, req_msg_id=None):
    await self.ensure_auth_key()  # blocks until DH complete

    body = self._build_body(act, obj)

    # Wrap with initConnection on first message
    if not self._init_done and self._api_id:
        body = self.codec.wrap_init(self._api_id, body)
        self._init_done = True

    # Build MTProto message
    msg_id = req_msg_id or self.msg_ids.next()
    self.seq += 1
    seq_no = self.seq * 2 - 1

    m = b''
    m += self.server_salt                  # 8 bytes
    m += self.session_id                   # 8 bytes
    m += msg_id.to_bytes(8, 'little', signed=True)  # 8 bytes
    m += seq_no.to_bytes(4, 'little', signed=True)  # 4 bytes
    m += len(body).to_bytes(4, 'little', signed=True) # 4 bytes
    m += body

    # Pad to 16-byte boundary + 12-27 random padding bytes
    pad = secrets.token_bytes((16 - (len(m) + 12) % 16) % 16 + 12)

    # Compute msg_key
    msg_key_large = sha256(self.auth_key[88:120] + m + pad).digest()
    msg_key = msg_key_large[8:24]  # middle 16 bytes

    # AES-256-IGE encrypt
    aes_key, aes_iv = kdf_msg(self.auth_key, msg_key, True)
    enc = bytes(rx.aes_ige_enc_raw(m + pad, aes_key, aes_iv))

    # Build final packet
    auth_key_id = sha1(self.auth_key).digest()[-8:]
    pkt = self.pack(auth_key_id + msg_key + enc)

    self.wr.write(pkt)
    await self.wr.drain()
```


## Запрос-ответ RPC

Все вызовы RPC проходят через `_rpc_call`:


```python
async def _rpc_call(self, act, **kw):
    fut = loop.create_future()
    req_msg_id = self.msg_ids.next()
    obj = {'act': act}
    obj.update({k: v for k, v in kw.items() if v is not None})
    self.pending[req_msg_id] = (fut, obj)
    await self.send(obj, req_msg_id=req_msg_id)
    return await asyncio.wait_for(fut, timeout=30.0)
```


Соответствие ответа:
1. Отправьте сообщение с помощью `msg_id`. 
2. Сохраните `(Future, request_dict)` в `self.pending[msg_id]`.
3. Когда приходит зашифрованный ответ, `_handle_encrypted_packet` извлекает `rpc_result` (`0xf35c6d01`)
4. `req_msg_id` ответа сопоставляется с `self.pending`.
5. Будущее определяется с анализируемым результатом.

### Восстановление плохой соли сервера

Если сервер отправляет `bad_server_salt` (`0xedab447b`):


```python
if cid == 0xedab447b:
    bad_msg_id = rm.i64()
    new_salt = int.from_bytes(rm.take(8), 'little', signed=False)
    self.server_salt = new_salt.to_bytes(8, 'little')
    self._init_done = False

    # Resend the original request
    entry = self.pending.pop(bad_msg_id, None)
    if entry is not None:
        fut, saved_obj = entry
        new_msg_id = self.msg_ids.next()
        self.pending[new_msg_id] = (fut, saved_obj)
        asyncio.create_task(self._resend(new_msg_id, saved_obj))
```


При этом соль обновляется, помечается `_init_done = False` для повторной отправки `initConnection`, а затем автоматически повторно отправляется исходный запрос с новым `msg_id`. Полностью прозрачен для звонящего.

## Цикл вращения (зашифрованное чтение)


```python
async def spin(self):
    await self.auth_ready.wait()  # block until DH exchange completes
    while not self.stop_ev.is_set():
        pkt = await self.read_packet()
        self._handle_encrypted_packet(pkt)
```


Если `ConnectionError` возникает, все ожидающие фьючерсы терпят неудачу, и ошибка распространяется вверх (закрытие задачи MTProto).

## Генерация идентификатора сообщения


```python
class MsgIdGen:
    def next(self):
        now = int(time.time())
        self.offset = self.offset + 4 if now == self.last_time else 0
        self.last_time = now
        return (now * (2**32)) + self.offset
```


Идентификаторы сообщений кодируют метку времени (старшие биты) и монотонно увеличивающийся счетчик (младшие биты, увеличиваются на 4). Это стандартный формат MTProto msg_id — Telegram требует монотонно увеличивающегося идентификатора.