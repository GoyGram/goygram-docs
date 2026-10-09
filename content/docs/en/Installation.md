---
title: Installation
---

# Installation

GoyGram supports CPython 3.13 and newer. PyPI wheels are built against the stable ABI and carry the `cp38-abi3` tag, so one native wheel covers every supported CPython version on the same platform.

## Install from PyPI

```bash
python -m pip install --upgrade goygram
```

Check what was installed:

```bash
python -c "from importlib.metadata import version; print(version('goygram'))"
```

The Python command and the command that starts your bot must use the same environment.

## Install on Termux

Termux brings its own CPython, and from 3.13 that build reports Android platform tags, so pip picks a prebuilt wheel here the same way it does anywhere else:

```bash
pkg update
pkg install python-pip
pip install goygram
```

The wheels cover `arm64_v8a` phones and `x86_64` emulators and Chromebooks, built against Android API level 24. The dependencies resolve to wheels as well, so nothing is compiled on the device.

## Install from source

Use a source install when your platform does not have a compatible wheel:

```bash
git clone https://github.com/GoyGram/GoyGram
cd GoyGram
python -m pip install --no-build-isolation .
```

The source build needs a Rust compiler and a C compiler. On Termux that is `pkg install rust clang`.

## Before you start

For a Bot API bot, create the bot with [BotFather](https://t.me/BotFather) and keep its token private.

For an MTProto userbot, create an application at [my.telegram.org](https://my.telegram.org) and keep its `api_id` and `api_hash` private.

Do not commit tokens, API hashes, session files, auth keys, or vault files.

Next: [Quick start: Bot API](/docs/Quick-Start-Bot-API) or [Quick start: MTProto userbot](/docs/Quick-Start-MTProto-Userbot).
