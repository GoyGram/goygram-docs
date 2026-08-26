---
title: GoyGram Client Reference
---

# GoyGram Client Reference

```python
GoyGram(
    bot_token=None,
    mt_host=None, mt_port=None, mt_key=None, mt_iv=None,
    bot_timeout=25, bot_base="https://api.telegram.org", bus_max=0,
    webhook_url=None, webhook_host="127.0.0.1", webhook_port=8080,
    webhook_path="/telegram/webhook", webhook_secret_token=None,
    webhook_max_body=1048576, webhook_drop_pending_updates=False,
    api_id=None, api_hash=None, session_name="default", proxy=None,
    app_name=None, app_version=None, device_model=None,
    system_version=None, system_lang_code="en", lang_pack="", lang_code="en",
    bot_offset_path=None,
)
```

Supplying `bot_token` enables the Bot API transport. Supplying MTProto credentials without an explicit endpoint enables MTProto and resolves a Telegram data center dynamically. Supplying both enables both transports.

## Lifecycle

- `await app.run()` starts the dispatcher, state engine, and configured transport(s), then waits until stopped;
- `app.stop()` requests shutdown;
- `await app.close()` stops the state engine, dispatcher, and networks.

## Dynamic API

GoyGram does not generate hundreds of Python wrapper classes. The schema is loaded at runtime and calls are dispatched directly:

```python
result = await app.mt_req("messages.getHistory", peer=peer, limit=50)
result = await app.mt_messages_get_history(peer=peer, limit=50)
```

Every method from the active TL schema can be called through `mt_req("namespace.method", ...)` or the `mt_namespace_method(...)` form. Bot API methods use `app.bot_req("method", ...)` or `app.method_name(...)`.

Use `app.help()` to print the available helper surface. Use `app.core.mt.resolve_peer(...)` for MTProto peer resolution and preserve the returned constructor when passing a peer to later calls.

## Helpers

- `app.ikb()`, `app.rkb(**opts)`, `app.frk(**opts)`, `app.rgk(**opts)` create keyboard builders;
- `app.html(text)` returns a Bot API HTML payload;
- `app.md(text)` returns a Bot API MarkdownV2 payload;
- `app.raw_chat(chat_id)` removes a `bot:`/`mt:` prefix when present;
- `app.via(chat_id, via=None)` selects the configured transport;
- `await app.download_file(file_id, destination=None)` downloads a Bot API file;
- `await app.upload_file(source, **kw)` delegates chunked MTProto upload;
- `await app.send_msg(chat_id, text, via=None, reply_to=None, kbd=None, **kw)` sends through the selected transport;
- `app.set_state(...)`, `app.get_state(...)`, `app.get_state_data(...)`, and `app.clear_state(...)` manage lightweight FSM state.

## MTProto transport primitives

The direct MTProto transport exposes peer resolution, schema-driven calls, chunked `upload_file` and `download_file`, durable update cursors, reconnect handling, and raw access through the returned dictionaries. It retains the complete structured TL payload instead of allocating a Python model for every Telegram constructor.

## Memory and latency model

The common event path stores a compact normalized object plus the original raw dictionary. Message-specific fields are resolved lazily through `msg.field`, `msg.get(...)`, or `msg[...]`; they are not copied into a large model. This keeps the hot path small while preserving Telegram-specific fields and future layer additions.
