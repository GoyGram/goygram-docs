---
title: Bot API Calls
---

# Bot API Calls

GoyGram maps snake_case attributes to Telegram Bot API camelCase methods:

```python
await app.send_message(chat_id=123, text="Hello")
await app.delete_message(chat_id=123, message_id=456)
```

The examples above call `sendMessage` and `deleteMessage`. Keyword arguments with `None` values are omitted. Returned values are the API response as provided by the transport.

Use `await app.bot_req("sendMessage", chat_id=123, text="Hello")` when you need an explicit Bot API method name.

## Transport selection

Dynamic Bot API methods are available only when `bot_token` configured the Bot API transport. If both transports are configured, an unprefixed dynamic method is Bot API; MTProto calls must start with `mt_`.

For message helpers, pass `bot:123` or `mt:123` as a chat ID when selecting a transport matters.

Bot API coverage is dynamic: a method does not need a generated Python wrapper. Use Telegram's official Bot API documentation for method-specific parameters and responses.
