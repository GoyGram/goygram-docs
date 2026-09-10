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
    api_id=None, api_hash=None, session_name="default", session=None,
    default_transport="auto", proxy=None,
    app_name=None, app_version=None, device_model=None,
    system_version=None, system_lang_code="en", lang_pack="", lang_code="en",
    bot_offset_path=None,
    intake="auto",
)
```

Supplying `bot_token` enables the Bot API transport. Supplying MTProto credentials without an explicit endpoint enables MTProto and resolves a Telegram data center dynamically. Supplying both enables both transports: the bot is also authorized over MTProto via `auth.importBotAuthorization`. `session=` accepts a `Session` instance or an encrypted session string. `default_transport` is `"api"`, `"mtproto"`, or `"auto"`. `via="api"` / `via="mtproto"` select the transport per call. `intake` controls which update channels feed the dispatcher — `"auto"`, `"dual"`, `"mtproto"`, or `"api"`; see [intake modes](/docs/Configuration-and-Transports).

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
- `app.transport` reads the current default transport, `app.switch("api"|"mt")` sets it, `app.using("api"|"mt")` / `app.use_api()` / `app.use_mt()` are context managers that scope the default;
- `app.me` is the cached own user id; `await app.get_me(refresh=False)` resolves and caches the full own user dict through the available transport;
- `app.group(name)` returns a named handler group with `disable()` / `enable()` / `clear()`;
- `app.every(seconds, fn, ...)` schedules an endless periodic job; `app.later(delay, fn, ...)` schedules a one-shot — both return the `asyncio.Task`;
- `await app.conv_wait(chat_id, user_id=None, filt=None, timeout=60)` pauses a handler until the next matching message in that chat (see [conversations](/docs/Scheduling-and-Background-Work));
- `await app.download_file(file_id, destination=None)` downloads a Bot API file;
- `await app.upload_file(source, **kw)` delegates chunked MTProto upload;
- `await app.send_msg(chat_id, text, via=None, reply_to=None, kbd=None, **kw)` sends through the selected transport;
- `app.iter_history(chat_id, limit=100, batch=100, via=None)` is an async iterator over chat history (MTProto, pages fetched lazily);
- `await app.count_history(chat_id, via=None)` returns the total message count of a chat (MTProto);
- `app.set_state(...)`, `app.get_state(...)`, `app.get_state_data(...)`, and `app.clear_state(...)` manage lightweight FSM state.

## Sugar helpers (0.7.74)

The client also carries the convenience layer documented in [Sugar API](/docs/Sugar-API): media sends (`send_photo`/`send_doc`/`send_audio`/`send_video`/`send_voice`/`send_sticker`/`send_animation` via `send_media`), `edit_msg`, `delete_msg`, `get_chat`/`get_user` (cached), `copy_msg` (true `copyMessage` on Bot API), `forward_msg`, `send_action`, `mark_read`, `send_reaction`, `pin_msg`, `ask(chat_id, text)` (send + wait for the reply), and `app.iter_dialogs(limit, batch, folder)` — a lazy MTProto iterator over dialogs. 0.7.75 adds `search_messages`/`iter_search`, `vote_poll`, `get_forum_topics`, `send_media_group`, `download_media`, `get_self`, admin helpers, and the camelCase dispatch documented in [Rich API](/docs/Rich-API). 0.7.79 adds the domain layer: stories (`get_stories`/`send_story`/`edit_story`/`delete_story`/`read_stories`/`get_story_views`/`export_story_link`), stars and gifts (`get_stars_balance`/`get_stars_history`/`get_star_gifts`/`send_star_gift`), drafts and scheduled messages (`save_draft`/`get_all_drafts`/`get_scheduled_messages`/`send_scheduled`/`delete_scheduled`), full admin/moderation (`restrict_member`/`promote_member`/`demote_member`/`set_slow_mode`/`get_invite_links`/`edit_invite_link`/`revoke_invite_link`/`approve_join_request`/`decline_join_request`), and takeout (`start_takeout`/`finish_takeout` + `takeout_id=` on any call).

## MTProto transport primitives

The direct MTProto transport exposes peer resolution, schema-driven calls, chunked `upload_file` and `download_file`, durable update cursors, reconnect handling, and raw access through the returned dictionaries. It retains the complete structured TL payload instead of allocating a Python model for every Telegram constructor.

## Memory and latency model

The common event path stores a compact normalized object plus the original raw dictionary. Message-specific fields are resolved lazily through `msg.field`, `msg.get(...)`, or `msg[...]`; they are not copied into a large model. This keeps the hot path small while preserving Telegram-specific fields and future layer additions.
