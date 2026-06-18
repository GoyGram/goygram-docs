---
title: "Client – Full Reference"
---

# Client – Full Reference

The `GoyGram` class (and its internal `AppCore`) provides the complete public API. This page documents every method, property, and hook available.

## Constructor

```python
GoyGram(
    bot_token: str | None = None,        # Bot API token
    mt_host: str | None = None,          # MTProto host override
    mt_port: int | None = None,          # MTProto port override
    mt_key: bytes | None = None,         # Pre-existing auth key
    mt_iv: bytes | None = None,          # Pre-existing IV
    bot_timeout: int = 25,               # getUpdates timeout
    bot_base: str = "https://api.telegram.org",
    bus_max: int = 0,                    # Event queue max size (0=unlimited)
    api_id: int | str | None = None,     # MTProto API ID
    api_hash: str | None = None,         # MTProto API hash
    session_name: str = "default",       # Vault file name
    proxy: str | None = None,            # SOCKS5/HTTP proxy URL
    app_name: str | None = None,         # App name for MTProto
    app_version: str | None = None,      # App version for MTProto
    device_model: str | None = None,     # Device model for MTProto
    system_version: str | None = None,   # OS version for MTProto
    system_lang_code: str = "en",
    lang_pack: str = "",
    lang_code: str = "en",
)
```

## Handler Decorators

### `on_msg(fn=None, filt=None)`

Register a message handler with optional filter.

```python
@app.on_msg()
async def all_msgs(msg): ...

@app.on_msg(filt=filters.text)
async def text_only(msg): ...

@app.on_msg(filt=filters.text & ~filters.me)
async def text_not_me(msg): ...
```

### `on_cb(fn=None, *, filt=None)`

Register a callback query handler with optional filter.

```python
@app.on_cb()
async def callback_handler(cb):
    await cb.answer("Got it!")
    await cb.edit("Updated text")

@app.on_cb(filt=filters.cb_startswith("page_"))
async def pagination(cb): ...
```

### `on_cmd(*names)`

Register a command handler. Uses the `command` filter under the hood.

```python
@app.on_cmd("ping")
async def ping(msg): ...

@app.on_cmd("start", "help", "info")
async def multi_cmd(msg): ...
```

### `on_poll(fn=None, *, filt=None)`

Register a poll event handler.

```python
@app.on_poll()
async def poll_handler(poll):
    print(f"Poll '{poll.question}' closed={poll.closed}")

@app.on_poll(filt=filters.poll_closed)
async def closed_only(poll): ...
```

### `on_member(fn=None, *, filt=None)`

Register a chat member update handler.

```python
@app.on_member()
async def member_handler(member):
    print(f"User {member.user_id} went from {member.old} to {member.new}")
```

### `on_update(fn=None, *, filt=None)`

Register a catch-all handler for **any** event type (msg, cb, poll, member). Fires after the typed handlers.

```python
@app.on_update()
async def catch_all(event):
    print(f"Event type: {type(event).__name__}")

@app.on_update(filt=filters.update_type("msg"))
async def msg_catch_all(event): ...
```

## Dynamic Method Dispatch

Every Bot API method is available via `__getattr__`. Snake_case auto-converts to CamelCase:

```python
await app.send_message(chat_id=..., text=...)           # sendMessage
await app.send_document(chat_id=..., document=...)      # sendDocument
await app.get_chat_administrators(chat_id=...)          # getChatAdministrators
await app.answer_callback_query(callback_query_id=...)  # answerCallbackQuery
```

MTProto methods via `mt_` prefix with full namespace:

```python
await app.mt_messages_get_dialogs(limit=50)
await app.mt_messages_get_history(peer=..., limit=100)
await app.mt_messages_send_message(peer=..., message="Hello", random_id=...)

# Or use direct mt_req with dotted notation:
await app.mt_req("messages.getDialogs", limit=50)
```

## Core Messaging Methods

### `send_message(chat_id, text, ...)`

Send a message via Bot API dynamic dispatch. Snake_case → CamelCase conversion applies automatically.

```python
await app.send_message(chat_id=123, text="Hello")
await app.send_message(chat_id=123, text="Reply", reply_parameters={"message_id": msg_id})
```

For MTProto, use the equivalent MTProto method.

### `bot.send_msg(chat_id, text, ...)`

Lower-level message sending on the BotNet transport — handles `reply_to`, `kbd`, `topic_id`, and `link_options` formatting:

```python
await app.bot.send_msg(chat_id, "Hello")
await app.bot.send_msg(chat_id, "Reply", reply_to=msg_id)
await app.bot.send_msg(chat_id, "With keyboard", kbd=my_kbd)
await app.bot.send_msg(chat_id, "In topic", topic_id=thread_id)
await app.bot.send_msg(chat_id, "No preview", link_options={"is_disabled": True})
```

## Transport Methods

### `bot_req(method, **kw)`

Direct Bot API call. CamelCase method name.

```python
await app.bot_req("sendMessage", chat_id=..., text=...)
await app.bot_req("getChat", chat_id=...)
```

### `mt_req(action, **kw)`

Direct MTProto call. Dotted action name.

```python
await app.mt_req("messages.getDialogs", limit=50)
await app.mt_req("messages.sendMessage", peer=..., message="Hi")
```

### `raw_chat(chat_id)`

Strip `bot:`/`mt:` prefix, return plain int or str.

```python
app.raw_chat("bot:123456")  # → 123456
app.raw_chat("mt:-100123")  # → -100123
```

### `via(chat_id, via=None)`

Resolve which transport to use for a chat ID.

```python
app.via("bot:123456")  # → "bot"
app.via(123456)        # → "bot" (if bot configured)
app.via(123456, via="mt")  # → "mt" (forced)
```

## FSM State Methods

### `set_state(chat_id, user_id, state, data=None, ttl=None)`

Set FSM state for a chat+user pair. Existing data is merged. Synchronous — no `await` needed.

```python
app.set_state(chat_id, user_id, "waiting_name")
app.set_state(chat_id, user_id, "step2", {"name": "Sam"}, ttl=1800)
```

### `get_state(chat_id, user_id)`

Get current state name.

```python
state = app.get_state(chat_id, user_id)  # → "waiting_name" or None
```

### `get_state_data(chat_id, user_id)`

Get state data dict (shallow copy).

```python
data = app.get_state_data(chat_id, user_id)  # → {"name": "Sam"} or None
```

### `clear_state(chat_id, user_id)`

Remove FSM state.

```python
app.clear_state(chat_id, user_id)
```

## Keyboard Builders

```python
# Inline keyboard
kbd = app.ikb().btn("Click", callback_data="act").btn("URL", url="https://...").build()

# Reply keyboard
kbd = app.rkb(resize_keyboard=True).btn("Option").build()

# Force reply
kbd = app.frk(selective=True, placeholder="Type...").build()

# Remove keyboard
kbd = app.rgk(selective=True).build()
```

See [Keyboard System](Keyboard-System) for full documentation.

## Formatting Helpers

```python
app.html("<b>bold</b> <i>italic</i>")  # → {"text": "...", "parse_mode": "HTML"}
app.md("**bold** *italic*")            # → {"text": "...", "parse_mode": "MarkdownV2"}
```

## Lifecycle Methods

### `run()`

Start the application. Blocks until stopped.

```python
asyncio.run(app.run())
```

### `stop()`

Signal shutdown. Sets `stop_ev`.

```python
app.stop()
```

## Introspection

```python
app.help()             # pretty DX overview to console
print(dir(app))        # available attributes + dynamic entries
```

### Properties

- `app.core` — Underlying `AppCore` instance
- `app.core.self_id` — Current account's user ID
- `app.core.api_id` / `app.core.api_hash` — API credentials
- `app.core.stop_ev` — `asyncio.Event` for shutdown signaling
- `app.core.fsm` — `FSMEngine` instance
- `app.core.bus` — `Bus` instance
- `app.core.disp` — `Disp` instance
