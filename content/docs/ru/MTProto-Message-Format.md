---
title: "Формат сообщения MTProto"

---
# Формат сообщения MTProto

## Транспортный уровень: IntermediateTransport

GoyGram использует промежуточный транспорт MTProto:


```
[length: 4 bytes LE] [payload: length bytes]
```



```python
@dataclass
class IntermediateTransport:
    def pack(self, payload: bytes) -> bytes:
        return len(payload).to_bytes(4, 'little') + payload
```


При подключении клиент отправляет маркер `\xee\xee\xee\xee` (сокращенный транспортный тег), но фактически используется промежуточный кадр.

## Структура зашифрованного сообщения

После установки `auth_key` (через обмен ключами DH) все сообщения шифруются:


```
[auth_key_id: 8 bytes] [msg_key: 16 bytes] [encrypted_data: N bytes]
```


### auth_key_id

Младшие 8 байтов SHA1 `auth_key`:


```python
auth_key_id = sha1(self.auth_key).digest()[-8:]
```


### msg_key


```python
msg_key_large = sha256(auth_key[88:120] + plaintext_with_padding).digest()
msg_key = msg_key_large[8:24]  # 16 bytes
```


Где `plaintext_with_padding` — это сообщение со случайным заполнением 12–96 байт.

### зашифрованные_данные

Зашифровано с помощью AES-256-IGE. Ключи, полученные через `kdf_msg()`:


```python
def kdf_msg(auth_key, msg_key, to_server=True):
    x = 0 if to_server else 8
    a = sha256(msg_key + auth_key[x:x+36]).digest()
    b = sha256(auth_key[40+x:76+x] + msg_key).digest()
    aes_key = a[:8] + b[8:24] + a[24:32]    # 32 bytes
    aes_iv  = b[:8] + a[8:24] + b[24:32]    # 32 bytes
    return aes_key, aes_iv
```


## Расшифрованная структура полезной нагрузки


```
[salt: 8 bytes] [session_id: 8 bytes] [msg_id: 8 bytes LE]
[seq_no: 4 bytes LE] [body_length: 4 bytes LE] [body: body_length bytes]
```


### Сборка в send()


```python
m = b''
m += self.server_salt + self.session_id
m += msg_id.to_bytes(8, 'little', signed=True)
m += seq_no.to_bytes(4, 'little', signed=True)
m += len(body).to_bytes(4, 'little', signed=True) + body
pad = secrets.token_bytes((16 - (len(m) + 12) % 16) % 16 + 12)
```


### Разбор в _handle_encrypted_packet()


```python
r = Reader(dec)
_salt = r.take(8)
_sid = r.take(8)
_msg_id = r.i64()
_seq = r.i32()
ln = r.i32()
msg = r.take(ln)  # body with TL schema
```


## Тело: схема TL

Тело сообщения кодируется в двоичном формате TL (Type Language):

- **Конструктор**: 4 байта LE — идентификатор типа (например, `0xda9b0d0d` для `invokeWithLayer`).
- **Поля**: сериализованы по типам (`int`=4 LE, `long`=8 LE, `string`/`bytes`=TL-байты, `Vector`=0x1cb5c415 + количество + элементы)

## Незашифрованные сообщения (до DH)


```
[auth_key_id=0: 8 bytes] [msg_id: 8 bytes] [body_length: 4 bytes] [body: body_length bytes]
```


Используется для `req_pq_multi`, `req_DH_params`, `set_client_DH_params`.