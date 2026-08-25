---
title: Keyboards Formatting and State
---

# Keyboards, Formatting, and State

## Keyboards

Create builders from the application:

```python
keyboard = app.ikb().btn("Open", url="https://example.com").row().btn("Ping", callback_data="ping")
await app.send_message(chat_id=123, text="Choose:", reply_markup=keyboard.build())
```

- `app.ikb()` creates an inline keyboard builder.
- `app.rkb(**opts)` creates a reply keyboard builder.
- `app.frk(**opts)` creates a force-reply builder.
- `app.rgk(**opts)` creates a remove-keyboard builder.

`KbdBuilder` supports `btn()`, `row()`, `build()`, and `to_dict()`. Button fields are passed through to the selected Telegram keyboard type.

## Formatting

Use `app.html(text)` or `app.md(text)` when a call accepts `text` and `parse_mode`:

```python
await app.send_message(chat_id=123, **app.html("<b>Hello</b>"))
```

## State

State is an in-memory raw key/value store indexed by `(chat_id, user_id)`:

```python
app.set_state(msg.chat_id, msg.from_id, "awaiting_name", {"step": 1}, ttl=300)
state = app.get_state(msg.chat_id, msg.from_id)
data = app.get_state_data(msg.chat_id, msg.from_id)
app.clear_state(msg.chat_id, msg.from_id)
```

A TTL expires the entry. Persistent workflows and conversation routing are application responsibilities.
