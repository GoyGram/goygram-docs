---
title: Event Objects
---

# Event Objects

GoyGram keeps event objects small. The original normalized dictionary is available as `raw`; fields that are not copied into the small fast path remain available through lazy lookup.

## `MsgObj`

Every message event has these common fields:

- `src`: `"mt"` or `"bot"`;
- `raw`: the complete normalized update and, for MTProto, the original decoded update;
- `app`: the owning `GoyGram` instance;
- `id` and `msg_id`: Telegram message ID;
- `chat_id`, `from_id`, `text`, and `is_me`;
- `cmd`, `args`, `match`, `finds`, and `parts` when a parsing filter populated them.

Message fields that vary by update type are available without a model registry or a large object allocation:

```python
@app.on_msg
async def inspect(msg):
    reply_to = msg.get("reply_to")
    entities = msg.entities
    media = msg.get("media")
    views = msg.get("views", 0)
    reactions = msg.get("reactions")
    thread = msg.get("reply_to_top_id")
```

`msg.field` and `msg.get("field", default)` first check the normalized event, then the original Bot API message or MTProto `message` constructor. This exposes fields such as `date`, `out`, `mentioned`, `media_unread`, `silent`, `post`, `from_scheduled`, `legacy`, `edit_date`, `pinned`, `noforwards`, `invert_media`, `offline`, `via_bot_id`, `reply_to`, `fwd_from`, `replies`, `reactions`, `restriction_reason`, `ttl_period`, `media`, `entities`, `reply_markup`, and future schema fields.

Use `msg["field"]` when a missing field should raise `KeyError`. `msg.to_dict()` returns the normalized raw dictionary without copying it.

Convenience methods:

- `await msg.reply(text, kbd=None, topic_id=None, link_options=None, **kw)` replies in the same chat;
- `await msg.respond(text, **kw)` sends a new message without replying to the source;
- `await msg.edit(text, **kw)` edits the source message;
- `await msg.forward_to(chat_id, **kw)` forwards the source message;
- `await msg.pin(disable_notification=False, **kw)` and `await msg.unpin(**kw)` manage pin state;
- `await msg.react(reaction, **kw)` sends a reaction;
- `await msg.download(destination=None)` downloads Bot API media when a `file_id` is available;
- `await msg.delete()` deletes this message.
- `msg.net()` returns the source transport.

## `CbObj`

Callback-query fields are `src`, `raw`, `app`, `id`, `chat_id`, `from_id`, `msg_id`, `data`, `text`, `match`, `payload`, and `json_data`. Any additional callback fields are available through attributes, `.get()`, or `[]`.

- `await cb.answer(text=None, alert=False, url=None, cache_time=0)` answers the callback;
- `await cb.edit(text, kbd=None, **kw)` edits the source Bot API message.

## `PollObj`

Poll fields are `src`, `raw`, `app`, `id`, `question`, `closed`, and `kind`. Poll-specific fields such as options, votes, correct answers, explanations, and poll-answer users remain in `raw` and are available through lazy attributes and `.get()`.

## `MemberObj`

Member fields are `src`, `raw`, `app`, `chat_id`, `from_id`, `user_id`, `old`, `new`, and `kind`. The complete member objects, privileges, custom title, and transition details remain in `raw` and are available through lazy attributes and `.get()`.

## `UpdateObj`

`on_update` receives `UpdateObj` for every structured event, including messages, edits, callbacks, polls, members, and updates without a specialized object. It preserves the constructor name and full raw payload:

```python
@app.on_update
async def any_update(update):
    print(update.update_type)
    print(update.get("message_id"))
    print(update.raw)
```

`update.type` and `update.update_type` are aliases. The object also supports `update["field"]`, `update.get(...)`, attributes for raw fields, and `update.to_dict()`.

Not every field exists on every Telegram update. Use `.get()` or filters for optional fields.
