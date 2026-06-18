---
title: Session Migration
---

# Session Migration (.session → .vault)

GoyGram can migrate existing Telethon/Pyrogram `.session` files into its encrypted `.vault` format. After migration, the original `.session` file is **securely zeroized and deleted**.

## Migration Trigger

In `bootstrap_session()`, when no `.vault` file exists, the framework checks for a `.session` file:

```python
sess = Path(f"{session_name}.session")
if sess.exists():
    # Read SQLite session
    conn = sqlite3.connect(str(sess))
    cur = conn.cursor()
    row = cur.execute(
        "SELECT dc_id, auth_key, user_id, api_id, test_mode FROM sessions LIMIT 1"
    ).fetchone()
    # ... extract data ...
    conn.close()

    # Write encrypted vault
    _write_vault(vault, payload, session_name)

    # Destroy source
    _zeroize_and_remove(sess)
    return {"source": "session_migrated"}
```

## SQLite Table Reading

The migration reads from the `sessions` table:

```sql
SELECT dc_id, auth_key, user_id, api_id, test_mode FROM sessions LIMIT 1
```

If that query returns no rows (some session formats store auth_key differently), it tries a simpler fallback:

```sql
SELECT dc_id, auth_key FROM sessions LIMIT 1
```

## Extracted Data

| Field | SQLite Column | Vault Key |
|-------|--------------|-----------|
| DC ID | `dc_id` (int) | `"dc"` (int) |
| Auth Key | `auth_key` (blob) | `"auth_key"` (hex string) |
| User ID | `user_id` (int) | In `"user"` dict |
| API ID | `api_id` (int) | `"api_id"` (int) |
| Test Mode | `test_mode` (bool) | `"test_mode"` (bool) |

## Zeroization

The source `.session` file is securely deleted:

```python
def _zeroize_and_remove(path: Path) -> None:
    size = path.stat().st_size
    with path.open("r+b") as f:
        f.write(b"\x00" * size)  # overwrite with zeros
        f.flush()
        os.fsync(f.fileno())     # force to disk
    path.unlink(missing_ok=True) # delete
```

This overwrites every byte with `\x00`, forces a sync to disk, then unlinks the file. While not forensically perfect (SSD wear leveling may leave traces), it prevents casual recovery.

## Migration Result

After successful migration:
1. `.vault` file exists with the session data encrypted
2. `.session` file is gone (zeroized + deleted)
3. `bootstrap_session()` returns `{"source": "session_migrated"}`
4. On next boot, the vault is detected and session restored as normal

## Vault Payload After Migration

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

The `source_session` field is preserved for debugging/audit trails.

## Error Handling

If migration fails for any reason:
- The `.session` file is **not** touched
- A warning is logged
- The framework falls through to interactive auth

## Supported Session Formats

The migration works with any Python Telegram library that stores sessions in SQLite with compatible `sessions` table schema:
- **Telethon** — full compatibility (same schema)
- **Pyrogram** — works (compatible schema)
- **Other SQLite-based session stores** — works if `auth_key`, `dc_id` columns exist
