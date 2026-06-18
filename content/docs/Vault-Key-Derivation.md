# Vault Key Derivation

The vault encryption key is derived from machine-specific data using PBKDF2 with 600,000 iterations. This page documents the complete derivation pipeline.

## Derivation Pipeline

```python
def _derive_vault_key(session_name, salt=None):
    # 1. Check for explicit key override
    env_key = os.getenv("GOYGRAM_VAULT_KEY", "").strip()
    if env_key:
        key = base64.b64decode(env_key)
        if len(key) == 32:
            return key, salt or b"\x00" * 16

    # 2. Generate salt if not provided
    if salt is None:
        salt = secrets.token_bytes(16)

    # 3. Build key material
    material = f"{_get_machine_id()}:{session_name}".encode()

    # 4. Derive key via PBKDF2
    key = hashlib.pbkdf2_hmac("sha256", material, salt, 600000, dklen=32)

    return key, salt
```

## Machine ID Resolution

```python
def _get_machine_id():
    # Priority 1: systemd machine-id
    for p in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
        try:
            return Path(p).read_text().strip()
        except Exception:
            continue

    # Priority 2: hostname
    try:
        return platform.node() or "unknown"
    except Exception:
        return "unknown"
```

The machine ID binds the vault to a specific machine. Copying a `.vault` file to another host won't work because the machine ID differs → key differs → decryption fails.

## Crypto Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Hash function | SHA-256 | Standard for PBKDF2 |
| Iterations | 600,000 | ~0.5s on modern hardware, expensive to brute-force |
| Key length | 32 bytes | AES-256 |
| Salt length | 16 bytes | 128 bits of randomness |
| Key material | `f"{machine_id}:{session_name}"` | Binds to machine + session |

## Why 600,000 Iterations?

The OWASP recommendation for PBKDF2-SHA256 is 600,000 iterations (as of 2023). This makes brute-force attacks expensive while keeping decryption time acceptable (~0.5 seconds). Since vault decryption happens once at startup, this is a good tradeoff.

## GOYGRAM_VAULT_KEY Override

For environments without a stable machine-id (containers, CI, headless servers):

```bash
# Generate a random key
python3 -c "import base64,os; print(base64.b64encode(os.urandom(32)).decode())"

# Set it
export GOYGRAM_VAULT_KEY="base64_encoded_32_bytes_here"
```

When this env var is set:
- PBKDF2 derivation is **completely bypassed**
- The key is used directly (must be exactly 32 bytes after base64 decode)
- Salt defaults to `b"\x00" * 16` (no randomization needed — the key IS the secret)

## Key Rotation

To re-encrypt a vault with a new key:
1. Read with old key
2. Delete old vault
3. Set new `GOYGRAM_VAULT_KEY` (or let machine-id change)
4. Run the app → new vault is written with new key

There's no explicit key rotation API — just the natural read/write cycle.

## Security Model

```
Threat: Attacker with filesystem access to the vault file
         but not the machine-id

Protection: PBKDF2 with 600K iterations → ~0.5s per attempt
           → brute-force infeasible without the machine-id

Threat: Attacker with both vault file AND machine-id
         (e.g., full disk image of the host)

Protection: None. The key material is known.
           → Use full disk encryption (LUKS) as defense-in-depth
```
