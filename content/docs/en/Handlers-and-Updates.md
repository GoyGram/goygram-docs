---
title: Handlers and Updates
---

# Handlers and Updates

Register asynchronous functions before `run()`.

```python
@app.on_msg
async def every_message(msg):
    print(msg.text)

@app.on_edit
async def every_edit(msg):
    print("edited:", msg.id, msg.text)

@app.on_update
async def every_other_update(update):
    print(update.update_type)

@app.on_msg(filt=filters.text & ~filters.me)
async def incoming_text(msg):
    await msg.reply("received")

@app.on_cmd("help", "about")
async def help_command(msg):
    await msg.reply("Commands are case-insensitive by default.")
```

## Handler registration

- `app.on_msg(fn=None, filt=None)` receives new `MsgObj` events;
- `app.on_edit(fn=None, filt=None)` receives edited `MsgObj` events;
- `app.on_cb(fn=None, *, filt=None)` receives callback-query events;
- `app.on_poll(fn=None, *, filt=None)` receives poll-answer events;
- `app.on_member(fn=None, *, filt=None)` receives member-status events;
- `app.on_update(fn=None, *, filt=None)` receives every structured event as `UpdateObj`; specialized hooks still run after it;
- `app.on_cmd(*names)` is shorthand for `on_msg(filt=command(*names))`.

All handlers must be `async def`. A filter is evaluated before its handler; non-matching handlers do nothing. Multiple matching handlers may run for one update. A handler exception is isolated and does not stop the reader or other handlers.

## MTProto update coverage

The runtime uses the loaded Telegram TL schema dynamically. It recognizes the update containers `updates`, `updatesCombined`, `updateShort`, `updateShortMessage`, `updateShortChatMessage`, `updateShortSentMessage`, `msg_container`, and gzip-packed payloads. Message updates are classified as new or edited messages; all other structured constructors keep their original constructor name and payload in `UpdateObj`. `on_update` receives every event before its specialized hook.

The official layer currently exposes more than 150 update constructors. You do not need a Python class for every constructor: use the generic path and access fields lazily:

```python
from goygram import filters

@app.on_update(filt=filters.update_type("updateMessageReactions"))
async def reactions(update):
    message_id = update.get("msg_id") or update.get("message_id")
    print(update.raw)
```

For message events, fields not needed by the fast path are not copied. Access them from the original update:

```python
@app.on_edit
async def changed(msg):
    print(msg.get("edit_date"))
    print(msg.get("entities"))
    print(msg.get("reply_markup"))
    print(msg.get("reactions"))
```

This keeps memory use and dispatch latency low while retaining the complete structured update.

## Event ordering

The dispatcher preserves the order in which updates are decoded. New messages and edits use separate hooks. Non-message constructors go to `on_update` exactly once. Unknown valid constructors remain generic instead of being silently discarded.

## Message object

`MsgObj` provides common fields such as `id`, `chat_id`, `from_id`, `text`, and `is_me`. It also supports `msg.field`, `msg.get("field", default)`, `msg["field"]`, and `msg.raw` for Telegram-specific fields. See [Event objects](/docs/Event-Objects) for the full lazy-field contract.
