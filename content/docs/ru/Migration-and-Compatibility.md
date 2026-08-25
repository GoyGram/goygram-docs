---
title: "Migration and Compatibility"
---

# Migration and compatibility

This guide covers the current compact GoyGram API. Prefer the public `GoyGram` object and documented event objects over private transport fields.

## Python and installation

GoyGram requires Python 3.11 or newer. Install or upgrade with:


```bash
python -m pip install -U goygram
```


When developing from a checkout, install the project in the environment used to start the application so Python imports the same source you edit.

## Dynamic methods replace generated wrappers

Bot API calls are dynamic. Convert Telegram method names to snake case:


```python
await app.send_message(chat_id=123, text="Hello")
await app.get_me()
```


MTProto calls use `mt_`, an underscore namespace separator, and snake case for the rest:


```python
await app.mt_users_get_full_user(id="me")
await app.mt_messages_get_history(peer="me", limit=10)
```


Do not depend on generated per-method wrapper classes. Use [[Bot-API-Calls]] or [[MTProto-Calls]] for the conversion rules.

## Handler registration

Use `on_msg()`, `on_cb()`, `on_poll()`, `on_member()`, and `on_update()`. `on_cmd()` is the short form for command-filtered message handlers.


```python
@app.on_cmd("start")
async def start(msg):
    await msg.reply("Hi")
```


Handler registration also accepts a callback directly: `app.on_msg(handler, filt=...)`.

## MTProto sessions

MTProto authentication is session-based. Keep the session vault secure and stable between restarts; changing `session_name` creates a different vault target. Review [[Sessions-and-Authentication]] before migrating a deployment.

## Compatibility discipline

- Pin a tested GoyGram version for production deployments.
- Keep Bot API parameter names aligned with Telegram's current documentation.
- Treat raw MTProto schema calls as version-sensitive and test them after Telegram schema updates.
- Do not access `app.core`, transport readers, or dispatcher internals unless you are intentionally maintaining an integration against private API.

See [[Errors-Logging-and-Troubleshooting]] for upgrade diagnostics.