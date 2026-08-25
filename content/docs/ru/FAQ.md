---
title: "FAQ"
---

# FAQ

## Can one application use Bot API and MTProto together?

Yes. Pass `bot_token`, `api_id`, and `api_hash` to one `GoyGram` instance. Bot API calls use ordinary snake-case names; MTProto calls use the `mt_` prefix. See [Configuration and Transports](/ru/docs/Configuration-and-Transports).

## Why does `await app.send_message(...)` raise `bot net is not configured`?

The client was created without `bot_token`. Configure a Bot API token or use the matching MTProto method, such as `mt_messages_send_message`.

## Why does an MTProto call raise `mt net is not configured`?

Provide `api_id` and `api_hash` (or explicit MT connection details for an advanced setup). The first run must complete authentication. See [Sessions and Authentication](/ru/docs/Sessions-and-Authentication).

## How do I discover available methods?

Call `app.help()` to print available method information. For Bot API calls, translate Telegram's camelCase method names to snake case. For MTProto calls, use `mt_` followed by the namespace and method in snake case. See [Bot API Calls](/ru/docs/Bot-API-Calls) and [MTProto Calls](/ru/docs/MTProto-Calls).

## What does a handler receive?

`on_msg` receives `MsgObj`; `on_cb` receives `CbObj`; `on_poll` receives `PollObj`; `on_member` receives `MemberObj`; `on_update` receives the raw update. See [Event Objects](/ru/docs/Event-Objects).

## Can I use synchronous handlers?

No. Handlers should be `async def` functions. Blocking work must be moved out of the event loop; read [Scheduling and Background Work](/ru/docs/Scheduling-and-Background-Work).

## How do I stop the application?

Call `app.stop()`. `await app.run()` then closes transports, stops FSM cleanup, and cancels GoyGram's internal tasks.

## Where is conversation state stored?

In memory, keyed by `(chat_id, user_id)`. It is lost on process restart. Use `set_state`, `get_state`, `get_state_data`, and `clear_state`; optional TTL removes stale entries. See [Keyboards, formatting and state](/ru/docs/Keyboards-Formatting-and-State).

## A Telegram API call fails. What should I inspect first?

Check the method name, required parameters, selected transport, token/session validity, and logs. Then consult [Errors Logging and Troubleshooting](/ru/docs/Errors-Logging-and-Troubleshooting).