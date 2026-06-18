---
title: Split Brain Design
---

# Split-Brain Design

The "split-brain" is GoyGram's defining architectural pattern: **two completely independent transport implementations feeding a single unified event pipeline.** The Python layer makes this feel seamless; the internals are aggressively separated.

## Why "Split-Brain"?

Because each transport has its own connection lifecycle, its own update loop, its own serialization format, and its own error handling — yet they converge on the same `asyncio.Queue` and the same handler dispatch. The right half (Bot API / HTTP) doesn't know the left half (MTProto / TCP) exists. They're two brains in one body.

## The Convergence Point

```python
# Both transports push to the SAME bus
# botapi.py:
await self.bus.push("bot", {"kind": "msg", ...})

# mtproto.py:
asyncio.ensure_future(self.bus.push("mt", {"kind": "msg", ...}))

# disp.py consumes from the SAME queue regardless of source
pkt = await self.bus.fetch()
```

The `src` field (`"bot"` or `"mt"`) is preserved in the event object (`MsgObj.src`) so handlers can distinguish if needed. But by default, handlers fire for both.

## Dual Transport Boot Sequence

When `app.run()` is called with both transports configured:

```
1. disp.consume() task starts (waiting on bus)
2. bot.spin() task starts (long-polling getUpdates)
3. mt.spin() task starts (reading TCP socket)
4. bootstrap_session() restores MTProto auth from vault
5. mt_req('get_state') syncs update state
6. Event loop waits on stop_ev
7. Both transports push events → Bus → Disp → Handlers
```

## Single Transport Mode

GoyGram works perfectly with just one transport:

```python
# Pure Bot API (no api_id/api_hash)
app = GoyGram(bot_token="123:ABC")

# Pure MTProto (no bot_token)
app = GoyGram(api_id=123, api_hash="abc")
```

In single-transport mode, the `via()` method (which determines routing) simply picks the only available transport. No special-casing needed.

## Transport-Aware Routing

Messages can be sent with explicit transport preference:

```python
# Force Bot API route
await app.bot.send_msg("bot:123456789", "via bot", via="bot")

# Force MTProto route
await app.bot.send_msg("mt:123456789", "via mt", via="mt")

# Chat ID prefix inference
await app.bot.send_msg("bot:123456789", "prefix routes to bot")
await app.bot.send_msg("mt:123456789", "prefix routes to mt")
```

The `via()` method resolves the transport:

```python
def via(self, chat_id, via=None):
    if via in {"bot", "mt"}:
        return via  # explicit override
    if chat_id.startswith("bot:"):
        return "bot"  # prefix inference
    if chat_id.startswith("mt:"):
        return "mt"
    # Default: bot first, mt fallback
    if self.bot is not None:
        return "bot"
    if self.mt is not None:
        return "mt"
```

## What Each Transport Does Differently

| Feature | Bot API | MTProto |
|---------|---------|---------|
| Message entity parsing | Native JSON entities | HTML→TL entity conversion in Python |
| File upload | aiohttp FormData (multipart) | TL-serialized upload.file |
| Update mechanism | `getUpdates` long-poll (25s timeout) | Persistent TCP read loop |
| Webhook conflict | Auto-clears on 409 | N/A |
| Keyboard format | `reply_markup` key in JSON | TL-serialized `ReplyMarkup` |
| Topic management | Forum topic Bot API methods | TL `ForumTopic` constructors |
| Error format | `{"ok": false, ...}` in JSON | TL `RpcError` constructor |
| DC migration | N/A (Telegram handles it) | Dynamic reconnection on `*_MIGRATE_*` |

## The Cost of Split-Brain

1. **Code duplication**: `BotNet` has its own `send_msg()` with Bot API-specific parameter formatting (reply_parameters, reply_markup, message_thread_id). MTProto message sending goes through `mt_req("messages.sendMessage", ...)` directly. There is no unified `send_msg` on `AppCore` — callers must use transport-appropriate APIs.
2. **Normalization burden**: Bot API events come as JSON dicts; MTProto events come as TL-serialized bytes. Both must be normalized to the same `{"kind": ..., "msg_id": ..., ...}` dict format before hitting the bus.
3. **Feature gap**: Some operations only work on one transport (e.g., `edit_text` requires Bot API; `get_dialogs` requires MTProto). The framework handles this by raising `RuntimeError` when you try the impossible.

## Design Intent

This architecture exists because **nothing else gives you both transports in the same handler function.** Traditional frameworks force you to pick one. GoyGram lets you run a bot AND a user account in the same process, sharing handlers, sharing state, sharing the event loop. That's the split-brain value proposition.
