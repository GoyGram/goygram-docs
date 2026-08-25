---
title: Installation
---

# Installation

GoyGram is distributed on PyPI. It requires **Python 3.11+** and builds a Rust extension through Maturin.

```bash
python -m pip install --upgrade goygram
```

For a specific release:

```bash
python -m pip install --upgrade --force-reinstall goygram==0.7.45
```

Confirm that the interpreter which starts your program imports the expected package:

```bash
python -c "from importlib.metadata import version; import goygram; print(version('goygram')); print(goygram.__file__)"
```

## Platform note

The package includes Rust-backed TL serialization. Install it in the same Python environment that will run the application. On platforms without a compatible wheel, a local Rust toolchain and a compiler may be needed for installation.

## Credentials

- **Bot API:** create a bot with BotFather and use its token.
- **MTProto:** create an application at [my.telegram.org](https://my.telegram.org) and use its `api_id` and `api_hash`.

Do not commit tokens, API hashes, vault files, or generated session material.

Next: [Quick start: MTProto userbot](/docs/Quick-Start-MTProto-Userbot) or [Quick start: Bot API](/docs/Quick-Start-Bot-API).
