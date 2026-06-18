# Poll Handling

How poll events flow through GoyGram and the `PollObj` event type.

## Registration

```python
@app.on_poll()
async def poll_handler(poll):
    print(f"Poll: {poll.question}")
    if poll.closed:
        print("Poll is now closed")
```

## PollObj Reference

```python
class PollObj:
    __slots__ = ("src", "raw", "app", "id", "question", "closed", "kind")

    def __init__(self, src, raw, app):
        self.src = src                     # "bot" (Bot API only)
        self.raw = raw                     # original event dict
        self.app = app                     # AppCore reference
        self.id = raw.get("poll_id") or raw.get("id")
        self.question = raw.get("question", "")
        self.closed = bool(raw.get("is_closed", False))
        self.kind = raw.get("kind", "poll")
```

## Bot API Normalization

In `BotNet.norm()`:

```python
poll = upd.get("poll")
if isinstance(poll, dict):
    return {
        "kind": "poll",
        "src": "bot",
        "upd_id": upd.get("update_id"),
        "poll_id": poll.get("id"),
        "question": poll.get("question", ""),
        "is_closed": bool(poll.get("is_closed", False)),
        "raw": upd,
    }
```

## What's Available

| Property | Type | Description |
|----------|------|-------------|
| `id` | `str \| None` | Poll ID |
| `question` | `str` | Poll question text |
| `closed` | `bool` | Whether the poll is closed |
| `src` | `str` | Transport source (`"bot"`) |
| `raw` | `dict` | Full original update dict |

## What's NOT Extracted

The poll object does NOT extract:
- Poll options (available in `raw["poll"]["options"]`)
- Vote counts (available in `raw["poll"]["total_voter_count"]`)
- Poll type (quiz vs regular)
- Correct answers (for quizzes)

For full poll data, use `poll.raw["poll"]`.

## Dispatching

```python
# In Disp.one():
if kind == "poll":
    poll = PollObj(src, data, self.app)
    for fn in self.app.poll_hook:
        try:
            await fn(poll)
        except Exception as e:
            self.log.error("Handler failure: %r", e)
```

Poll handlers fire in registration order. All registered handlers fire for every poll update.

## Sending Polls

```python
# Via Bot API
await app.sendPoll(chat_id=..., question="Vote!",
                   options=["Option A", "Option B"],
                   is_anonymous=True)

# Via static wrapper
await app.send_poll(chat_id=..., question="Vote!", options=[...])
```

## Stopping Polls

```python
await app.stopPoll(chat_id=..., message_id=...)
```
