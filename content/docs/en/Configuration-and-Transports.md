---
title: Configuration and Transports
---

# Configuration and transports

`GoyGram` accepts Bot API and MTProto settings in the same constructor. Supplying a bot token enables Bot API long polling. Supplying `api_id` and `api_hash` enables MTProto and its session bootstrap. Supply all three to run a **hybrid bot** — the Bot API transport plus a bot authorized over MTProto via `auth.importBotAuthorization`.

```python
from goygram import GoyGram

app = GoyGram(
    bot_token="BOT_TOKEN",
    api_id=12345,
    api_hash="API_HASH",
    session_name="production",
    default_transport="mtproto",   # "api", "mtproto", or "auto"
)
```

`session=` accepts a `Session` instance or an encrypted session string; `session_name=` is the plain file-backed shorthand. `default_transport` picks the default outgoing transport when `via` is omitted.

## Bot API options

```python
app = GoyGram(
    bot_token="BOT_TOKEN",
    bot_timeout=25,
    bot_base="https://api.telegram.org",
    bot_offset_path="/path/to/bot.offset",
    webhook_url="https://bot.example.com/telegram/webhook",
    webhook_secret_token="WEBHOOK_SECRET",
)
```

`bot_timeout` is the long-poll timeout. `bot_base` is only useful for a compatible Bot API endpoint; leave its default for Telegram. `bot_offset_path` optionally selects the atomic Bot API offset file; when omitted, GoyGram derives a private per-bot path under `~/.goygram/offsets/`.

When `webhook_url` is set, `run()` starts the local webhook listener instead of polling. Configure `webhook_host`, `webhook_port`, `webhook_path`, `webhook_secret_token`, `webhook_max_body`, and `webhook_drop_pending_updates` as needed.

## MTProto options

```python
app = GoyGram(
    api_id=12345,
    api_hash="API_HASH",
    session_name="my-account",
    proxy="socks5://127.0.0.1:1080",
    device_model="server",
    system_version="Linux",
    app_version="1.0",
)
```

When no explicit `mt_host` is supplied, GoyGram selects a Telegram DC dynamically and falls back to DC 2 if discovery is unavailable. Normally you should not provide `mt_host`, `mt_port`, `mt_key`, or `mt_iv`; those options are for low-level or pre-authorized connections.

MTProto `pts/qts/date/seq` cursors are persisted automatically under `~/.goygram/cursors/` and `updatesTooLong` triggers `updates.getDifference` recovery when a `pts` cursor is available.

## Intake modes and duplicate protection

`intake=` controls which update channels feed the dispatcher:

- `"auto"` (default): one transport configured takes that channel. A **user session** plus a bot token runs **dual intake** — both channels deliver updates. A bot authorized through the same bot token over both channels runs MTProto-only, so Telegram does not send the same update twice.
- `"dual"`: force both channels on. A cross-transport duplicate gate in the dispatcher drops the second copy of the same message: the key is `(kind, chat_id, msg_id)` for messages and edits, `(kind, query_id)` for callbacks and inline queries, with a TTL sweep so the gate cannot grow unbounded.
- `"mtproto"` / `"api"`: force a single channel; the other transport stays available for outgoing calls only.

```python
app = GoyGram(
    bot_token="BOT_TOKEN",
    api_id=12345,
    api_hash="API_HASH",
    session_name="my-account",   # a user session: auto selects dual intake
    intake="dual",               # or "auto", "mtproto", "api"
)
```

Every handler — bot polling, webhook, and MTProto updates — goes through the same dispatcher gate, so a userbot and a webhook bot running together cannot double-fire a handler on the same message. Delivery order between the two channels is not deterministic; the first copy to arrive wins.

## Selecting a transport

For API calls, method names make the route explicit:

- `await app.send_message(...)` calls Bot API `sendMessage`.
- `await app.mt_messages_get_history(...)` calls MTProto `messages.getHistory`.

For helpers that accept a chat ID, use prefixes or `via=` when both transports are enabled:

```python
await app.send_message(chat_id="bot:123456", text="bot message")
await app.mt_messages_send_message(peer="me", message="user message")

# explicit per-call transport selection:
await app.send_msg("123456", "via api", via="api")       # Bot API
await app.send_msg("123456", "via mtproto", via="mtproto")  # MTProto
```

`via="api"` is an alias for the Bot API transport and `via="mtproto"` for MTProto (`via="bot"` / `via="mt"` also work). `raw_chat("bot:123")` returns the unprefixed value. If no prefix or `via` is given, helpers follow `default_transport`, then prefer the Bot API transport when it exists, otherwise MTProto.

## Switching transports at runtime

The preferred way to pick a transport for outgoing calls is the `use` / `using` pair — a context manager that flips the default inside its block, plus shortcut context managers:

```python
async with app.using("api"):        # everything inside goes through Bot API
    await app.send_msg(chat, "sent by bot")

async with app.using("mt"):         # everything inside goes through MTProto
    await app.send_msg(chat, "sent by user account")

async with app.use_api():           # same, shortcuts
    ...
async with app.use_mt():
    ...
```

`app.transport` returns the current default (`"api"` or `"mtproto"`), and `app.switch("mtproto")` sets it. Prefixes (`bot:`, `mt:`) and `via=` still override per call, so a context manager never blocks an explicit route.

```python
app.transport                  # -> "api"
app.switch("mt")                # default is now "mtproto"
app.default_transport          # -> "mtproto"
```

## Lifecycle

Start one application with `await app.run()`. It starts the dispatcher, state cleanup, bot polling, and/or the MTProto reader. Call `app.stop()` from a handler or shutdown path; `run()` closes transports and cancels its internal tasks.

See [Sessions and Authentication](/docs/Sessions-and-Authentication) before the first MTProto run.