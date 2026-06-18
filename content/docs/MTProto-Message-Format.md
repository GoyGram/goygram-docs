# MTProto Message Format

## Transport Layer: IntermediateTransport

GoyGram uses MTProto's Intermediate transport:

```
[length: 4 bytes LE] [payload: length bytes]
```

```python
@dataclass
class IntermediateTransport:
    def pack(self, payload: bytes) -> bytes:
        return len(payload).to_bytes(4, 'little') + payload
```

On connection, the client sends the marker `\xee\xee\xee\xee` (abridged transport tag), but Intermediate framing is actually used.

## Encrypted Message Structure

After establishing `auth_key` (via DH key exchange), all messages are encrypted:

```
[auth_key_id: 8 bytes] [msg_key: 16 bytes] [encrypted_data: N bytes]
```

### auth_key_id

Lower 8 bytes of SHA1 of `auth_key`:

```python
auth_key_id = sha1(self.auth_key).digest()[-8:]
```

### msg_key

```python
msg_key_large = sha256(auth_key[88:120] + plaintext_with_padding).digest()
msg_key = msg_key_large[8:24]  # 16 bytes
```

Where `plaintext_with_padding` is the message with 12-96 bytes of random padding.

### encrypted_data

Encrypted with AES-256-IGE. Keys derived via `kdf_msg()`:

```python
def kdf_msg(auth_key, msg_key, to_server=True):
    x = 0 if to_server else 8
    a = sha256(msg_key + auth_key[x:x+36]).digest()
    b = sha256(auth_key[40+x:76+x] + msg_key).digest()
    aes_key = a[:8] + b[8:24] + a[24:32]    # 32 bytes
    aes_iv  = b[:8] + a[8:24] + b[24:32]    # 32 bytes
    return aes_key, aes_iv
```

## Decrypted Payload Structure

```
[salt: 8 bytes] [session_id: 8 bytes] [msg_id: 8 bytes LE]
[seq_no: 4 bytes LE] [body_length: 4 bytes LE] [body: body_length bytes]
```

### Assembly in send()

```python
m = b''
m += self.server_salt + self.session_id
m += msg_id.to_bytes(8, 'little', signed=True)
m += seq_no.to_bytes(4, 'little', signed=True)
m += len(body).to_bytes(4, 'little', signed=True) + body
pad = secrets.token_bytes((16 - (len(m) + 12) % 16) % 16 + 12)
```

### Parsing in _handle_encrypted_packet()

```python
r = Reader(dec)
_salt = r.take(8)
_sid = r.take(8)
_msg_id = r.i64()
_seq = r.i32()
ln = r.i32()
msg = r.take(ln)  # body with TL schema
```

## Body: TL Schema

The message body is encoded in TL (Type Language) binary format:

- **Constructor**: 4 bytes LE — type identifier (e.g., `0xda9b0d0d` for `invokeWithLayer`)
- **Fields**: serialized according to types (`int`=4 LE, `long`=8 LE, `string`/`bytes`=TL-bytes, `Vector`=0x1cb5c415 + count + items)

## Unencrypted Messages (pre-DH)

```
[auth_key_id=0: 8 bytes] [msg_id: 8 bytes] [body_length: 4 bytes] [body: body_length bytes]
```

Used for `req_pq_multi`, `req_DH_params`, `set_client_DH_params`.
