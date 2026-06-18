---
---

# Формат провода хранилища

Точная двоичная структура файла `.vault`, побайтно.

## Бинарная структура


```
Offset  Size    Field          Description
──────  ──────  ─────────────  ──────────────────────────
0       16      salt           Random PBKDF2 salt
16      12      nonce          Random AES-GCM nonce (96-bit)
28      N       ciphertext     AES-256-GCM encrypted JSON + 16-byte auth tag
```


Общий размер файла = 16 + 12 + JSON_length + 16 (тег GCM).

## Шифрование


```python
# Python side
key, salt = _derive_vault_key(session_name)
nonce = secrets.token_bytes(12)  # fresh 96-bit nonce

# Rust side
ciphertext = cx.aes_gcm_encrypt(key, nonce, json_bytes, b"")
# ciphertext = encrypted_json || GCM_tag (tag is appended by AES-GCM)
```


Тег аутентификации GCM (16 байт) включен в `ciphertext` — он хранится внутри, а не в виде отдельного поля.

## Обычная полезная нагрузка JSON

Зашифрованная структура JSON:


```json
{
    "phone": "+1234567890",
    "user": {
        "id": 123456789,
        "is_bot": false,
        "first_name": "User",
        "username": "username",
        "phone": "+1234567890"
    },
    "auth_key": "hex_encoded_256_bytes",
    "dc": 2,
    "api_id": 123456,
    "api_hash": "abcdef0123456789"
}
```


После перехода с `.session`:


```json
{
    "auth_key": "hex...",
    "dc": 2,
    "user_id": 123456789,
    "api_id": 123456,
    "test_mode": false,
    "source_session": "default.session"
}
```


## Расшифровка


```python
salt = raw[:16]
nonce = raw[16:28]
ciphertext = raw[28:]
key, _ = _derive_vault_key(session_name, salt)
plain_json = cx.aes_gcm_decrypt(key, nonce, ciphertext, b"")
payload = json.loads(plain_json.decode())
```


## Резервный вариант обычного JSON (устаревший вариант)

Если зашифрованный текст не удается расшифровать, GoyGram проверяет, начинаются ли необработанные байты с `0x7B` (`{`):


```python
if raw[0] == 0x7B:
    # Plain JSON — backward compatibility
    return json.loads(raw.decode())
```


Обычные хранилища JSON автоматически повторно шифруются при следующем вызове `_write_vault()`.

## Обнаружение магического числа

GoyGram различает зашифрованные и простые хранилища по первому байту:
- `0x7B` (`{`) → простой JSON (будет перешифрован)
- Все остальное → шифрование AES-256-GCM.

## Сериализация JSON


```python
raw_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
```


Компактный JSON без пробелов (`separators=(",", ":")`) — минимизирует размер файла хранилища.