# Interactive Auth Flow

When `bootstrap_session()` can't find a valid `.vault` file and no `.session` file exists to migrate, GoyGram launches a terminal-first interactive authorization flow. This is the full login experience — phone number entry, code verification, optional 2FA, and QR code scanning.

## Entry Point: `bootstrap_session()`

```python
async def bootstrap_session(app, api_id, api_hash, session_name="default"):
    vault = Path(f"{session_name}.vault")

    # Step 1: Check for existing vault
    if vault.exists() and vault.stat().st_size > 0:
        data = _read_vault(vault, session_name)
        # Restore auth_key and DC into MTNet
        app.mt.auth_key = _extract_auth_blob({"auth_key": data["auth_key"]})
        # ... restore dc, user, etc.
        return {"source": "vault"}

    # Step 2: Check for legacy .session file
    sess = Path(f"{session_name}.session")
    if sess.exists():
        # Migrate from SQLite .session → .vault
        return {"source": "session_migrated"}

    # Step 3: No stored session — launch interactive auth
    return await _mt_auth_flow(app, vault, session_name, api_id, api_hash)
```

## The Login Flow UI

GoyGram uses **Rich** for a polished TUI when interactive (TTY detected), falling back to plain `input()`/`getpass()` for non-interactive environments.

### Interactive Detection

```python
def _is_interactive() -> bool:
    return sys.stdout.isatty() and sys.stdin.isatty()
```

### Rich-Based Menu

When interactive, a custom Rich terminal menu is used:

```python
def _rich_menu_sync(title, options):
    console = Console()
    console.print(f"\n[bold cyan]? {title}[/bold cyan]")
    # Arrow-key navigation with termios raw mode
    # Visual selection with green highlight
    # Returns selected index
```

The menu uses **raw terminal mode** via `termios.tcgetattr`/`tcsetattr`:
- Arrow keys navigate (↑↓ or ←→)
- Enter confirms selection
- Visual highlight with ANSI escape codes (`\033[32m\033[1m`)

### Password Input

```python
def _rich_password_input_sync(prompt_text):
    # Raw terminal mode
    # Echo '*' characters as user types
    # Backspace handling
    # Returns plaintext password string
```

## Auth Flow Steps

### 1. Choose Method

```
? Choose login method:
  > QR Code Login
    Phone Number Login
```

The user picks QR scan or phone number. Default in TTY: QR first.

### 2A. Phone Number Entry

```
Phone number (e.g. +1234567890): +79001234567
```

**Phone normalization** (`_normalize_phone`):
- Strips all non-digit characters except `+`
- Ensures only one `+` at the beginning
- Length validation: 8-15 digits (international), or specific local formats
- Russian 11-digit starting with `8` → auto-converted to `+7`

### 2B. QR Code Login

The QR flow uses `auth.exportLoginToken` / `auth.importLoginToken` MTProto methods:

1. Export a login token from the MTProto connection
2. Display a QR code in the terminal (ASCII art via `qrcode` library)
3. Poll in a loop until scanned or expired
4. On scan: receive `loginTokenSuccess` with user data and auth key
5. Handle 2FA if `SESSION_PASSWORD_NEEDED` is returned
6. Handle DC migration if `loginTokenMigrateTo` is returned

### 3. Code Entry

```
Code sent. Enter the code from Telegram/SMS.
Code: 12345
```

The code is verified via `auth.signIn`. If incorrect, the user is prompted again.

### 4. 2FA (if enabled)

If the account has 2FA, the framework detects `SESSION_PASSWORD_NEEDED` in the response:

```python
if "SESSION_PASSWORD_NEEDED" in sign_err:
    pwd = await _ask_non_empty("2FA password: ", is_password=True)
    check = await _mt_req_with_migrate(app, "auth_check_password", password=pwd, ...)
```

The SRP (Secure Remote Password) flow is handled automatically — see [2FA / SRP Password](2FA-SRP-Password).

### 5. Success

```
Success! Session saved to default.vault
```

The vault is written with:
- Phone number
- User info dict
- Auth key (hex-encoded 256 bytes)
- DC number
- API ID and API hash

The `self_id` is set on both `AppCore` and `MTNet` from the user ID in the response.

## Error Recovery

- **`PHONE_CODE_INVALID`**: Prompt for code again
- **`SESSION_PASSWORD_NEEDED`**: Prompt for 2FA password
- **`*_MIGRATE_*`**: Auto-migrate to the correct DC and retry
- **5 consecutive phone retry failures** → exit the phone number flow, return `None` (caller can restart)
- **QR token expiration** → regenerate a new QR code (infinite loop until success)

## Non-Interactive Mode

When stdin is not a TTY (piped input, headless server), the flow falls back to:

```python
input(prompt)       # plain input()
getpass.getpass()   # password input (no echo)
print(text)         # plain text output
```

No Rich formatting, no arrow-key menus. Functional but less pretty.

## DC Migration During Auth

The auth flow uses `_mt_req_with_migrate()` which automatically handles `PHONE_MIGRATE_X` / `NETWORK_MIGRATE_X` errors:

```python
async def _mt_req_with_migrate(app, act, **kw):
    while True:
        res = await app.mt_req(act, **kw)
        err = _extract_error(res) or ""
        dc_id = _extract_migrate_dc(err)
        if dc_id is None:
            return res
        # Close current connection
        await app.mt.close()
        # Reconnect to the correct DC
        endpoint = pick_dc_endpoint(dc_map, preferred_dc=dc_id)
        app.mt.host = endpoint.host
        app.mt.port = endpoint.port
        # Reset auth state
        app.mt.auth_key = None
        app.mt._init_done = False
        app.mt.session_id = secrets.token_bytes(8)
        # Reboot and retry
        await app.mt.boot()
        await app.mt.ensure_auth_key()
```

This means if you register from a DC that doesn't serve your phone number, GoyGram automatically reconnects to the right DC and retries the request — completely transparent to the user.
