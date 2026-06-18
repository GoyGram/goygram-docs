# Intermediate Transport Format

The wire format used by MTProto after the initial `0xEF` abridged transport handshake. All encrypted MTProto packets use this framing.

## Handshake

After the TCP connection is established, GoyGram sends 4 bytes:

```python
self.wr.write(b"\xee\xee\xee\xee")  # intermediate transport tag
await self.wr.drain()
```

This tells the server: "I'm using the intermediate transport protocol."

## Frame Format

Every packet on the wire:

```
┌──────────────────────┬────────────────────────┐
│ payload_len (4 bytes)│      payload           │
│ uint32 LE            │    payload_len bytes   │
└──────────────────────┴────────────────────────┘
```

### Packing (Python)

```python
class IntermediateTransport:
    def pack(self, payload: bytes) -> bytes:
        return len(payload).to_bytes(4, 'little') + payload
```

### Packing (Rust)

```rust
fn pack(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(data.len() + 4);
    out.extend_from_slice(&(data.len() as u32).to_le_bytes());
    out.extend_from_slice(data);
    out
}
```

### Unpacking (Python)

```python
def cut(self) -> list[bytes]:
    out = []
    i = 0
    raw = bytes(self.buf)
    while i < len(raw):
        if i + 4 > len(raw):
            break  # incomplete length prefix
        ln = int.from_bytes(raw[i:i+4], 'little')
        i += 4
        if i + ln > len(raw):
            i -= 4  # incomplete frame — wait for more data
            break
        out.append(raw[i:i+ln])
        i += ln
    self.buf[:] = raw[i:]  # keep remainder for next call
    return out
```

### Unpacking (Rust)

```rust
fn cut(py: Python, buf: &[u8]) -> PyResult<(Vec<Py<PyBytes>>, Py<PyBytes>)> {
    let mut i = 0usize;
    let mut out = Vec::new();
    while i + 4 <= buf.len() {
        let n = u32::from_le_bytes([buf[i], buf[i+1], buf[i+2], buf[i+3]]) as usize;
        if n == 0 {
            return Err(PyValueError::new_err("zero frame"));
        }
        if i + 4 + n > buf.len() {
            break;
        }
        out.push(PyBytes::new(py, &buf[i+4..i+4+n]).into());
        i += 4 + n;
    }
    Ok((out, PyBytes::new(py, &buf[i..]).into()))
}
```

## Encrypted Payload Layout

The payload inside the intermediate frame:

```
┌────────────────┬────────────┬───────────────────────┐
│ auth_key_id    │ msg_key    │ encrypted_data        │
│ 8 bytes        │ 16 bytes   │ variable (multiple of 16) │
└────────────────┴────────────┴───────────────────────┘
```

- **auth_key_id**: Lower 8 bytes of `SHA1(auth_key)`
- **msg_key**: Middle 16 bytes of `SHA256(auth_key[88:120] + message + padding)`
- **encrypted_data**: AES-256-IGE encrypted message body

## Unencrypted Payload Layout

Before DH key exchange, messages are unencrypted:

```
┌──────────────────┬──────────────────┬───────────────┬─────────┐
│ auth_key_id      │ message_id       │ message_length│ body    │
│ 0 (8 bytes)      │ int64 LE         │ int32 LE      │ bytes   │
└──────────────────┴──────────────────┴───────────────┴─────────┘
```

```python
class MTMessage:
    @staticmethod
    def unencrypted(msg_id, body):
        return i64(0) + i64(msg_id) + i32(len(body)) + body
```

## Frame Size Limits

The intermediate transport has no explicit maximum frame size in GoyGram's implementation. Telegram's MTProto servers typically limit frames to ~1MB. The `cut()` function uses `u32` for length, so the theoretical maximum is 4GB (never hit in practice).
