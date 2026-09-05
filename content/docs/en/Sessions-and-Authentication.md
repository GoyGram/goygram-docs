---
title: Sessions and Authentication
---

# Sessions and Authentication

MTProto authorization is stored in `<session_name>.vault`; the default name is `default.vault`.

```python
app = GoyGram(api_id=123456, api_hash="…", session_name="work")
```

On startup, GoyGram loads `work.vault` if present. It restores the authorization key, selected data center, and known account ID. If no usable session exists, startup enters the interactive authorization flow:

1. Enter the phone number.
2. Enter Telegram's sign-in code.
3. Enter the cloud password if the account has Telegram 2FA enabled.

The application can also use QR-code authorization when selected during the flow.

## Bot authorization (auth.importBotAuthorization)

A bot is authorized over MTProto when `bot_token` is supplied together with `api_id`/`api_hash`. GoyGram calls `auth.importBotAuthorization` instead of the interactive phone/QR flow, stores the result in the vault, and marks it as a bot session:

```python
app = GoyGram(
    bot_token="123456:ABC_TOKEN",
    api_id=123456,
    api_hash="…",
    session_name="my_bot",
)
```

The bot's user ID becomes `app.self_id`, and both the Bot API and MTProto transports stay available for `via=` routing. A bot whose account lives on a different data center is migrated automatically (`USER_MIGRATE_N`).

## The Session object

Every app exposes `app.session` — one `Session` object that is the session in memory, in a file, and as a portable encrypted string at the same time:

```python
from goygram import GoyGram, Session

app = GoyGram(api_id=123456, api_hash="…")

# read the account id and name the file by it (rename-safe):
await app.session.save(f"{app.session.self_id}.vault")

# or keep it as an encrypted, portable string:
token = app.session.export_string()   # AES-256-GCM encrypted, machine-locked
sess = Session.from_string(token)     # one call to restore
```

- `session.self_id`, `session.is_bot`, `session.auth_key`, `session.server_salt`, `session.dc` are exposed as properties.
- `session.save(path)`, `Session.load(path)`, `session.export_string()`, `Session.from_string(s)`, `session.to_dict()`, `Session.from_dict(...)`.
- `session.suggest_name()` returns `f"{self_id}.vault"` once the account ID is known.

Pass an existing session explicitly with `session=`:

```python
app = GoyGram(api_id=..., api_hash=..., session=Session.from_string(token))
app = GoyGram(api_id=..., api_hash=..., session=Session(name="worker_1"))
```

`session_name="…"` remains the plain file-backed shorthand.

## Vault protection

Vault data is encrypted with AES-256-GCM. New vaults are **rename-safe**: the encryption key is derived from the machine ID (not the file name), so you can name or rename a session file after login without breaking decryption. The vault is written with a `GGV2` header; legacy vaults (and `.session` migrations) are detected and read transparently.

Set `GOYGRAM_VAULT_KEY` to control the vault key explicitly. Existing plain JSON vaults are upgraded to encrypted storage on read using machine-derived protection when no explicit key is configured.

Treat `.vault` files as credentials: keep them private, back them up securely, and never commit them to Git.

## Proxy and client identity

Pass `proxy` to `GoyGram` to give the MTProto transport a proxy URL. `app_name`, `app_version`, `device_model`, `system_version`, `system_lang_code`, `lang_pack`, and `lang_code` customize the MTProto `initConnection` identity.
