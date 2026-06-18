---
title: "MTCodec – TL-кодек"

---
# MTCodec – TL-кодек

Класс `MTCodec` (`goygram/vendor/tl_core.py`) — это рукописный сериализатор языка типов (TL) для MTProto. Он строит каждое сообщение TL побайтно, используя упаковку структур и специальные функции кодирования.

## Дизайн

`MTCodec` — это **плоский класс** — без наследования и уровней абстракции. Каждый метод MTProto имеет специальный метод, который создает байты TL. Идентификаторы конструкторов являются константами уровня класса.

## Реестр идентификаторов конструктора (частичный)


```python
class MTCodec:
    REQ_PQ_MULTI          = 0xbe7e8ef1
    REQ_DH_PARAMS         = 0xd712e4be
    SET_CLIENT_DH_PARAMS  = 0xf5045f1f
    AUTH_SEND_CODE        = 0xa677244f
    AUTH_SIGN_IN          = 0x8d52a951
    AUTH_CHECK_PASSWORD   = 0xd18b4d16
    MESSAGES_SEND_MESSAGE = 0xfe05dc9a
    MESSAGES_GET_DIALOGS  = 0xa0f4cb4f
    MESSAGES_GET_HISTORY  = 0x4423e6c5
    # ... 40+ more constructor IDs
    LAYER = 214
```


## Примитивное кодирование TL


```python
def i32(v): return struct.pack('<i', v)   # 4 bytes, signed LE
def u32(v): return struct.pack('<I', v)   # 4 bytes, unsigned LE
def i64(v): return struct.pack('<q', v)   # 8 bytes, signed LE

def tl_bytes(b):                          # TL string/bytes
    n = len(b)
    if n < 254:
        x = bytes([n]) + b                # 1-byte length
    else:
        x = b'\xfe' + n.to_bytes(3, 'little') + b  # 3-byte length
    return x + b'\x00' * ((4 - len(x) % 4) % 4)     # pad to 4 bytes

def tl_str(s): return tl_bytes(s.encode())
```


## Информация об устройстве


```python
def __init__(self, app_name=None, app_version=None, device_model=None,
             system_version=None, system_lang_code="en",
             lang_pack="", lang_code="en"):
    self.app_name = app_name or "GoyGram"
    self.app_version = app_version or f"GoyGram {pkg_version('goygram')}"
    self.device_model = device_model or f"{platform.system()} {platform.machine()}"
    self.system_version = system_version or f"{platform.system()} {platform.release()}"
```


## Обертка initConnection

Первое сообщение после обмена ключами DH должно быть обернуто `invokeWithLayer` и `initConnection`:


```python
def wrap_init(self, api_id, req):
    init = (
        u32(0xc1cd5ea9) +    # initConnection
        i32(0) +              # flags
        i32(api_id) +
        tl_str(self.device_model) +
        tl_str(self.system_version) +
        tl_str(self.app_version) +
        tl_str(self.system_lang_code) +
        tl_str(self.lang_pack) +
        tl_str(self.lang_code) +
        req                    # the actual request
    )
    return u32(0xda9b0d0d) + i32(self.LAYER) + init
```


Структура TL:

```
invokeWithLayer#da9b0d0d {layer:214}
  initConnection#c1cd5ea9 {flags:0, api_id, device_model, system_version,
                           app_version, lang_code, lang_pack, lang_code}
    <actual request>
```


## Построители сообщений

Каждое действие MTProto имеет специальный метод построения. Пример — отправить сообщение:


```python
def messages_send_message(self, *, peer, message, random_id,
                          reply_to=None, no_webpage=False, entities=None):
    flags = 0
    if reply_to is not None:     flags |= 1 << 0
    if no_webpage:               flags |= 1 << 1
    if entities:                 flags |= 1 << 3

    req = u32(0xfe05dc9a) + i32(flags) + peer
    if reply_to is not None:
        req += reply_to
    req += tl_str(message) + i64(random_id)
    if entities:
        req += self._encode_entities(entities)
    return req
```


## Кодировка объекта


```python
def _encode_entities(self, entities):
    raw = u32(0x1cb5c415) + i32(len(entities))  # Vector header
    for offset, length, tp, url in entities:
        if tp == 7 and url:     # text_link
            raw += u32(0x76a6d327) + i32(offset) + i32(length) + tl_str(url)
        elif tp == 1:           # bold
            raw += u32(0xbd610bc9) + i32(offset) + i32(length)
        elif tp == 2:           # italic
            raw += u32(0x826f8b60) + i32(offset) + i32(length)
        # ... etc for each entity type
```


## Одноранговые конструкторы


```python
def input_peer_self(self):     return u32(0x7da07ec9)
def input_peer_user(self, uid, hash):  return u32(0xdde8a54c) + i64(uid) + i64(hash)
def input_peer_chat(self, cid):        return u32(0x35a95cb9) + i64(cid)
def input_peer_channel(self, cid, h):  return u32(0x27bcbbfc) + i64(cid) + i64(h)
def input_user(self, uid, hash):       return u32(0xf21158c6) + i64(uid) + i64(hash)
def input_user_self(self):             return u32(0x6727bce0)
```


## Вспомогательные функции


```python
def factorize(pq):             # Pollard's Rho factorization
def kdf(new_nonce, srv_nonce): # Key derivation for DH temp key
def kdf_msg(auth_key, msg_key):# Key derivation for message encryption
def rsa_pad_encrypt(data, n, e):# RSA encryption with SHA1 padding
```


## Читатель (TL Parser)


```python
class Reader:
    def __init__(self, b): self.b = b; self.p = 0
    def take(self, n): ...     # read n bytes, advance pointer
    def u32(self): ...         # read unsigned 32-bit LE
    def i32(self): ...         # read signed 32-bit LE
    def i64(self): ...         # read signed 64-bit LE
    def tl_bytes(self): ...    # read TL string/bytes (with length prefix)
```


Используется для анализа ответов сервера и результатов RPC.