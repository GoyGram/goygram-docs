---
title: Home
---

# GoyGram

![GoyGram logo](https://raw.githubusercontent.com/GoyGram/GoyGram/main/GoyGram.png)

GoyGram is an asynchronous Python library for Telegram bots and MTProto userbots.

It gives you one application object, handlers for incoming events, filters, Bot API calls, and MTProto calls. Choose the connection type that matches your program:

- **Bot API** is the normal choice for a Telegram bot. Telegram sends updates over HTTPS.
- **MTProto** is the choice for a user account. The application connects to Telegram as that account.

These are two different Telegram interfaces. A bot token is for Bot API. `api_id` and `api_hash` are for MTProto.

## Learn by example

- [[Installation]]
- [[Quick-Start-Bot-API|Quick start: Bot API]]
- [[Quick-Start-MTProto-Userbot|Quick start: MTProto userbot]]
- [[Writing-Code|Writing GoyGram code]]
- [[Handlers-and-Updates|Handlers and updates]]
- [[Filters]]
- [[Keyboards-Formatting-and-State|Keyboards and state]]
- [[Files-and-Media|Files and media]]

## MTProto

- [[Sessions-and-Authentication|Sessions and authentication]]
- [[Configuration-and-Transports|Configuration and transports]]
- [[MTProto-Calls|MTProto calls]]
- [[MTProto-Message-Format|MTProto message format]]
- [[Bytes-and-TL|Bytes and TL data]]

## Reference

- [[GoyGram-Client-Reference|Client reference]]
- [[Event-Objects|Event objects]]
- [[Bot-API-Calls|Bot API calls]]
- [[Errors-Logging-and-Troubleshooting|Errors and troubleshooting]]

## Security

Never put a bot token, API hash, session file, auth key, or vault file in GitHub issues, source code, or logs.

For the current release and platform details, use the [GitHub repository](https://github.com/GoyGram/GoyGram). The documentation explains how to use the library; build and release details belong in the repository.
