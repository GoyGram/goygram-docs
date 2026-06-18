---
title: "Промежуточный транспортный формат"

---
# Промежуточный транспортный формат

Формат передачи, используемый MTProto после первоначального сокращенного транспортного подтверждения `0xEF`. Все зашифрованные пакеты MTProto используют этот кадр.

## Рукопожатие

После установки TCP-соединения GoyGram отправляет 4 байта:


```python
self.wr.write(b"\xee\xee\xee\xee")  # intermediate transport tag
await self.wr.drain()
```


Это сообщает серверу: «Я использую промежуточный транспортный протокол».

## Формат кадра

Каждый пакет в проводе:


```
┌──────────────────────┬────────────────────────┐
│ payload_len (4 bytes)│      payload           │
│ uint32 LE            │    payload_len bytes   │
└──────────────────────┴────────────────────────┘
```


### Упаковка (Python)


```python
class IntermediateTransport:
    def pack(self, payload: bytes) -> bytes:
        return len(payload).to_bytes(4, 'little') + payload
```


### Упаковка (Ржавчина)


```rust
fn pack(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(data.len() + 4);
    out.extend_from_slice(&(data.len() as u32).to_le_bytes());
    out.extend_from_slice(data);
    out
}
```


### Распаковка (Python)


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


### Распаковка (Rust)


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


## Структура зашифрованной полезной нагрузки

Полезная нагрузка внутри промежуточного шпангоута:


```
┌────────────────┬────────────┬───────────────────────┐
│ auth_key_id    │ msg_key    │ encrypted_data        │
│ 8 bytes        │ 16 bytes   │ variable (multiple of 16) │
└────────────────┴────────────┴───────────────────────┘
```


- **auth_key_id**: нижние 8 байтов `SHA1(auth_key)`.
- **msg_key**: средние 16 байтов `SHA256(auth_key[88:120] + message + padding)`.
- **encrypted_data**: тело сообщения, зашифрованное по AES-256-IGE.

## Структура незашифрованной полезной нагрузки

Перед обменом ключами DH сообщения не шифруются:


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


## Ограничения размера кадра

Промежуточный транспорт не имеет явного максимального размера кадра в реализации GoyGram. Серверы Telegram MTProto обычно ограничивают количество кадров ~1 МБ. Функция `cut()` использует `u32` для длины, поэтому теоретический максимум составляет 4 ГБ (на практике никогда не достигается).