---
title: Quick Start MTProto Userbot
---

# Quick Start — MTProto Userbot

This is the minimal userbot application. The first run performs interactive Telegram authorization if the named vault does not already contain a valid session.

```python
import asyncio
from goygram import GoyGram, filters
from goygram.filters import command

app = GoyGram(
    api_id=123456,
    api_hash="your_api_hash",
    session_name="my_first_userbot",
)

@app.on_msg(filt=command("ping") & filters.me)
async def ping_handler(msg):
    await msg.reply("Pong!")

if __name__ == "__main__":
    asyncio.run(app.run())
```

Send `/ping` from the authorized account. `filters.me` limits this handler to outgoing messages from that account.

## What happens at startup

1. GoyGram selects a Telegram data center, then creates or resumes `my_first_userbot.vault`.
2. With no valid authorization key, it prompts for a phone number and login code; Telegram 2FA may also be requested.
3. It starts the MTProto reader and dispatches incoming updates to registered handlers.

Call `app.stop()` from a handler or cancel the task to end `app.run()` cleanly.

## Bot over MTProto (auth.importBotAuthorization)

A bot can skip the Bot API HTTP transport and run over raw MTProto. Pass `bot_token` together with `api_id`/`api_hash` and GoyGram authorizes the bot through `auth.importBotAuthorization`:

```python
import asyncio
from goygram import GoyGram
from goygram.filters import command

app = GoyGram(
    bot_token="123456:ABC_TOKEN",
    api_id=123456,
    api_hash="your_api_hash",
    default_transport="mtproto",   # prefer MTProto for outgoing calls
)

@app.on_msg(filt=command("ping"))
async def ping_handler(msg):
    await msg.reply("pong via MTProto")

if __name__ == "__main__":
    asyncio.run(app.run())
```

Both transports remain available in one runtime. Switch per call with `via="api"` (Bot API) or `via="mtproto"` (MTProto):

```python
await app.send_msg("123456789", "via Bot API", via="api")
await app.send_msg("123456789", "via MTProto", via="mtproto")
```

`default_transport` accepts `"api"`, `"mtproto"`, or `"auto"` (Bot API if a token is present, otherwise MTProto).

See [[Sessions-and-Authentication|Sessions and authentication]], [[Handlers-and-Updates|Handlers and updates]], and [[MTProto-Calls|MTProto calls]].
