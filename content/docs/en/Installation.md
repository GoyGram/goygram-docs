---
title: Installation
---

# Installation

GoyGram supports CPython 3.8 and newer. PyPI wheels use `cp38-abi3`, so one native wheel covers every supported CPython version on the same platform.

## Install from PyPI

```bash
python -m pip install --upgrade goygram
```

Check what was installed:

```bash
python -c "from importlib.metadata import version; print(version('goygram'))"
```

The Python command and the command that starts your bot must use the same environment.

## Install from source

Use a source install when your platform does not have a compatible wheel, for example on an ARM64 Termux device:

```bash
pkg update
pkg install python rust clang
python -m pip install --no-build-isolation .
```

The source build needs a Rust compiler and a C compiler.

## Before you start

For a Bot API bot, create the bot with [BotFather](https://t.me/BotFather) and keep its token private.

For an MTProto userbot, create an application at [my.telegram.org](https://my.telegram.org) and keep its `api_id` and `api_hash` private.

Do not commit tokens, API hashes, session files, auth keys, or vault files.

Next: [Quick start: Bot API](/docs/Quick-Start-Bot-API) or [Quick start: MTProto userbot](/docs/Quick-Start-MTProto-Userbot).
