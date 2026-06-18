---
title: Dispatcher and Handler Pipeline
---

# Dispatcher & Handler Pipeline

The dispatcher (`goygram/core/disp.py`) is the event router. It consumes raw dicts from the bus, wraps them in typed event objects, and fires registered handlers with `StopPropagation` flow control.

## Dispatcher Implementation

```python
class Disp:
    def __init__(self, app, bus):
        self.app = app       # AppCore reference
        self.bus = bus       # Bus reference
        self.stop_ev = asyncio.Event()
```

### The Main Loop: `consume()`

```python
async def consume(self):
    while not self.stop_ev.is_set():
        pkt = await self.bus.fetch()
        await self.one(pkt)
```

Infinite loop: fetch from bus → dispatch. Runs as an asyncio task.

### The Router: `one()`

This is where the event kind determines the handler path:

```python
async def one(self, pkt):
    data = pkt.get("data")
    if not isinstance(data, dict):
        return

    kind = data.get("kind")

    if kind == "err":
        self.log.warning("Disp error event: %s", data.get("text", ""))
        return
```

Error events (`kind: "err"`) are logged and dropped — they don't fire handlers.

**Message events:**

```python
    if kind == "msg":
        msg = MsgObj(pkt.get("src", "sys"), data, self.app)
        for fn in list(self.app.hook):          # on_msg handlers
            try:
                await fn(msg)
            except StopPropagation:
                return
            except Exception as e:
                self.log.error("Handler failure: %r", e)

        for fn in list(getattr(self.app, "update_hook", [])):  # on_update handlers
            try:
                await fn(msg)
            except StopPropagation:
                return
            except Exception as e:
                self.log.error("Handler failure: %r", e)
```

**Callback, Poll, and Member events** follow the same pattern with their respective hook lists — first typed handlers, then `update_hook` catch-all.

## Handler Groups and Execution Order

| Event Kind | Handler Group 1 | Handler Group 2 |
|-----------|----------------|-----------------|
| `"msg"` | `hook` (on_msg) | `update_hook` (on_update) |
| `"cb"` | `cb_hook` (on_cb) | `update_hook` (on_update) |
| `"poll"` | `poll_hook` (on_poll) | `update_hook` (on_update) |
| `"member"` | `member_hook` (on_member) | `update_hook` (on_update) |

**Key behavior:**
1. Typed handlers fire first, then `update_hook` catch-all handlers
2. Handlers within each group fire in **registration order**
3. `StopPropagation` stops the **current group** — it does not stop the next group
4. A `StopPropagation` from an `on_msg` handler stops the rest of `hook` but `update_hook` still fires
5. Unknown `kind` values are silently dropped

## StopPropagation Flow Control

```python
from goygram import StopPropagation

@app.on_msg(filt=filters.text)
async def guard(msg):
    if msg.text == "stop":
        raise StopPropagation
    await msg.reply("Processing...")

@app.on_msg(filt=filters.text)
async def second(msg):
    # Won't fire if guard raised StopPropagation
    await msg.reply("Second handler")

@app.on_update(filt=filters.update_type("msg"))
async def catch_all(event):
    # STILL fires — StopPropagation only stops hook, not update_hook
    await msg.reply(event.chat_id, "Caught in update_hook")
```

`StopPropagation` is caught per handler group loop. It exits the current group but the next group proceeds normally.

## Event Object Construction

| Event Kind | Object Class | Source File |
|-----------|-------------|-------------|
| `"msg"` | `MsgObj` | `goygram/types/msg.py` |
| `"cb"` | `CbObj` | `goygram/types/cb.py` |
| `"poll"` | `PollObj` | `goygram/types/poll.py` |
| `"member"` | `MemberObj` | `goygram/types/member.py` |

All objects receive `(src, raw, app)` — the transport source string, the normalized dict, and an `AppCore` reference.

## Filter Integration

Filters wrap handlers at registration time (in `AppCore.on_msg`, `on_cb`, etc.):

```python
def on_msg(self, fn=None, filt=None):
    def wrap(inner):
        if filt is None:
            self.hook.append(inner)
            return inner
        async def guarded(msg):
            if filt(msg):
                return await inner(msg)
            return None
        self.hook.append(guarded)
        return inner
```

If a filter returns `False`, the handler returns `None` — it doesn't raise `StopPropagation`, so subsequent handlers still run.

## Error Resilience

Every handler call is individually wrapped:

```python
for fn in list(self.app.hook):
    try:
        await fn(msg)
    except StopPropagation:
        return
    except Exception as e:
        self.log.error("Handler failure: %r", e)
        await self.bus.push("sys", {
            "kind": "err", "src": "disp", "text": repr(e)
        })
```

One handler's crash never kills the dispatcher. The `list()` copy prevents issues if handlers modify hook lists during iteration.

## Lifecycle

```python
# Startup (in AppCore.run())
tasks.append(asyncio.create_task(self.disp.consume(), name="disp"))

# Shutdown (in AppCore.close())
await self.disp.close()
```

`close()` sets `stop_ev`, causing `consume()` to exit. The task is then cancelled and awaited.
