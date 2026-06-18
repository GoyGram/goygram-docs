---
title: AES 256 GCM
---

# AES-256-GCM

AES-256-GCM (Galois/Counter Mode) — authenticated encryption used in GoyGram for session vault file encryption. Implemented in the Rust extension.

## Parameters

- **Key**: 32 bytes (AES-256)
- **Nonce**: 12 bytes (standard for GCM, generated via `secrets.token_bytes`)
- **AAD** (Additional Authenticated Data): empty string `b""`

## Rust Implementation

```rust
#[pyfunction]
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

Decryption is symmetric — `aes_gcm_decrypt` with the same parameters.

## Usage in Vault

The vault is an encrypted JSON file containing session data (`.vault`).

### Vault File Format

```
[salt: 16 bytes] [nonce: 12 bytes] [ciphertext + tag: remaining]
```

### Encryption Process

```python
def _encrypt_vault_data(data: bytes, session_name: str) -> bytes:
    key, salt = _derive_vault_key(session_name)
    nonce = _secrets.token_bytes(12)
    ciphertext = _rx.aes_gcm_encrypt(key, nonce, data, b"")
    return salt + nonce + ciphertext
```

### Decryption Process

```python
def _decrypt_vault_data(raw: bytes, session_name: str) -> bytes:
    salt = raw[:16]
    nonce = raw[16:28]
    ciphertext = raw[28:]
    key, _ = _derive_vault_key(session_name, salt)
    return _rx.aes_gcm_decrypt(key, nonce, ciphertext, b"")
```

### Vault Key

The key is derived via PBKDF2-HMAC-SHA256 (600,000 iterations):

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

### Fallback

If the Rust extension is unavailable (`_rx is None`), the vault is written as plain JSON — with automatic re-encryption on the next save.

## See Also

- [Session Vault (AES-256-GCM)](Session-Vault-AES-256-GCM) — in-depth vault design and key derivation
- [Vault Wire Format](Vault-Wire-Format) — byte-level binary layout
