---
title: Webhook Management
---

# Webhook Management

GoyGram supports Bot API webhooks alongside its default long-polling mode. Three dedicated methods are available.

## Setting a Webhook

```python
await app.set_webhook("https://myserver.com/webhook")
# or with options:
await app.set_webhook(
    "https://myserver.com/webhook",
    certificate=open("cert.pem", "rb").read(),
    max_connections=40,
    allowed_updates=["message", "callback_query"],
    secret_token="my_secret"
)
```

## Deleting a Webhook

```python
# Delete and drop any pending updates (delivered during downtime)
await app.delete_webhook(drop_pending_updates=True)

# Delete but keep pending updates (delivered on next poll)
await app.delete_webhook(drop_pending_updates=False)
```

## Querying Webhook Info

```python
info = await app.get_webhook_info()
# info contains: url, has_custom_certificate, pending_update_count,
#                last_error_date, last_error_message, max_connections,
#                allowed_updates
```

## Webhook Conflict Auto-Resolution

During `BotNet.spin()`, if the server returns HTTP 409 (Conflict) on `getUpdates`, GoyGram **automatically deletes** any existing webhook:

```python
if r.status == 409 and m == "getUpdates":
    await self.req("deleteWebhook", {"drop_pending_updates": False})
    self.log.error("Webhook conflict detected. Webhook deleted and polling will retry.")
    return []
```

This also runs at startup (`delete_webhook(drop_pending_updates=False)`) before the polling loop begins.

**Warning**: If you have a webhook set up elsewhere (e.g., a production server), GoyGram will delete it without confirmation. Either disable the bot token in GoyGram or explicitly handle webhook configuration before calling `run()`.

## Implementation

All three methods delegate to `bot_req`:

```python
async def set_webhook(self, url, **kw):
    return await self.bot_req("setWebhook", url=url, **kw)

async def delete_webhook(self, drop_pending_updates=False):
    return await self.bot_req("deleteWebhook",
                              drop_pending_updates=drop_pending_updates)

async def get_webhook_info(self):
    return await self.bot_req("getWebhookInfo")
```

These are Bot API-only methods — MTProto has no webhook concept.

## Webhook vs Polling

GoyGram is designed primarily for polling (`getUpdates` in a loop). The webhook methods exist for compatibility but there's no built-in webhook server — you'd need to handle incoming webhook POSTs in your own HTTP server (FastAPI, aiohttp, Flask, etc.) and manually dispatch events to your handlers.
