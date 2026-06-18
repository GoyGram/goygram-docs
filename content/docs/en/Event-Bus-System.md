---
title: "Event Bus System"
---

# Event Bus System

The event bus is the simplest component in GoyGram — and that's entirely intentional. It's a thin wrapper around `asyncio.Queue` with exactly one constraint: events must be `{"src": str, "data": dict}` dicts.

## Bus Implementation

```python
# goygram/core/bus.py
class Bus:
    def __init__(self, maxsize: int = 0) -> None:
        self.q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=maxsize)

    async def push(self, src: str, data: dict[str, Any]) -> None:
        await self.q.put({"src": src, "data": data})

    async def fetch(self) -> dict[str, Any]:
        return await self.q.get()
```

### The `src` Field

The source identifies which transport produced the event:

| `src` Value | Meaning |
|-------------|---------|
| `"bot"` | Event from Bot API transport (`BotNet`) |
| `"mt"` | Event from MTProto transport (`MTNet`) |
| `"sys"` | Internal system event (errors, etc.) |

The `src` value propagates through to `MsgObj.src`, `CbObj.src`, etc., and is used by the `via()` method to determine which transport handles replies.

### The `data` Field

A dict with at minimum a `"kind"` key. The full event schema:

```python
# Message event
{"kind": "msg", "msg_id": int, "chat_id": int|str, "from_id": int,
 "text": str, "raw": {...}, "is_me": bool}

# Callback query event
{"kind": "cb", "query_id": str, "chat_id": int, "from_id": int,
 "msg_id": int, "data": str, "text": str, "raw": {...}}

# Poll event
{"kind": "poll", "poll_id": str, "question": str,
 "is_closed": bool, "raw": {...}, "upd_id": int}

# Member/Chat member event
{"kind": "member", "chat_id": int, "from_id": int, "user_id": int,
 "old_status": str, "new_status": str, "raw": {...}}
```

### maxsize Configuration

```python
app = GoyGram(bot_token="...", bus_max=0)  # default: unlimited queue
app = GoyGram(bot_token="...", bus_max=100)  # bounded: backpressure on producers
```

With `maxsize=0`, the queue is unbounded. With a positive value, `bus.push()` will block (await) when the queue is full, applying backpressure to transport producers. This is rarely needed but exists for memory-constrained environments.

## Event Flow

```
BotNet.spin() ──→ bus.push("bot", data)
                              │
MTNet.spin() ──→ bus.push("mt", data)   (via asyncio.ensure_future)
                              │
                              ▼
                      ┌─────────────┐
                      │  asyncio.Q  │
                      └──────┬──────┘
                             │
                    Disp.consume() ──→ bus.fetch()
                             │
                             ▼
                       Disp.one(pkt)
                             │
                    ┌────────┼────────┐
                    │        │        │
                   msg      cb      poll   member
```

## Error Events

The dispatcher pushes error events to the bus when handlers fail:

```python
# disp.py — inside exception handler in one()
await self.bus.push("sys", {
    "kind": "err",
    "src": "disp",
    "text": repr(e)
})
```

These have `kind: "err"` and `src: "sys"`. In `Disp.one()`, error events are explicitly routed:

```python
if kind == "err":
    self.log.warning("Disp error event: %s", data.get("text", ""))
    return
```

They are logged at WARNING level via Python's logging system and then dropped — they don't accumulate in the queue and don't fire any handlers.

## Internal vs External Push

- **Externally**: Only `BotNet` and `MTNet` push events. They push normalized dicts (not raw API responses).
- **Internally**: The dispatcher pushes error events. The transports push heartbeat/sync events (like webhook conflicts).

## Thread Safety

The bus is **not thread-safe** — it's designed for asyncio. All producers and consumers run on the same event loop. If you need multi-thread access, wrap it yourself.
