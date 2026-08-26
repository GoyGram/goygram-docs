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

`run()` uses long polling by default. Before polling, GoyGram removes an existing webhook with `drop_pending_updates=False`; do not run another poller for the same bot.

## Use a webhook

Set `webhook_url` to the public HTTPS address that Telegram can reach:

```python
app = GoyGram(
    bot_token="[REDACTED]",
    webhook_url="https://bot.example.com/telegram/webhook",
    webhook_host="127.0.0.1",
    webhook_port=8080,
    webhook_path="/telegram/webhook",
    webhook_secret_token="[REDACTED]",
)
```

In this mode `run()` starts an HTTP listener, registers the webhook with Telegram, and sends updates to the same handlers as polling. It does not start `getUpdates`. Put TLS in your reverse proxy and forward requests to `webhook_host:webhook_port`. Telegram must send the secret in `X-Telegram-Bot-Api-Secret-Token`; requests with a wrong secret are rejected. On shutdown GoyGram removes the webhook it registered.

Handlers receive a normalized message object. See [Handlers and updates](/docs/Handlers-and-Updates) and [Bot API calls](/docs/Bot-API-Calls).
