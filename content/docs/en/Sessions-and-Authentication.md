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

## Vault protection

Vault data is encrypted. Set `GOYGRAM_VAULT_KEY` to control the vault key explicitly. Existing plain JSON vaults are upgraded to encrypted storage on read using machine-derived protection when no explicit key is configured.

Treat `.vault` files as credentials: keep them private, back them up securely, and never commit them to Git.

## Proxy and client identity

Pass `proxy` to `GoyGram` to give the MTProto transport a proxy URL. `app_name`, `app_version`, `device_model`, `system_version`, `system_lang_code`, `lang_pack`, and `lang_code` customize the MTProto `initConnection` identity.
