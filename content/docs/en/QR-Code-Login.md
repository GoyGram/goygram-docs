# QR Code Login

QR code login uses `auth.exportLoginToken` / `auth.importLoginToken` to authorize without entering a phone number. The user scans a QR code with their main Telegram client.

## Flow Overview

```
1. Export login token via MTProto
2. Encode token as tg://login?token=... URL
3. Display QR code in terminal (ASCII art)
4. Poll auth.exportLoginToken until scanned or expired
5. On scan: receive loginTokenSuccess with user + auth key
6. Handle 2FA if needed (SESSION_PASSWORD_NEEDED)
7. Handle DC migration if needed (loginTokenMigrateTo)
8. Write vault
```

## Step 1: Export Token

```python
res = await _mt_req_with_migrate(app, "auth_export_login_token",
    api_id=api_id, api_hash=api_hash, except_ids=[]
)
```

The response is `loginToken` with:
- `token`: raw bytes of the login token
- `expires`: Unix timestamp when the token expires

## Step 2: Generate QR Code

```python
token = res["token"]
b64_token = base64.urlsafe_b64encode(token).decode().rstrip("=")
url = f"tg://login?token={b64_token}"

import qrcode, io
qr = qrcode.QRCode()
qr.add_data(url)
f = io.StringIO()
qr.print_ascii(out=f)
qr_output = f.getvalue()
sys.stdout.write(qr_output)
```

The `qrcode` library renders ASCII art directly to the terminal. If this fails (no `qrcode` library), it falls back to printing the raw URL.

## Step 3: Poll for Scan

```python
while time.time() < expires:
    await asyncio.wait_for(app.mt.qr_update_ev.wait(),
                          timeout=expires - time.time())

    poll_res = await _mt_req_with_migrate(app, "auth_export_login_token",
        api_id=api_id, api_hash=api_hash, except_ids=[])
```

The `qr_update_ev` event is set when MTProto receives an update with the `0x91e64f56` magic bytes in the encrypted packet body — this is the signal that a QR scan-related update arrived. However, the actual response check also polls the export endpoint.

### Response Types

| Type | Meaning | Action |
|------|---------|--------|
| `loginToken` | Still waiting | Continue polling |
| `loginTokenSuccess` | Scanned + confirmed | Extract user + auth key |
| `loginTokenMigrateTo` | Wrong DC | Migrate connection, import token there |
| Token expired | Timeout | Regenerate new QR code |

## Step 4: DC Migration During QR Login

If Telegram returns `loginTokenMigrateTo`:

```python
dc_id = poll_res["dc_id"]
token_m = poll_res["token"]

# Reconnect to target DC
endpoint = pick_dc_endpoint(dc_map, preferred_dc=dc_id)
await app.mt.close()
app.mt.host = endpoint.host
app.mt.port = endpoint.port
app.mt.auth_key = None
app.mt._init_done = False
app.mt.session_id = secrets.token_bytes(8)
await app.mt.boot()
await app.mt.ensure_auth_key()

# Import the login token on the new DC
mig_res = await _mt_req_with_migrate(app, "auth_import_login_token",
    token=token_m, api_id=api_id)
```

Then continue the 2FA/success flow from the migrated response.

## Step 5: 2FA During QR Login

If the response contains `SESSION_PASSWORD_NEEDED`:

```python
while True:
    pwd = await _ask_non_empty("2FA password: ", is_password=True)
    check = await _mt_req_with_migrate(app, "auth_check_password",
        password=pwd, api_id=api_id, api_hash=api_hash)

    if not isinstance(check, dict):
        continue  # unexpected response, retry

    check_err = _extract_error(check) or ""
    if check_err:
        continue  # wrong password, retry

    poll_res = check
    poll_res["type"] = "loginTokenSuccess"
    break
```

## Success

```python
user = _extract_user(final)
auth_blob = _extract_auth_blob(final)

payload = {
    "phone": user.get("phone", ""),
    "user": user,
    "auth_key": auth_blob.hex(),
    "dc": _field(final, "dc_id", "dc") or app.mt.host,
    "api_id": api_id,
    "api_hash": api_hash,
}
_write_vault(vault, payload, session_name)
```

If `auth_blob` isn't found in the response, it falls back to `app.mt.auth_key` (which was set during the DH exchange).

## Expiration & Retry

If the token expires before scanning:

```
Token expired. Regenerating...
```

A new QR code is generated immediately. This loop continues indefinitely until the user scans or interrupts.
