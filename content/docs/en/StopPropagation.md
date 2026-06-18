---
title: "StopPropagation"
---

# StopPropagation

`StopPropagation` is a flow control exception that stops the handler chain for the current event. It's the mechanism for saying "I handled this — nobody else needs to."

## Basic Usage

```python
from goygram import StopPropagation

@app.on_msg(filt=filters.text)
async def guard(msg):
    if msg.text == "secret":
        raise StopPropagation  # no more message handlers for this event
    await msg.reply("Processing...")

@app.on_msg(filt=filters.text)
async def fallback(msg):
    # Won't fire if guard raised StopPropagation
    await msg.reply("Fallback handler")
```

## Scope

`StopPropagation` only affects the **current handler group** within `Disp.one()`:

```python
# In disp.py:
if kind == "msg":
    msg = MsgObj(...)
    for fn in list(self.app.hook):          # Group 1: on_msg handlers
        try:
            await fn(msg)
        except StopPropagation:
            return   # ← exits Group 1, but Group 2 still runs
        except Exception as e:
            ...

    for fn in list(self.app.update_hook):   # Group 2: on_update handlers
        try:
            await fn(msg)
        except StopPropagation:
            return   # ← exits Group 2
        except Exception as e:
            ...
```

### What StopPropagation Stops

| Raised In | Stops | Does NOT Stop |
|-----------|-------|---------------|
| `on_msg` handler | Other `on_msg` handlers | `on_update` handlers |
| `on_cb` handler | Other `on_cb` handlers | `on_update` handlers |
| `on_poll` handler | Other `on_poll` handlers | `on_update` handlers |
| `on_member` handler | Other `on_member` handlers | `on_update` handlers |
| `on_update` handler | Other `on_update` handlers | — |

Key insight: `update_hook` always fires after typed handlers. A `StopPropagation` from an `on_msg` handler only stops the message handler chain — the `on_update` catch-all handlers still run.

## Use Cases

### Command Guard

Prevent overlapping command handlers:

```python
@app.on_cmd("admin")
async def admin_guard(msg):
    if msg.from_id not in ADMINS:
        raise StopPropagation
    await msg.reply("Welcome, admin")

@app.on_cmd("admin")
async def admin_actual(msg):
    # Only reaches here for actual admins
    await msg.reply("Admin panel: ...")
```

### Filtered Routing

```python
@app.on_msg(filt=filters.photo)
async def photo_handler(msg):
    raise StopPropagation  # handled by photo system, stop here

@app.on_msg(filt=filters.text)
async def text_handler(msg):
    await msg.reply("Text message received")
```

### Callback Routing

```python
@app.on_cb(filt=filters.cb_data("confirm_delete"))
async def confirm_delete(cb):
    await delete_something(cb.msg_id)
    await cb.edit("Deleted")
    raise StopPropagation

@app.on_cb(filt=filters.cb_startswith("confirm_"))
async def generic_confirm(cb):
    await cb.answer("Unknown confirmation")
```

## Comparison with Filter Returns

| Mechanism | Effect |
|-----------|--------|
| Filter returns `False` | Skips THIS handler only; next handlers still run |
| `raise StopPropagation` | Stops ALL handlers in the current group |

Filters are per-handler opt-in. `StopPropagation` is a group-wide abort.

## Inheritance

`StopPropagation` inherits from `GoyGramError`, which inherits from `Exception`. You can catch it:

```python
@app.on_msg()
async def wrapper(msg):
    try:
        await inner_handler(msg)
    except StopPropagation:
        # Don't re-raise — this stops propagation at the wrapper level
        pass
```

But usually you shouldn't catch it — let the dispatcher handle it.

## Not an Error

`StopPropagation` is **not logged as an error** — it's explicitly caught before the generic `except Exception` block in the dispatcher. It's a deliberate flow control mechanism, not a failure.
