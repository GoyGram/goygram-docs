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

Send `/ping` or `!ping` from the authorized account. `filters.me` limits this handler to outgoing messages from that account.

## What happens at startup

1. GoyGram selects a Telegram data center, then creates or resumes `my_first_userbot.vault`.
2. With no valid authorization key, it prompts for a phone number and login code; Telegram 2FA may also be requested.
3. It starts the MTProto reader and dispatches incoming updates to registered handlers.

Call `app.stop()` from a handler or cancel the task to end `app.run()` cleanly.

See [[Sessions-and-Authentication|Sessions and authentication]], [[Handlers-and-Updates|Handlers and updates]], and [[MTProto-Calls|MTProto calls]].
