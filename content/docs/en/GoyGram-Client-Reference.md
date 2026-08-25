---
title: GoyGram Client Reference
---

# GoyGram Client Reference

```python
GoyGram(
    bot_token=None,
    mt_host=None, mt_port=None, mt_key=None, mt_iv=None,
    bot_timeout=25, bot_base="https://api.telegram.org", bus_max=0,
    api_id=None, api_hash=None, session_name="default", proxy=None,
    app_name=None, app_version=None, device_model=None,
    system_version=None, system_lang_code="en", lang_pack="", lang_code="en",
)
```

Supplying `bot_token` enables the Bot API transport. Supplying MTProto credentials without an explicit endpoint enables MTProto and resolves a Telegram data center dynamically (with a built-in fallback). Supplying both enables both transports.

## Lifecycle

- `await app.run()` starts the dispatcher, state engine, and configured transport(s), then waits until stopped.
- `app.stop()` requests shutdown.
- `await app.close()` stops the state engine, dispatcher, and networks. Normally `run()` handles this in its `finally` block.

## Helpers

- `app.ikb()`, `app.rkb(**opts)`, `app.frk(**opts)`, `app.rgk(**opts)` create keyboard builders.
- `app.html(text)` returns `{"text": text, "parse_mode": "HTML"}`.
- `app.md(text)` returns `{"text": text, "parse_mode": "MarkdownV2"}`.
- `app.raw_chat(chat_id)` removes a `bot:`/`mt:` prefix when present.
- `app.via(chat_id, via=None)` resolves the configured transport; use a `bot:` or `mt:` chat ID to choose explicitly when both are enabled.
- `app.help()` prints discovered method help.

## State

`set_state(chat_id, user_id, state, data=None, ttl=None)`, `get_state(chat_id, user_id)`, `get_state_data(chat_id, user_id)`, and `clear_state(chat_id, user_id)` provide raw per-chat/per-user state. It is not a conversation framework.
