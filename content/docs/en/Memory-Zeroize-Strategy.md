---
title: Memory Zeroize Strategy
---

# Memory Zeroize Strategy

GoyGram aggressively cleans up sensitive data from memory through its "Session Eater" (zeroize) strategy. This applies primarily to session migration and vault handling.

## What Gets Zeroized

### 1. Legacy `.session` Files

When migrating from a Telethon/Pyrogram `.session` file to an encrypted `.vault`:

```python
def _zeroize_and_remove(path: Path) -> None:
    size = path.stat().st_size
    with path.open("r+b") as f:
        f.write(b"\x00" * size)     # overwrite every byte with 0x00
        f.flush()
        os.fsync(f.fileno())        # force to physical disk
    path.unlink(missing_ok=True)    # delete the file
```

This overwrites the entire file with null bytes, syncs to disk, then deletes. The `os.fsync` call ensures the overwrite reaches the storage device before the file is removed.

### 2. Vault Re-encryption

When a plain JSON vault is detected (`raw[0] == 0x7B`), it's read, then **re-encrypted** on the next write:

```python
if raw[0] == 0x7B:
    log.info("Vault %s is in plain JSON format, will re-encrypt on next save.")
    return json.loads(raw.decode())
```

The plaintext JSON data exists in memory only during the read-and-reencrypt window. Once `_write_vault` is called, it's encrypted with AES-256-GCM and the plaintext is eligible for garbage collection.

## What's NOT Zeroized (Known Limitations)

### Python Objects

Python doesn't support explicit memory zeroing. When `auth_key`, `user`, or other sensitive dicts go out of scope, they're garbage collected — but CPython doesn't zero the memory before freeing it. The data may persist in the process heap until overwritten by new allocations.

### Rust Extension Buffers

The Rust code allocates `Vec<u8>` for encryption/decryption. Rust drops these when they go out of scope, but doesn't zero them. The `secrets` crate or `zeroize` crate could be used but aren't currently.

### Stack Variables

Function-local variables containing key material (derived keys, IVs) live on the stack and aren't explicitly cleared. When the function returns, the stack space is reused but not zeroed.

## Practical Security

The zeroize strategy targets the most exposed surface: **files on disk**. A `.session` file sitting in your home directory is infinitely more attackable than process memory. The zeroize-and-remove guarantees that even if someone gets filesystem access after a migration, the old session file is unrecoverable.

For defense-in-depth:

```bash
# Use encrypted filesystem
# /home mounted on LUKS/dm-crypt

# Restrict vault file permissions
chmod 600 *.vault

# Environment variable override for headless servers
export GOYGRAM_VAULT_KEY=$(cat /run/secrets/goygram_key)
```

The vault's AES-256-GCM encryption protects the data at rest regardless of memory zeroing.
