---
title: "FSM State Machine"
---

# FSM State Machine

GoyGram includes a built-in Finite State Machine for tracking per-chat+user conversation states. It's ideal for multi-step flows like registration wizards, survey bots, or any sequential interaction.

## Overview

The FSM is keyed by `(chat_id, user_id)` tuples — each user in each chat has independent state. States have a TTL (default 1 hour) and are automatically cleaned up.

## Architecture

```python
class StateItem:
    __slots__ = ('state', 'data', 'expiry')

class FSMEngine:
    def __init__(self, ttl: float = 3600.0) -> None:
        self._states: dict[tuple[int, int], StateItem] = {}
        self._ttl = ttl
```

- **`_states`**: Dict keyed by `(int(chat_id), int(user_id))`
- **`ttl`**: Default time-to-live in seconds (3600 = 1 hour)
- **Background cleanup**: Runs every 600 seconds, removes expired states in batches of 1000

## Setting State

```python
app.set_state(chat_id, user_id, "waiting_name")
```

Or with data:

```python
app.set_state(
    chat_id, user_id,
    state="waiting_age",
    data={"name": "Sam", "step": 2},
    ttl=1800  # optional per-state TTL override
)
```

**Data merging behavior**: If state already exists for this `(chat_id, user_id)` key, calling `set_state` with new `data` **merges** it into existing data (dict.update). The `state` name is overwritten, and `ttl` is reset.

```python
app.set_state(chat, user, "step1", {"a": 1})
app.set_state(chat, user, "step2", {"b": 2})
data = app.get_state_data(chat, user)
# data == {"a": 1, "b": 2}
```

## Getting State

```python
state_name = app.get_state(chat_id, user_id)
# Returns str | None

data = app.get_state_data(chat_id, user_id)
# Returns dict | None (a copy, safe to mutate)
```

`get_state_data()` returns a **shallow copy** of the data dict, so modifying it doesn't affect the stored state.

Both methods auto-expire: if the state's TTL has passed, they return `None` and the state is deleted.

## Clearing State

```python
app.clear_state(chat_id, user_id)
```

Silently succeeds if no state exists.

## FSM-Aware Filters

The filter system integrates directly with the FSM:

```python
from goygram.filters import state, state_any

@app.on_msg(filt=filters.text & state("waiting_name"))
async def get_name(msg):
    name = msg.text.strip()
    app.set_state(msg.chat_id, msg.from_id,
        "waiting_age", {"name": name})
    await msg.reply(f"Got it, {name}. How old are you?")

@app.on_msg(filt=filters.text & state("waiting_age"))
async def get_age(msg):
    if not msg.text.isdigit():
        await msg.reply("Please enter a number.")
        return
    data = app.get_state_data(msg.chat_id, msg.from_id) or {}
    name = data.get("name", "User")
    app.clear_state(msg.chat_id, msg.from_id)
    await msg.reply(f"{name}, age {msg.text} — registered!")
```

- `state("name")` — Fires only when `get_state(chat_id, user_id) == "name"`
- `state_any("a", "b", "c")` — Fires if state is any of the given names

Both filters return `False` (skip handler) if there's no state or the state has expired.

## Complete Example: Registration Flow

```python
from goygram import GoyGram, filters
from goygram.filters import state

app = GoyGram(bot_token="...")

@app.on_cmd("register")
async def start_register(msg):
    app.set_state(msg.chat_id, msg.from_id, "reg_name")
    await msg.reply("What's your name?")

@app.on_msg(filt=filters.text & state("reg_name"))
async def reg_name(msg):
    app.set_state(msg.chat_id, msg.from_id,
        "reg_email", {"name": msg.text})
    await msg.reply("What's your email?")

@app.on_msg(filt=filters.text & state("reg_email"))
async def reg_email(msg):
    data = app.get_state_data(msg.chat_id, msg.from_id) or {}
    name = data.get("name", "User")
    app.clear_state(msg.chat_id, msg.from_id)
    await msg.reply(f"Registered: {name} <{msg.text}>")
```

## Lifecycle

```python
# Started automatically in AppCore.run()
tasks.append(asyncio.create_task(self.fsm.start(), name="fsm_cleanup"))

# Stopped in AppCore.close()
await self.fsm.stop()
```

`start()` launches the background cleanup task. `stop()` cancels it and clears all states.

## Memory Considerations

- States are stored in-memory only — no persistence across restarts
- `(chat_id, user_id)` keys are cast to `int` — string chat IDs (like usernames) will fail
- The cleanup loop processes at most 1000 stale entries per cycle — for very large state sets (>100k), stale entries may linger briefly
- No size limit on the `_states` dict — it grows until cleanup or explicit `clear()`
- `get_state_data()` returns a shallow copy to prevent accidental mutation of stored state
