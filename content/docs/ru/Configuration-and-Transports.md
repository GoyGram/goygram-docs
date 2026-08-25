---
title: "Конфигурация и транспорт"
---

# Configuration and transports

`GoyGram` accepts Bot API and MTProto settings in the same constructor. Supplying a bot token enables Bot API long polling. Supplying `api_id` and `api_hash` enables MTProto and its session bootstrap.


```python
from goygram import GoyGram

app = GoyGram(
    bot_token="BOT_TOKEN",
    api_id=12345,
    api_hash="API_HASH",
    session_name="production",
)
```


## Bot API options


```python
app = GoyGram(
    bot_token="BOT_TOKEN",
    bot_timeout=25,
    bot_base="https://api.telegram.org",
)
```


`bot_timeout` is the long-poll timeout. `bot_base` is only useful for a compatible Bot API endpoint; leave its default for Telegram.

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

## Selecting a transport

For API calls, method names make the route explicit:

- `await app.send_message(...)` calls Bot API `sendMessage`.
- `await app.mt_messages_get_history(...)` calls MTProto `messages.getHistory`.

For helpers that accept a chat ID, use prefixes when both transports are enabled:


```python
await app.send_message(chat_id="bot:123456", text="bot message")
await app.mt_messages_send_message(peer="me", message="user message")
```


`raw_chat("bot:123")` returns the unprefixed value. If no prefix is given, helpers prefer the Bot API transport when it exists, otherwise MTProto.

## Lifecycle

Start one application with `await app.run()`. It starts the dispatcher, state cleanup, bot polling, and/or the MTProto reader. Call `app.stop()` from a handler or shutdown path; `run()` closes transports and cancels its internal tasks.

See [[Sessions-and-Authentication]] before the first MTProto run.