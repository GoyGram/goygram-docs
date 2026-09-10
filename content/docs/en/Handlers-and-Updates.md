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

After a `command(...)` filter matches, the parsed parts are available directly on the event: `msg.cmd` is the command name without the prefix, and `msg.args` is the remaining text after it.

```python
@app.on_cmd("ping")
async def ping(msg):
    await msg.reply(f"pong, {msg.cmd} got args: {msg.args!r}")
```

## Handler groups

Register handlers under a named group when you want to enable or remove a whole feature set at once. The group proxies every registration method:

```python
g = app.group("admin")

@g.on_msg(filt=F.from_user == OWNER_ID)
async def admin_only(msg): ...

@g.on_cmd("restart")
async def restart(msg): ...

g.disable()     # all admin handlers stop matching
g.enable()      # they come back
g.clear()       # remove them permanently
```

Groups are plain lists of registered hooks — no wrapper classes, no extra dispatch layers. A disabled group skips its handlers before filters run.

## One-shot handlers

Any registration accepts `once=True` to fire a single time, and `once=` also accepts a group name so a handler removes itself together with the group:

```python
@app.on_msg(filt=F.text == "!confirm", once=True)
async def confirm_once(msg): ...
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

Typed fields are extracted for the important update families before raw fallback: typing (user/chat/channel), stories, folder and dialog-filter changes, boosts, message reactions, join requests, drafts, pinned messages, read-history events, user status/name/phone, and service notifications. An unknown constructor still arrives with `update_type` and the full `raw` payload — nothing is discarded:

```python
@app.on_update(filt=filters.update_type("updateStory"))
async def story(update):
    print(update.owner_id, update.story_id, update.raw)

@app.on_update(filt=filters.update_type("updateUserTyping"))
async def typing(update):
    print(update.user_id, update.typing_kind, update.action)
```

## Update recovery

If the connection drops or the server sends `updatesTooLong`, GoyGram heals itself: `getDifference` runs in a slice loop (`differenceSlice` follows until a final `difference`/`differenceTooLong`), so a gap of any size is drained without losing events. Channels are tracked per-channel: on `updateChannelTooLong` or a version gap, `getChannelDifference` fetches exactly what that channel is missing. Nothing is configured — recovery is automatic on every MTProto connection.

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
