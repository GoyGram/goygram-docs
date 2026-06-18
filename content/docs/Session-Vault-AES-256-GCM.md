# Session Vault (AES-256-GCM)

The session vault is GoyGram's encrypted local storage for MTProto session data. It replaces the legacy `.session` SQLite file with an AES-256-GCM authenticated encrypted blob.

## File Format

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

On disk, this is a single binary blob. The plaintext JSON payload:

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

## Encryption Pipeline

### 1. Key Derivation

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

Key parameters:
- **Algorithm**: PBKDF2-HMAC-SHA256
- **Iterations**: 600,000 (deliberately expensive — ~0.5s on modern hardware)
- **Key length**: 32 bytes (AES-256)
- **Material**: `{machine-id}:{session_name}`
- **Machine ID sources** (tried in order):
  1. `/etc/machine-id`
  2. `/var/lib/dbus/machine-id`
  3. `platform.node()` (hostname)
  4. `"unknown"`

### 2. Encryption (Rust)

```python
def _encrypt_vault_data(data: bytes, session_name: str) -> bytes:
    key, salt = _derive_vault_key(session_name)
    nonce = secrets.token_bytes(12)   # fresh random nonce
    ciphertext = _rx.aes_gcm_encrypt(key, nonce, data, b"")
    return salt + nonce + ciphertext
```

The AAD (additional authenticated data) is always empty (`b""`).

### 3. Decryption (Rust)

```python
def _decrypt_vault_data(raw: bytes, session_name: str) -> bytes:
    salt = raw[:16]
    nonce = raw[16:28]
    ciphertext = raw[28:]
    key, _ = _derive_vault_key(session_name, salt)
    return _rx.aes_gcm_decrypt(key, nonce, ciphertext, b"")
```

## GOYGRAM_VAULT_KEY Override

For deterministic keying (CI, containers, headless servers without a stable machine-id):

```bash
export GOYGRAM_VAULT_KEY=$(python3 -c "import base64,os; print(base64.b64encode(os.urandom(32)).decode())")
```

When this env var is set, the vault key is derived directly from it (base64-decoded, must be exactly 32 bytes). The PBKDF2 derivation is **completely bypassed**.

## Plain JSON Fallback

GoyGram supports unencrypted vaults for backward compatibility:

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

If a plain JSON vault is read successfully, it's **automatically re-encrypted** on the next save.

## Decryption Failure Handling

If decryption fails (wrong key, corrupted file, tampering):

1. Try as plain JSON
2. If that also fails → `ValueError` with `"Cannot read vault {name}: {error}"`
3. This triggers the interactive auth fallback in `bootstrap_session()`

## Security Properties

| Property | Guarantee |
|----------|-----------|
| Confidentiality | AES-256-GCM encryption prevents reading without the key |
| Integrity | GCM authentication tag detects any tampering |
| Key isolation | Key derived from machine-id — copying the vault to another machine makes it unreadable |
| Nonce uniqueness | Fresh 12-byte random nonce per write — nonce reuse is impossible |
| Key material quality | PBKDF2 with 600K iterations makes brute-force expensive |

## What's NOT Protected

- The vault file is NOT hidden — anyone with filesystem access can see `default.vault` exists
- If an attacker has both the vault file AND the machine-id, they can derive the key
- The vault only protects the MTProto auth key — message history, contacts, and chat data are NOT stored locally
