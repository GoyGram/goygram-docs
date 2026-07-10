# GoyGram

GoyGram is an asynchronous Python library for Telegram bots and MTProto userbots. One application object exposes a shared event model, composable filters, dynamic Bot API calls, and raw MTProto calls.

Current documented release: **0.7.15**. The package requires Python 3.11 or newer.

## Choose a transport

- **Bot API** — pass `bot_token`; use Telegram Bot API methods and receive bot updates by long polling.
- **MTProto** — pass `api_id` and `api_hash`; authenticate a Telegram user account and receive MTProto updates.
- **Both** — configure both transports only when needed. Prefix a chat ID with `bot:` or `mt:` to select a transport for helpers that accept a chat ID.

## Start here

- [[Installation]]
- [[Quick-Start-Bot-API|Quick start: Bot API]]
- [[Quick-Start-MTProto-Userbot|Quick start: MTProto userbot]]
- [[Configuration-and-Transports|Configuration and transports]]
- [[Handlers-and-Updates|Handlers and updates]]
- [[Filters]]

## Build features

- [[Keyboards-Formatting-and-State|Keyboards, formatting and state]]
- [[Polling-and-Membership|Polls and membership updates]]
- [[Files-and-Media|Files and media]]
- [[Scheduling-and-Background-Work|Scheduling and background work]]

## Reference

- [[GoyGram-Client-Reference|Client reference]]
- [[Event-Objects|Event objects]]
- [[Bot-API-Calls|Bot API calls]]
- [[MTProto-Calls|MTProto calls]]
- [[Sessions-and-Authentication|Sessions and authentication]]
- [[Architecture-and-Runtime-Behavior|Architecture and runtime behavior]]
- [[Errors-Logging-and-Troubleshooting|Errors, logging and troubleshooting]]
- [[Migration-and-Compatibility|Migration and compatibility]]
- [[FAQ]]
