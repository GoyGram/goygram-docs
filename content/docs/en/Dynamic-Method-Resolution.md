---
title: "Dynamic Method Resolution"
---

# Dynamic Method Resolution

GoyGram lets you call **any Telegram method** without it being explicitly coded. `app.send_document(...)`, `app.get_chat(...)`, `app.mt_messages_get_dialogs(...)` — all resolve through `__getattr__` magic and dynamic dispatch.

## How It Works

### The `__getattr__` Chain

When you write `app.send_document(...)`, Python can't find `send_document` on the `GoyGram` object. The fallback `__getattr__` is called:

```python
class GoyGram:
    def __getattr__(self, name: str) -> Any:
        return getattr(self.core, name)
```

Which delegates to `AppCore.__getattr__`:

```python
class AppCore:
    def __getattr__(self, name: str) -> Any:
        # Priority 1: BotAPI dynamic dispatch
        if self.api is not None and hasattr(self.api, name):
            return getattr(self.api, name)

        # Priority 2: mt_ prefix → MTProto
        if name.startswith("mt_") and self.mt is not None:
            return self._dynamic_method(name)

        # Priority 3: Everything else → Bot API
        if not name.startswith("mt_") and not name.startswith("_") \
           and self.bot is not None:
            return self._dynamic_method(name)

        raise AttributeError(name)
```

### Name Conversion

**Snake_case → CamelCase** (Bot API):

```python
def _bot_method_name(self, name: str) -> str:
    if "_" in name:
        parts = name.split("_")
        return parts[0] + "".join(x[:1].upper() + x[1:] for x in parts[1:])
    return name
```

| Python call | Bot API method |
|-------------|---------------|
| `send_document` | `sendDocument` |
| `get_chat_administrators` | `getChatAdministrators` |
| `sendDocument` (no underscores) | `sendDocument` (pass-through) |

**Snake_case → MTProto namespace.methodName**:

```python
def _mt_method_name(self, name: str) -> str:
    name = name[3:]  # strip "mt_"
    if "." in name:
        return name  # already dotted
    parts = name.split("_")
    if len(parts) < 2:
        return name
    ns = parts[0]
    rest = parts[1:]
    return ns + "." + rest[0] + "".join(
        p[:1].upper() + p[1:] for p in rest[1:]
    )
```

The first segment after `mt_` becomes the namespace, the rest form the camelCase method name:

| Python call | MTProto action |
|-------------|---------------|
| `mt_messages_get_dialogs` | `messages.getDialogs` |
| `mt_messages_get_history` | `messages.getHistory` |
| `mt_messages_send_message` | `messages.sendMessage` |
| `mt_channels_get_participants` | `channels.getParticipants` |
| `mt_account_update_profile` | `account.updateProfile` |
| `mt_messages.sendMessage` | `messages.sendMessage` (dotted pass-through) |

### The Dynamic Method Factory

```python
def _dynamic_method(self, name: str):
    async def call(**kw: Any) -> Any:
        if name.startswith("mt_"):
            return await self.mt_req(self._mt_method_name(name), **kw)
        return await self.bot_req(self._bot_method_name(name), **kw)
    return call
```

A fresh async closure is created per attribute access — intentionally simple, not cached.

### BotAPI Layer

`BotAPI` (`api/methods.py`) provides another resolution tier with its own `__getattr__`:

```python
class BotAPI:
    def __getattr__(self, name: str) -> Any:
        async def dyn(**kw: Any) -> Any:
            parts = name.split("_")
            meth = parts[0] + "".join(
                x[:1].upper() + x[1:] for x in parts[1:]
            )
            return await self.call(meth, **kw)
        return dyn
```

This is only checked when `self.api` is not None — i.e., when a bot token was provided and `BotAPI(self.bot)` was created. BotAPI has no hardcoded typed methods — every call goes through `__getattr__`.

## Three-Tier Resolution

| Tier | Mechanism | Examples |
|------|-----------|----------|
| 1. BotAPI dynamic | `BotAPI.__getattr__` | `send_message`, `get_chat`, `edit_message_text` |
| 2. AppCore dynamic (Bot) | `_dynamic_method` → `bot_req` | `sendDocument`, `getChat`, `banChatMember` |
| 3. AppCore dynamic (MT) | `_dynamic_method` → `mt_req` with `mt_` prefix | `mt_messages_get_dialogs`, `mt_messages_send_message` |

Tier 1 is checked first, then Tier 2, then Tier 3. If nothing matches, `AttributeError` is raised.

## Convenience Methods

Defined explicitly on `AppCore` — always available via direct attribute access:

| Method | Description |
|--------|-------------|
| `help()` | Print developer overview |
| `stop()` | Signal shutdown |
| `run()` | Start the application |
| `bot_req(method, **kw)` | Direct Bot API call |
| `mt_req(action, **kw)` | Direct MTProto call |
| `raw_chat(chat_id)` | Strip `bot:`/`mt:` prefix |
| `via(chat_id, via=None)` | Resolve transport for chat ID |
| `ikb()` | Create inline keyboard builder |
| `rkb(**opts)` | Create reply keyboard builder |
| `frk(**opts)` | Create force-reply markup |
| `rgk(**opts)` | Create remove-keyboard markup |
| `html(text)` | HTML parse mode dict |
| `md(text)` | MarkdownV2 parse mode dict |

### FSM Convenience Methods (sync)

| Method | Description |
|--------|-------------|
| `set_state(chat_id, user_id, state, data=None, ttl=None)` | Set FSM state |
| `get_state(chat_id, user_id)` → `str\|None` | Get current state name |
| `get_state_data(chat_id, user_id)` → `dict\|None` | Get state data copy |
| `clear_state(chat_id, user_id)` | Remove FSM state |

## Parameter Serialization

### Bot API (`bot_req`)

Keyword arguments with `None` values are stripped. Objects with `to_dict()` are serialized.

### MTProto (`mt_req`)

Keyword arguments with `None` values are stripped. Objects with `to_dict()` are serialized. `api_id` and `api_hash` from the client config are auto-injected if not provided.

## `__dir__` Augmentation

```python
class GoyGram:
    def __dir__(self) -> list[str]:
        return sorted(set(super().__dir__()) | set(dir(self.core)))
```

`dir(app)` shows the combined attribute set of both `GoyGram` and `AppCore`.

## Introspection

```python
app.help()                        # pretty DX overview
print(dir(app))                   # all available attributes
from goygram.utils import print_methods
print_methods(app)               # filter catalog + shortcuts
```
