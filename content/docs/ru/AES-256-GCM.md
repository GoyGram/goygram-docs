---
title: "АЕС 256 ГЦМ"
---

# AES-256-GCM

AES-256-GCM (режим Галуа/счетчика) — шифрование с аутентификацией, используемое в GoyGram для шифрования файлов хранилища сеансов. Реализовано в расширении Rust.

## Параметры

- **Ключ**: 32 байта (AES-256).
- **Nonce**: 12 байт (стандарт для GCM, генерируется через `secrets.token_bytes`).
- **AAD** (дополнительные аутентифицированные данные): пустая строка `b""`

## Реализация Rust


```rust
# [pyfunction]
fn aes_gcm_encrypt(py: Python, key: &[u8], nonce: &[u8],
                    plaintext: &[u8], aad: &[u8]) -> PyResult<Py<PyBytes>> {
    if key.len() != 32 {
        return Err(PyValueError::new_err("key must be 32 bytes"));
    }
    if nonce.len() != 12 {
        return Err(PyValueError::new_err("nonce must be 12 bytes"));
    }
    let cipher = Aes256Gcm::new_from_slice(key)?;
    let n = Nonce::from_slice(nonce);
    let ct = cipher.encrypt(n, Payload { msg: plaintext, aad })?;
    Ok(PyBytes::new(py, &ct).into())
}
```


Расшифровка симметричная — `aes_gcm_decrypt` с теми же параметрами.

## Использование в хранилище

Хранилище представляет собой зашифрованный файл JSON, содержащий данные сеанса (`.vault`).

### Формат файла хранилища


```
[salt: 16 bytes] [nonce: 12 bytes] [ciphertext + tag: remaining]
```


### Процесс шифрования


```python
def _encrypt_vault_data(data: bytes, session_name: str) -> bytes:
    key, salt = _derive_vault_key(session_name)
    nonce = _secrets.token_bytes(12)
    ciphertext = _rx.aes_gcm_encrypt(key, nonce, data, b"")
    return salt + nonce + ciphertext
```


### Процесс расшифровки


```python
def _decrypt_vault_data(raw: bytes, session_name: str) -> bytes:
    salt = raw[:16]
    nonce = raw[16:28]
    ciphertext = raw[28:]
    key, _ = _derive_vault_key(session_name, salt)
    return _rx.aes_gcm_decrypt(key, nonce, ciphertext, b"")
```


### Ключ хранилища

Ключ получается через PBKDF2-HMAC-SHA256 (600 000 итераций):


```python
def _derive_vault_key(session_name: str, salt=None) -> tuple[bytes, bytes]:
    # Priority: GOYGRAM_VAULT_KEY environment variable (base64)
    env_key = os.getenv("GOYGRAM_VAULT_KEY", "").strip()
    if env_key:
        key = base64.b64decode(env_key)
        if len(key) == 32:
            return key, salt or b"\x00" * 16

    if salt is None:
        salt = _secrets.token_bytes(16)
    material = f"{_get_machine_id()}:{session_name}".encode()
    key = hashlib.pbkdf2_hmac("sha256", material, salt, 600000, dklen=32)
    return key, salt
```


### Резервный вариант

Если расширение Rust недоступно (`_rx is None`), хранилище записывается в виде обычного JSON — с автоматическим повторным шифрованием при следующем сохранении.

## См. также

- [Session Vault (AES-256-GCM)](Session-Vault-AES-256-GCM) — углубленное проектирование хранилища и получение ключей.
- [Vault Wire Format] (Vault-Wire-Format) — двоичная раскладка на уровне байтов.