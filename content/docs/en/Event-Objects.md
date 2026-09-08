---
title: Event Objects
---

# Event Objects

GoyGram uses one dynamic `Obj` for every event kind. The normalized dictionary is available as `raw`; fields that are not copied into the fast path remain available through lazy attribute lookup, `.get()`, and `[]`.

`MsgObj`, `CbObj`, `PollObj`, `MemberObj`, `UpdateObj`, and `InlineObj` are all aliases of the same `goygram.types.Obj`. There is no per-kind class and no model registry — the object is shaped by the event it carries, and `kind` (`"msg"`, `"cb"`, `"poll"`, `"member"`, `"inline"`, `"update"`, `"edit"`) tells the dispatch layer which path to use.

## Common fields

Every event object has these attributes:

- `src`: `"mt"` or `"bot"`;
- `raw`: the complete normalized update and, for MTProto, the original decoded update;
- `app`: the owning `GoyGram` instance;
- `id`, `chat_id`, `from_id`, `msg_id`, and `kind`;
- `text`, `data`, `query`, `cmd`, `args`, and `match` where the event provides them;
- `inline_message_id` for callbacks that arrive from an inline-mode message.

Event fields that vary by update type are available without a model registry or a large object allocation:

```python
@app.on_msg
async def inspect(msg):
    reply_to = msg.get("reply_to")
    entities = msg.entities
    media = msg.get("media")
    views = msg.get("views", 0)
```

`msg.field` and `msg.get("field", default)` first check the normalized event, then the original Bot API message or MTProto `message` constructor — including future schema fields. Use `msg["field"]` when a missing field should raise `KeyError`. `msg.to_dict()` returns the normalized raw dictionary without copying it.

## Inline mode and callbacks

Inline-mode messages do not live in a chat the bot can address with `chat_id` + `message_id`. Telegram identifies them with `inline_message_id`, and `Obj` keeps it as a first-class field:

```python
@app.on_inline
async def inline_results(e):
    await e.answer(results=[
        e.article("r1", "Title", "text", kbd=[
            [{"text": "Press", "callback_data": "go"}],
        ]),
    ])

@app.on_cb
async def button(cb):
    if cb.inline_message_id is not None:
        await cb.edit("edited in the inline message")
    await cb.answer()
```

`e.article()` puts `reply_markup` at the result level where the Bot API expects it, and wraps a raw list of button rows into `{"inline_keyboard": ...}` for you.

`await cb.edit(text, kbd=None, **kw)` edits the message the button is attached to: through `inline_message_id` for inline messages, or through `chat_id` + `message_id` for regular messages. If no Bot API client is configured, `edit()` raises `RuntimeError` instead of silently doing nothing.

`await cb.answer(text=None, alert=False, url=None, cache_time=0)` answers the callback. For inline queries, `await e.answer(results=[...], cache_time=0)` answers the inline query itself.

## Message convenience methods

- `await msg.reply(text, kbd=None, topic_id=None, link_options=None, **kw)` replies in the same chat;
- `await msg.respond(text, **kw)` sends a new message without replying to the source;
- `await msg.edit(text, **kw)` edits the source message;
- `await msg.forward_to(chat_id, **kw)` forwards the source message;
- `await msg.pin(disable_notification=False, **kw)` and `await msg.unpin(**kw)` manage pin state;
- `await msg.react(reaction, **kw)` sends a reaction;
- `await msg.download(destination=None)` downloads Bot API media when a `file_id` is available;
- `await msg.delete()` deletes this message.
- `msg.net()` returns the source transport.

## Member transitions

Member events expose `old` and `new` statuses (`old_status` / `new_status` in the raw payload), plus `user_id` and `chat_id`. The complete member objects, privileges, custom title, and transition details remain in `raw` and are available through lazy attributes and `.get()`.

## `on_update`

`on_update` receives the same `Obj` for every structured event, including messages, edits, callbacks, polls, members, and updates without a specialized kind. It preserves the constructor name and full raw payload:

```python
@app.on_update
async def any_update(update):
    print(update.update_type)
    print(update.raw)
```

`update.type` and `update.update_type` are aliases. Not every field exists on every Telegram update. Use `.get()` or filters for optional fields.
