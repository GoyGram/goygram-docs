---
title: Home
---

# GoyGram

![GoyGram logo](https://raw.githubusercontent.com/GoyGram/GoyGram/main/GoyGram.png)

GoyGram is an asynchronous Python framework for Telegram bots and MTProto userbots.

It gives you one application object, handlers for incoming events, filters, Bot API calls, and MTProto calls. Choose the connection type that matches your program:

- **Bot API** is the normal choice for a Telegram bot. Telegram sends updates over HTTPS.
- **MTProto** is the choice for a user account. The application connects to Telegram as that account.

These are two different Telegram interfaces. A bot token is for Bot API. `api_id` and `api_hash` are for MTProto.

## Learn by example

- [Installation](/docs/Installation)
- [Quick start: Bot API](/docs/Quick-Start-Bot-API)
- [Quick start: MTProto userbot](/docs/Quick-Start-MTProto-Userbot)
- [Writing GoyGram code](/docs/Writing-Code)
- [Handlers and updates](/docs/Handlers-and-Updates)
- [Filters](/docs/Filters)
- [Keyboards and state](/docs/Keyboards-Formatting-and-State)
- [Files and media](/docs/Files-and-Media)

## MTProto

- [Sessions and authentication](/docs/Sessions-and-Authentication)
- [Configuration and transports](/docs/Configuration-and-Transports)
- [MTProto calls](/docs/MTProto-Calls)
- [MTProto message format](/docs/MTProto-Message-Format)
- [Bytes and TL data](/docs/Bytes-and-TL)

## Reference

- [Client reference](/docs/GoyGram-Client-Reference)
- [Event objects](/docs/Event-Objects)
- [Bot API calls](/docs/Bot-API-Calls)
- [Errors and troubleshooting](/docs/Errors-Logging-and-Troubleshooting)

## Security

Never put a bot token, API hash, session file, auth key, or vault file in GitHub issues, source code, or logs.

For the current release, see the [GitHub repository](https://github.com/GoyGram/GoyGram). This Wiki and the documentation site explain how to use the framework.
