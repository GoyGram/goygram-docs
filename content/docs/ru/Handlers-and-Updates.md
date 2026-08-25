---
title: "Handlers and Updates"
---

# Handlers and Updates

Register asynchronous functions before `run()`.


```python
@app.on_msg
async def every_message(msg):
    print(msg.text)

@app.on_msg(filt=filters.text & ~filters.me)
async def incoming_text(msg):
    await msg.reply("received")

@app.on_cmd("help", "about")
async def help_command(msg):
    await msg.reply("Commands are case-insensitive by default.")
```


## Handler registration

- `app.on_msg(fn=None, filt=None)` receives `MsgObj`.
- `app.on_cb(fn=None, *, filt=None)` receives `CbObj` callback-query events.
- `app.on_poll(fn=None, *, filt=None)` receives `PollObj` poll-answer events.
- `app.on_member(fn=None, *, filt=None)` receives `MemberObj` member-status events.
- `app.on_update(fn=None, *, filt=None)` receives the raw normalized update object.
- `app.on_cmd(*names)` is shorthand for `on_msg(filt=command(*names))`.

All handlers must be `async def`. A filter is evaluated before its handler; non-matching handlers do nothing. Multiple matching handlers may run for an update.

## Message object

`MsgObj` exposes `src`, `raw`, `app`, `id` (also available as `msg_id`), `chat_id`, `from_id`, `text`, `is_me`, `cmd`, `args`, `match`, `finds`, and `parts`. Command, regex, and text-search filters populate the parsing/match fields when they match.

Convenience methods:

- `await msg.reply(text, kbd=None, topic_id=None, link_options=None, **kw)` replies in the same chat.
- `await msg.delete()` deletes this message.

`CbObj`, `PollObj`, and `MemberObj` are likewise normalized event containers. Consult [Event objects](/ru/docs/Event-Objects) for their available fields.