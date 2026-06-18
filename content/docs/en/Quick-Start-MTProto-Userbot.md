---
title: "Quick Start: MTProto Userbot"
---

# Quick Start: MTProto Userbot

Run a Telegram user account (not a bot) with GoyGram. This gives you access to everything a normal Telegram client can do — dialogs, reactions, channels, and more.

## 1. Install

```bash
pip install goygram
```

Requires Python 3.11+.

## 2. Get API Credentials

Go to [my.telegram.org](https://my.telegram.org), log in, go to "API Development Tools", and create an app. You'll get:
- **API ID** (integer)
- **API Hash** (32-char hex string)

Keep these secret. They're your app's identity.

## 3. Write Your Userbot

```python
import asyncio
from goygram import GoyGram, filters

app = GoyGram(
    api_id=123456,
    api_hash="0123456789abcdef0123456789abcdef",
    session_name="my_account"
)

@app.on_cmd(".ping")
async def ping(msg):
    await msg.reply("<b>🏓 PONG!</b> GoyGram is running.", parse_mode="HTML")

asyncio.run(app.run())
```

## 4. First Run — Interactive Login

On first run, you'll see a TUI login flow:

```
GoyGram Interactive Login

? Choose login method:
  > QR Code Login
    Phone Number Login
```

Pick one:
- **QR Code**: Scan with another Telegram client (Settings → Devices → Scan QR)
- **Phone Number**: Enter your number, receive a code, enter it

If you have 2FA enabled, you'll be prompted for your password.

After successful login:
```
Success! Session saved to my_account.vault
```

On subsequent runs, the vault is loaded automatically — no re-login needed.

## 5. What You Can Do

### Commands

```python
@app.on_cmd(".ping")
async def ping(msg): ...

@app.on_cmd(".del")
async def delete_last(msg):
    await msg.delete()
```

### Self-Message Tracking

```python
@app.on_msg(filt=filters.text & filters.me)
async def self_logger(msg):
    if msg.text.lower() == "test":
        await msg.edit("Test passed!")
```

### MTProto Actions

```python
# Get dialogs
dialogs = await app.mt_messages_get_dialogs(limit=50)

# Send reactions
await app.mt_messages_send_reaction(chat_id=..., msg_id=..., reaction="👍")

# Get chat members
members = await app.mt_channels_get_participants(chat_id=-10012345678, limit=200)

# Join channel
await app.mt_channels_join_channel(chat_id=-10012345678)
```

### Named Sessions (Multi-Account)

```python
worker1 = GoyGram(api_id=APP_ID, api_hash=APP_HASH, session_name="farm_1")
worker2 = GoyGram(api_id=APP_ID, api_hash=APP_HASH, session_name="farm_2")

await asyncio.gather(worker1.run(), worker2.run())
```

## Security Notes

- Your session is stored encrypted in `my_account.vault`
- Never share your `.vault` file — it contains your auth key
- Use `GOYGRAM_VAULT_KEY` env var for deterministic keying in CI/containers
- The framework zeroizes old `.session` files during migration

## Logging

```bash
GOYGRAM_LOG=DEBUG python userbot.py
```
