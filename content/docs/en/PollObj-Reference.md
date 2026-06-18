---
title: "PollObj Reference"
---

# PollObj Reference

`PollObj` represents polls from the Bot API.

## Structure

```python
class PollObj:
    __slots__ = ("src", "raw", "app", "id", "question", "closed", "kind")

    def __init__(self, src: str, raw: dict[str, Any], app: Any) -> None:
        self.src = src
        self.raw = raw
        self.app = app
        self.id = raw.get("poll_id") or raw.get("id")
        self.question = raw.get("question", "")
        self.closed = bool(raw.get("is_closed", False))
        self.kind = raw.get("kind", "poll")
```

## Fields

| Field | Source | Type |
|-------|--------|------|
| `id` | `poll.id` / `poll_id` | `str`/`int`/`None` |
| `question` | `poll.question` | `str` |
| `closed` | `poll.is_closed` | `bool` |
| `kind` | — | `"poll"` |

## Normalization from Bot API

`BotNet.norm()` extracts polls from updates:

```python
poll = upd.get("poll")
if isinstance(poll, dict):
    return {
        "kind": "poll",
        "src": "bot",
        "poll_id": poll.get("id"),
        "question": poll.get("question", ""),
        "is_closed": bool(poll.get("is_closed", False)),
        ...
    }
```

## on_poll() Handler

```python
app = GoyGram(bot_token="...")

@app.on_poll
async def handle_poll(poll: PollObj):
    if poll.closed:
        await app.bot.send_msg(poll.chat_id,
            f"Poll '{poll.question}' closed")
    else:
        await app.bot.send_msg(poll.chat_id,
            f"New poll: {poll.question}")
```

## Dispatching

In `Disp.one()`, events with `kind == "poll"` are routed to `poll_hook`:

```python
if kind == "poll":
    poll = PollObj(pkt.get("src", "sys"), data, self.app)
    for fn in list(getattr(self.app, "poll_hook", [])):
        try:
            await fn(poll)
        except Exception as e:
            self.log.error("Handler failure: %r", e)
```
