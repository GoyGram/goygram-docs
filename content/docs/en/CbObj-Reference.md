---
title: CbObj Reference
---

# CbObj Reference

`CbObj` wraps callback query events from inline keyboard button presses. Bot API only.

## Class Definition

```python
class CbObj:
    __slots__ = ("src", "raw", "app", "id", "chat_id", "from_id",
                 "msg_id", "data", "text", "match", "payload", "json_data")

    def __init__(self, src, raw, app):
        self.src = src                    # almost always "bot"
        self.raw = raw                    # original event dict
        self.app = app                    # AppCore reference
        self.id = raw.get("query_id") or raw.get("id")  # callback query ID
        self.chat_id = raw.get("chat_id") # source chat ID
        self.from_id = raw.get("from_id") # user who pressed the button
        self.msg_id = raw.get("msg_id")   # message ID with the keyboard
        self.data = raw.get("data", "")   # callback_data from button
        self.text = raw.get("text", "")   # source message text
        self.match = None                 # set by cb_regex filter
        self.payload = None               # set by cb_payload filter
        self.json_data = None             # set by cb_json filter
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `str\|None` | Callback query ID (required for `answer`) |
| `chat_id` | `int\|str\|None` | Chat where the keyboard message lives |
| `from_id` | `int\|None` | User who pressed the button |
| `msg_id` | `int\|None` | Message ID of the keyboard message |
| `data` | `str` | `callback_data` value from the button |
| `text` | `str` | Text of the original message or caption |

## Filter-Injected Fields

These fields are `None` by default and populated by callback-specific filters:

| Field | Set By | Type | Description |
|-------|--------|------|-------------|
| `match` | `cb_regex` | `re.Match\|None` | Regex match on `callback_data` |
| `payload` | `cb_payload` | `tuple\|None` | Parsed `action:id:extra` payload |
| `json_data` | `cb_json` | `Any\|None` | Parsed JSON from `callback_data` |

### cb_payload Format

Parses `action:id:extra` colon-separated format:

```python
@app.on_cb(filt=filters.cb_payload("vote", "post_id"))
async def vote_cb(cb):
    # cb.payload == ("vote", "42", None) for callback_data "vote:42"
    action, post_id, extra = cb.payload
    await cb.answer(f"Voted on post {post_id}")
```

### cb_json

Parses `callback_data` as JSON:

```python
@app.on_cb(filt=filters.cb_json())
async def json_cb(cb):
    # cb.json_data == {"action": "delete", "id": 42}
    if cb.json_data["action"] == "delete":
        await cb.edit("Deleted")
```

## Methods

### `answer(text=None, alert=False, url=None, cache_time=0)`

Send a callback query answer. Telegram expects you to answer every callback query.

```python
await cb.answer("Got it!")                              # toast
await cb.answer("Error!", alert=True)                   # alert popup
await cb.answer("Open site", url="https://example.com") # open URL
```

### `edit(text, kbd=None, **kw)`

Edit the message that contained the keyboard.

```python
await cb.edit("Updated text")
await cb.edit("New text", kbd=new_keyboard)
```

Bot API only via `editMessageText`. Returns `None` if `chat_id` or `msg_id` is missing.

## Callback Filters

Full callback filtering system:

```python
# Exact match
@app.on_cb(filt=filters.cb_data("delete_confirm"))
async def delete_confirm(cb): ...

# Prefix match
@app.on_cb(filt=filters.cb_startswith("page_"))
async def pagination(cb): ...

# Regex
@app.on_cb(filt=filters.cb_regex(r"item_(\d+)"))
async def item_cb(cb):
    item_id = cb.match.group(1)

# Key-value pair format
@app.on_cb(filt=filters.cb_kvp("action", "delete"))
async def delete_action(cb): ...

# From specific user or chat
@app.on_cb(filt=filters.cb_from(OWNER_ID))
async def owner_cb(cb): ...

@app.on_cb(filt=filters.cb_chat(MY_GROUP))
async def group_cb(cb): ...
```

Multiple `on_cb` handlers fire in registration order. Use `StopPropagation` to prevent downstream handlers from processing the same callback.
