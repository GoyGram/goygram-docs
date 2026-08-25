---
title: Quick Start Bot API
---

# Quick Start — Bot API

```python
import asyncio
from goygram import GoyGram

app = GoyGram(bot_token="123456:bot_token")

@app.on_cmd("start")
async def start(msg):
    await msg.reply("Hello from GoyGram")

if __name__ == "__main__":
    asyncio.run(app.run())
```

`run()` uses long polling. Before polling, GoyGram attempts to remove a webhook with `drop_pending_updates=False`; do not keep another poller active for the same bot.

Handlers receive a normalized message object. See [Handlers and updates](/docs/Handlers-and-Updates) and [Bot API calls](/docs/Bot-API-Calls).
