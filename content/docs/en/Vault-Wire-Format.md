# Vault Wire Format

The exact binary layout of a `.vault` file, byte by byte.

## Binary Structure

```
Offset  Size    Field          Description
──────  ──────  ─────────────  ──────────────────────────
0       16      salt           Random PBKDF2 salt
16      12      nonce          Random AES-GCM nonce (96-bit)
28      N       ciphertext     AES-256-GCM encrypted JSON + 16-byte auth tag
```

Total file size = 16 + 12 + JSON_length + 16 (GCM tag)

## Encryption

```python
# Python side
key, salt = _derive_vault_key(session_name)
nonce = secrets.token_bytes(12)  # fresh 96-bit nonce

# Rust side
ciphertext = cx.aes_gcm_encrypt(key, nonce, json_bytes, b"")
# ciphertext = encrypted_json || GCM_tag (tag is appended by AES-GCM)
```

The GCM authentication tag (16 bytes) is included in `ciphertext` — it's stored inline, not as a separate field.

## Plain JSON Payload

The encrypted JSON structure:

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

After migration from `.session`:

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

## Decryption

```python
salt = raw[:16]
nonce = raw[16:28]
ciphertext = raw[28:]
key, _ = _derive_vault_key(session_name, salt)
plain_json = cx.aes_gcm_decrypt(key, nonce, ciphertext, b"")
payload = json.loads(plain_json.decode())
```

## Plain JSON Fallback (Legacy)

If the ciphertext can't be decrypted, GoyGram checks if the raw bytes start with `0x7B` (`{`):

```python
if raw[0] == 0x7B:
    # Plain JSON — backward compatibility
    return json.loads(raw.decode())
```

Plain JSON vaults are automatically re-encrypted on the next `_write_vault()` call.

## Magic Number Detection

GoyGram distinguishes encrypted vs plain vaults by the first byte:
- `0x7B` (`{`) → plain JSON (will be re-encrypted)
- Anything else → AES-256-GCM encrypted

## JSON Serialization

```python
raw_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
```

Compact JSON with no spaces (`separators=(",", ":")`) — minimizes vault file size.
