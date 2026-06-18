# Bot API Dynamic Dispatch

GoyGram provides transparent access to the entire Bot API method surface through Python's `__getattr__` mechanism. Any `snake_case` method name is converted to `CamelCase` on the fly and dispatched as a Bot API call — no manual method registration needed.

## How It Works

Two layers of dynamic dispatch cover all Bot API methods:

### Layer 1: AppCore.\_\_getattr\_\_

```python
def __getattr__(self, name: str) -> Any:
    if self.api is not None and hasattr(self.api, name):
        return getattr(self.api, name)
    if name.startswith("mt_") and self.mt is not None:
        return self._dynamic_method(name)
    if not name.startswith("mt_") and not name.startswith("_") and self.bot is not None:
        return self._dynamic_method(name)
    raise AttributeError(name)
```

This checks whether `BotAPI` resolves the name first, then falls back to dynamic generation. Methods starting with `mt_` are routed to MTProto.

### Layer 2: BotAPI.\_\_getattr\_\_

```python
class BotAPI:
    __slots__ = ("net",)
    def __init__(self, net): self.net = net

    async def call(self, meth, **kw):
        return await self.net.req(meth, dump(kw))

    def __getattr__(self, name):
        async def dyn(**kw):
            parts = name.split("_")
            meth = parts[0] + "".join(
                x[:1].upper() + x[1:] for x in parts[1:]
            )
            return await self.call(meth, **kw)
        return dyn
```

This is the fully dynamic layer — any `snake_case` name is converted and dispatched. `BotAPI.call()` runs `dump(kw)` on all parameters and calls `self.net.req(method_name, data)`.

BotAPI has no hardcoded typed methods — every call goes through `__getattr__`.

## Name Conversion

`_bot_method_name` converts `snake_case` → `CamelCase`:

```python
def _bot_method_name(self, name: str) -> str:
    if "_" in name:
        parts = name.split("_")
        return parts[0] + "".join(
            x[:1].upper() + x[1:] for x in parts[1:]
        )
    return name
```

The method name MUST match the Telegram Bot API method name. Examples:

| `app.method_name(...)` | Bot API method | Works? |
|---|---|---|
| `send_message` | `sendMessage` | ✓ |
| `get_chat_administrators` | `getChatAdministrators` | ✓ |
| `delete_webhook` | `deleteWebhook` | ✓ |
| `set_my_commands` | `setMyCommands` | ✓ |
| `edit_message_reply_markup` | `editMessageReplyMarkup` | ✓ |
| `sendMessage` (no underscores) | `sendMessage` (pass-through) | ✓ |
| `send_msg` | `sendMsg` | ✗ — Telegram has `sendMessage`, not `sendMsg` |
| `send_doc` | `sendDoc` | ✗ — Telegram has `sendDocument`, not `sendDoc` |

Use the full method name matching Telegram's docs. CamelCase without underscores also works (pass-through).

## Dynamic Method Generation

`_dynamic_method` creates an `async` callable on the fly:

```python
def _dynamic_method(self, name: str):
    async def call(**kw: Any) -> Any:
        if name.startswith("mt_"):
            return await self.mt_req(self._mt_method_name(name), **kw)
        return await self.bot_req(self._bot_method_name(name), **kw)
    return call
```

The generated function is returned from `__getattr__`. Python's normal attribute lookup caches the result for subsequent calls.

## Usage Examples

```python
app = GoyGram(bot_token="...")

# All of these work through dynamic dispatch:
await app.send_message(chat_id=123, text="Hello")
await app.get_chat(chat_id=123)
await app.get_chat_administrators(chat_id=123)
await app.set_my_commands(commands=[...])
await app.send_document(chat_id=123, document=open("file.pdf", "rb"))
await app.delete_webhook(drop_pending_updates=True)

# Any Bot API method — even newly released ones — works immediately:
await app.get_business_connection(business_connection_id="...")
```

## MTProto Parallel

MTProto methods use the `mt_` prefix with full namespace. The namespace is the first underscore-segment before the method name:

```python
# Correct: full namespace.methodName format
await app.mt_messages_get_dialogs(limit=50)
await app.mt_messages_get_history(peer=..., limit=100)
await app.mt_messages_send_message(peer=..., message="Hello", random_id=...)

# Or use the dotted form directly:
await app.mt_req("messages.getDialogs", limit=50)
await app.mt_req("messages.getHistory", peer=..., limit=100)
```

Name conversion for MTProto:
- `mt_messages_get_dialogs` → `messages.getDialogs`
- `mt_messages_get_history` → `messages.getHistory`
- `mt_channels_get_participants` → `channels.getParticipants`
- `mt_account_update_profile` → `account.updateProfile`

The first underscore segment after `mt_` becomes the namespace, the rest form the camelCase method name.

## Explicit Convenience Methods

A few methods are defined directly on `AppCore`:

| Method | Purpose |
|--------|---------|
| `bot_req(method, **kw)` | Direct Bot API call with CamelCase method name |
| `mt_req(action, **kw)` | Direct MTProto call with dotted action name |
| `html(text)` | Return `{"text": text, "parse_mode": "HTML"}` |
| `md(text)` | Return `{"text": text, "parse_mode": "MarkdownV2"}` |
| `ikb()` | Create inline keyboard builder |
| `rkb(**opts)` | Create reply keyboard builder |
| `frk(**opts)` | Create force-reply markup |
| `rgk(**opts)` | Create remove-keyboard markup |

All other Bot API methods go through dynamic `__getattr__` dispatch — there are no pre-built method wrappers.
