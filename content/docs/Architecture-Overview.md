# Architecture Overview

GoyGram is built on a **split-brain architecture**: a high-level Python API that feels ergonomic and pythonic, backed by a Rust extension module that handles every cryptographic operation and TL serialization at native speed.

## The Five-Layer Stack

```
┌─────────────────────────────────────────────┐
│             GoyGram (Public API)             │  ← User-facing class
├─────────────────────────────────────────────┤
│        AppCore (Internal Engine)             │  ← Config, hooks, FSM, routing
├──────────────────┬──────────────────────────┤
│   BotNet (HTTP)  │   MTNet (TCP/MTProto)    │  ← Transport layer
├──────────────────┴──────────────────────────┤
│          Bus → Disp (Event Pipeline)         │  ← asyncio.Queue + dispatcher
├─────────────────────────────────────────────┤
│  goygram.ext (Rust .so) — AES/Crypto + TL   │  ← Native crypto & TL codec
└─────────────────────────────────────────────┘
```

### Layer 1: Public API (`GoyGram` class)

The `GoyGram` class in `client.py` is a **facade** — it delegates everything to `AppCore` but exposes a clean surface:

- Handler decorators: `on_msg`, `on_cb`, `on_cmd`, `on_poll`, `on_member`, `on_update`
- Dynamic method dispatch: every Bot API and MTProto method via `__getattr__`
- FSM state management: `set_state`, `get_state`, `get_state_data`, `clear_state`
- Formatting helpers: `html()`, `md()`
- Transport helpers: `bot_req()`, `mt_req()`, `raw_chat()`, `via()`
- Lifecycle: `run()`, `stop()`
- Introspection: `help()`

```python
def __getattr__(self, name: str) -> Any:
    return getattr(self.core, name)
```

### Layer 2: AppCore (Internal Engine)

`AppCore` owns the entire runtime:

- **`bus`** — `asyncio.Queue` (`core/bus.py`) receiving normalized event dicts from all transports
- **`disp`** — `Disp` class (`core/disp.py`) consuming events and routing to handlers
- **`fsm`** — `FSMEngine` (`core/fsm.py`) for per-chat+user finite state machines
- **`bot`** / **`mt`** — Optional transport instances
- **`api`** — Optional `BotAPI` instance (typed Bot API wrapper)
- **Hook lists**: `hook` (msg), `cb_hook` (callback), `poll_hook` (poll), `member_hook` (member), `update_hook` (catch-all)

#### Dynamic Method Resolution

All Bot API and MTProto methods resolve via `__getattr__`:

```python
def __getattr__(self, name: str) -> Any:
    # Priority 1: BotAPI typed methods
    if self.api is not None and hasattr(self.api, name):
        return getattr(self.api, name)
    # Priority 2: MTProto methods (mt_ prefix)
    if name.startswith("mt_") and self.mt is not None:
        return self._dynamic_method(name)
    # Priority 3: Bot API methods (anything else)
    if not name.startswith("mt_") and not name.startswith("_") and self.bot is not None:
        return self._dynamic_method(name)
    raise AttributeError(name)
```

Snake_case is auto-converted to CamelCase for Bot API, and to `namespace.methodName` for MTProto. No static method lists — everything is dynamic.

### Layer 3: Transport Layer

Two independent network transports feeding the same `Bus`:

| Transport | Class | Protocol | Auth | Update Mechanism |
|-----------|-------|----------|------|-----------------|
| Bot API | `BotNet` (`vendor/botapi.py`) | HTTPS via aiohttp | Bot token | Long-polling `getUpdates` |
| MTProto | `MTNet` (`vendor/mtproto.py`) | Raw TCP socket | API ID/Hash + DH key exchange | Persistent connection, reads encrypted packets |

Both normalize their events into the same dict format and push to `Bus`. The dispatcher doesn't care which transport produced an event.

### Layer 4: Event Pipeline (Bus + Disp)

The **Bus** is a thin `asyncio.Queue` wrapper. Events are `{"src": "bot"|"mt", "data": {...}}` dicts.

The **Dispatcher** runs `consume()` in an asyncio task, calling `one()` per event. `one()` pattern-matches on `data["kind"]` (`"msg"`, `"cb"`, `"poll"`, `"member"`), creates the appropriate typed event object, and iterates through registered handlers. `StopPropagation` from any handler stops the current handler group.

[Full dispatcher docs →](Dispatcher-and-Handler-Pipeline)

### Layer 5: Rust Extension (`goygram.ext`)

The Rust native library (compiled via `maturin` + PyO3, `opt-level=3`, `lto=true`, `strip=true`) exposes 12 functions:

| Function | Purpose |
|----------|---------|
| `aes_ige_enc` | AES-256-IGE encrypt with PKCS7 padding |
| `aes_ige_dec` | AES-256-IGE decrypt + unpad |
| `aes_ige_enc_raw` | AES-256-IGE encrypt without padding |
| `aes_ige_dec_raw` | AES-256-IGE decrypt without padding |
| `aes_gcm_encrypt` | AES-256-GCM authenticated encrypt |
| `aes_gcm_decrypt` | AES-256-GCM authenticated decrypt |
| `cut` | Frame splitter for length-prefixed protocols |
| `pack` | Length-prefix packer |
| `load_schema` | Load parsed TL schema JSON into memory |
| `serialize_method` | Dynamically serialize a TL method call |
| `tl_method_exists` | Check if a TL method is known |
| `schema_loaded` | Check if TL schema is loaded |

The IGE functions are the critical path for MTProto — every encrypted packet passes through AES-IGE. GCM is used for vault encryption. The TL schema runtime in Rust handles dynamic serialization of any MTProto method from parsed `.tl` schema, avoiding code generation at runtime.

### FSM Engine

`FSMEngine` (`core/fsm.py`) provides per-chat+user state management:

- Keyed by `(chat_id, user_id)` tuple
- TTL-based expiry (default 3600s), background cleanup every 600s
- `set()` creates or updates state with optional data dictionary — existing data is **merged** on update
- `get()` returns state name or `None`; `get_data()` returns data dict copy or `None`
- `clear()` removes state
- Filters: `state("name")`, `state_any("a", "b")` for handler routing

[Full FSM docs →](FSM-State-Machine)

### Why This Architecture

1. **Python for ergonomics**: Decorator-based handlers, pydantic configs, async/await, Rich-powered TUI. Orchestration in Rust would be complexity without benefit.

2. **Rust for speed**: AES-256-IGE in Python would be orders of magnitude slower. TL serialization of complex MTProto requests also benefits from native speed. Both are critical-path for every message.

3. **Clean boundary**: The Rust module is a pure crypto + TL codec library. Zero knowledge of Telegram, MTProto networking, or HTTP. Swap the backend and nothing above changes.

4. **Single event bus**: Both transports push into one queue. The dispatcher doesn't care about origin. This is what makes dual-transport seamless.

5. **Dynamic dispatch**: No hardcoded method wrappers. `__getattr__` makes every Bot API and MTProto method available without code generation or maintenance burden.
