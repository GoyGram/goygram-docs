---
title: "Хранилище сеансов AES 256 GCM"
---

# Хранилище сеансов (AES-256-GCM)

Хранилище сеансов — это зашифрованное локальное хранилище GoyGram для данных сеанса MTProto. Оно заменяет устаревший файл SQLite `.session` зашифрованным большим двоичным объектом с проверкой подлинности AES-256-GCM.

## Формат файла (v2)

Новые хранилища начинаются с заголовка `GGV2` и не зависят от имени файла:

```
[name].vault file structure (binary, v2):
┌────────────────────────────────────────────┐
│  magic "GGV2" (4 bytes)                    │ ← format marker
├────────────────────────────────────────────┤
│  salt (16 bytes)                           │ ← PBKDF2 salt
├────────────────────────────────────────────┤
│  nonce (12 bytes)                          │ ← AES-GCM nonce
├────────────────────────────────────────────┤
│  ciphertext + GCM tag (variable)           │ ← AES-256-GCM encrypted JSON
└────────────────────────────────────────────┘
```

Формат v1 (устаревший) не имеет заголовка `GGV2`: сразу `salt + nonce + ciphertext`, а ключ выводится из `machine-id + session_name`. Читатель определяет формат автоматически: наличие `GGV2` → деривация v2, иначе fallback на v1.

На диске это один двоичный объект. Полезная нагрузка JSON в виде открытого текста:

```json
{
    "phone": "+123****7890",
    "user": {
        "id": 123456789,
        "first_name": "User",
        "username": "username"
    },
    "auth_key": "hex_encoded_256_byte_key",
    "dc": 2,
    "api_id": 123456,
    "api_hash": "abc123...",
    "is_bot": false
}
```

## Конвейер шифрования

### 1. Получение ключа (v2, rename-safe)

```python
def _derive_vault_key_v2(salt=None):
    env_key = os.getenv("GOYGRAM_VAULT_KEY", "").strip()
    if env_key:
        key = base64.b64decode(env_key)
        if len(key) == 32:
            return key, salt or b"\x00" * 16
    if salt is None:
        salt = secrets.token_bytes(16)
    material = _get_machine_id().encode()   # имя файла не участвует
    key = hashlib.pbkdf2_hmac("sha256", material, salt, 600000, dklen=32)
    return key, salt
```

Ключевые параметры:
- **Алгоритм**: PBKDF2-HMAC-SHA256.
- **Итерации**: 600 000 (намеренно дорого — ~0,5 с на современном оборудовании).
- **Длина ключа**: 32 байта (AES-256).
- **Материал (v2)**: `{machine-id}`.
- **Материал (v1, legacy)**: `{machine-id}:{session_name}`.
- **Источники идентификаторов машин** (проверено по порядку):
  1. `/etc/machine-id`
  2. `/var/lib/dbus/machine-id`
  3. `platform.node()` (имя хоста)
  4. `"unknown"`

### 2. Шифрование (Rust)

```python
def _encrypt_vault_data(data: bytes, session_name: str) -> bytes:
    key, salt = _derive_vault_key_v2()
    nonce = secrets.token_bytes(12)   # свежий случайный nonce
    ciphertext = _rx.aes_gcm_encrypt(key, nonce, data, b"")
    return b"GGV2" + salt + nonce + ciphertext
```

AAD (дополнительные аутентифицированные данные) всегда пуст (`b""`).

### 3. Расшифровка (Rust)

```python
def _decrypt_vault_data(raw: bytes, session_name: str) -> bytes:
    if raw.startswith(b"GGV2"):
        body = raw[4:]
        salt, nonce, ciphertext = body[:16], body[16:28], body[28:]
        key, _ = _derive_vault_key_v2(salt)
        return _rx.aes_gcm_decrypt(key, nonce, ciphertext, b"")
    # legacy v1 fallback
    salt, nonce, ciphertext = raw[:16], raw[16:28], raw[28:]
    key, _ = _derive_vault_key(session_name, salt)
    return _rx.aes_gcm_decrypt(key, nonce, ciphertext, b"")
```

## GOYGRAM_VAULT_KEY Переопределить

Для детерминированного ключа (CI, контейнеры, автономные серверы без стабильного идентификатора машины):

```bash
export GOYGRAM_VAULT_KEY=$(python3 -c "import base64,os; print(base64.b64encode(os.urandom(32)).decode())")
```

Если эта переменная окружения установлена, ключ хранилища получается непосредственно из неё (декодированный в Base64, должен иметь длину ровно 32 байта). Производное PBKDF2 **полностью обходится**.

## Обработка ошибок расшифровки

Открытые JSON-хранилища (начинающиеся с `{`) **отклоняются**: расшифровка не должна молча принимать plaintext. Если расшифровка не удалась (неправильный ключ, повреждённый файл, фальсификация):

1. Поднимается `ValueError` с `"Cannot decrypt vault {name}"`.
2. Это активирует резервную интерактивную аутентификацию в `bootstrap_session()`.

## Свойства безопасности

| Свойство | Гарантия |
|----------|-----------|
| Конфиденциальность | Шифрование AES-256-GCM предотвращает чтение без ключа |
| Целостность | Тег аутентификации GCM обнаруживает любое вмешательство |
| Ключевая изоляция | Ключ выводится из идентификатора машины — копирование хранилища на другую машину делает его нечитаемым |
| Одноразовая уникальность | Свежий 12-байтовый случайный nonce для каждой записи — повторное использование nonce невозможно |
| Ключевое качество материала | PBKDF2 с 600 тыс. итераций делает брутфорс дорогим |
| Переименование | Имя файла не входит в ключ v2 — сессию можно переименовывать после входа |

## Что НЕ ЗАЩИЩЕНО

- Файл хранилища НЕ скрыт — любой, у кого есть доступ к файловой системе, может видеть, что `default.vault` существует.
- Если у злоумышленника есть и файл хранилища, и идентификатор машины, он может получить ключ.
- Хранилище защищает только ключ аутентификации MTProto — история сообщений, контакты и данные чата НЕ хранятся локально.
