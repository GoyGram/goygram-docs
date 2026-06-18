---
---

# Хранилище сеансов (AES-256-GCM)

Хранилище сеансов — это зашифрованное локальное хранилище GoyGram для данных сеанса MTProto. Он заменяет устаревший файл SQLite `.session` зашифрованным большим двоичным объектом с проверкой подлинности AES-256-GCM.

## Формат файла


```
[name].vault file structure (binary):
┌────────────────────────────────────────────┐
│  salt (16 bytes)                           │ ← PBKDF2 salt
├────────────────────────────────────────────┤
│  nonce (12 bytes)                          │ ← AES-GCM nonce
├────────────────────────────────────────────┤
│  ciphertext + GCM tag (variable)           │ ← AES-256-GCM encrypted JSON
└────────────────────────────────────────────┘
```


На диске это один двоичный объект. Полезная нагрузка JSON в виде открытого текста:


```json
{
    "phone": "+1234567890",
    "user": {
        "id": 123456789,
        "first_name": "User",
        "username": "username"
    },
    "auth_key": "hex_encoded_256_byte_key",
    "dc": 2,
    "api_id": 123456,
    "api_hash": "abc123..."
}
```


## Конвейер шифрования

### 1. Получение ключа


```python
def _derive_vault_key(session_name: str, salt=None):
    # Check for environment override
    env_key = os.getenv("GOYGRAM_VAULT_KEY", "").strip()
    if env_key:
        key = base64.b64decode(env_key)
        if len(key) == 32:
            return key, salt or b"\x00" * 16

    # Default: PBKDF2 from machine-id + session_name
    if salt is None:
        salt = secrets.token_bytes(16)
    material = f"{_get_machine_id()}:{session_name}".encode()
    key = hashlib.pbkdf2_hmac("sha256", material, salt, 600000, dklen=32)
    return key, salt
```


Ключевые параметры:
- **Алгоритм**: PBKDF2-HMAC-SHA256.
- **Итерации**: 600 000 (заведомо дорого — ~0,5 с на современном оборудовании)
- **Длина ключа**: 32 байта (AES-256).
- **Материал**: `{machine-id}:{session_name}`
- **Источники идентификаторов компьютеров** (проверено по порядку):
  1. `/etc/machine-id`
  2. `/var/lib/dbus/machine-id`
  3. `platform.node()` (имя хоста)
  4. `"unknown"`

### 2. Шифрование (Rust)


```python
def _encrypt_vault_data(data: bytes, session_name: str) -> bytes:
    key, salt = _derive_vault_key(session_name)
    nonce = secrets.token_bytes(12)   # fresh random nonce
    ciphertext = _rx.aes_gcm_encrypt(key, nonce, data, b"")
    return salt + nonce + ciphertext
```


AAD (дополнительные аутентифицированные данные) всегда пуст (`b""`).

### 3. Расшифровка (Rust)


```python
def _decrypt_vault_data(raw: bytes, session_name: str) -> bytes:
    salt = raw[:16]
    nonce = raw[16:28]
    ciphertext = raw[28:]
    key, _ = _derive_vault_key(session_name, salt)
    return _rx.aes_gcm_decrypt(key, nonce, ciphertext, b"")
```


## GOYGRAM_VAULT_KEY Переопределить

Для детерминированного ключа (CI, контейнеры, автономные серверы без стабильного идентификатора машины):


```bash
export GOYGRAM_VAULT_KEY=$(python3 -c "import base64,os; print(base64.b64encode(os.urandom(32)).decode())")
```


Если эта переменная окружения установлена, ключ хранилища получается непосредственно из нее (декодированный в Base64, должен иметь длину ровно 32 байта). Производное PBKDF2 **полностью обходится**.

## Обычный резервный JSON

GoyGram поддерживает незашифрованные хранилища для обратной совместимости:


```python
def _read_vault(path, session_name):
    raw = path.read_bytes()
    if raw[0] == 0x7B:  # '{' — plain JSON
        return json.loads(raw.decode())
    try:
        plain = _decrypt_vault_data(raw, session_name)
        return json.loads(plain.decode())
    except Exception:
        # Last resort: try as plain JSON
        return json.loads(raw.decode())
```


Если простое хранилище JSON считывается успешно, оно **автоматически повторно шифруется** при следующем сохранении.

## Обработка ошибок расшифровки

Если расшифровка не удалась (неправильный ключ, поврежденный файл, фальсификация):

1. Попробуйте использовать обычный JSON.
2. Если и это не помогло → `ValueError` с `"Cannot read vault {name}: {error}"`.
3. Это активирует резервную интерактивную аутентификацию в `bootstrap_session()`.

## Свойства безопасности

| Недвижимость | Гарантия |
|----------|-----------|
| Конфиденциальность | Шифрование AES-256-GCM предотвращает чтение без ключа |
| Честность | Тег аутентификации GCM обнаруживает любое вмешательство |
| Ключевая изоляция | Ключ, полученный из идентификатора машины — копирование хранилища на другую машину делает его нечитаемым |
| Одноразовая уникальность | Свежий 12-байтовый случайный одноразовый номер для каждой записи — повторное использование одноразового номера невозможно |
| Ключевое качество материала | PBKDF2 с 600 тыс. итераций делает брутфорс дорогим |

## Что НЕ ЗАЩИЩЕНО

- Файл хранилища НЕ скрыт — любой, у кого есть доступ к файловой системе, может видеть, что `default.vault` существует.
- Если у злоумышленника есть и файл хранилища, и идентификатор машины, он может получить ключ.
- Хранилище защищает только ключ аутентификации MTProto — история сообщений, контакты и данные чата НЕ хранятся локально.