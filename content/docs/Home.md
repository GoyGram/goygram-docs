---
title: "Split-brain in action — one runtime, two transports"
---

Welcome to the **GoyGram** wiki — the complete reference for the ultimate split-brain Telegram framework.

<p align="center">
  <img src="https://raw.githubusercontent.com/GoyGram/GoyGram/main/GoyGram.png" alt="GoyGram Logo" width="650">
</p>

## What This Wiki Covers

Every single line of GoyGram is documented here. No hand-waving, no "trust me bro." Just what the bits actually do.

### What You'll Find Here

- **Core Architecture** — How the split-brain Python+Rust design actually works under the hood. Event bus topology, dispatcher pipeline, and the dynamic method resolution system that lets you call `app.sendDocument(...)` without it being a hardcoded method.
- **Networking Deep-Dive** — Both Bot API (HTTP long-polling via aiohttp) and MTProto (raw TCP socket with full DH key exchange, AES-IGE encryption, and RSA public-key verification). Every packet format, every encryption step.
- **Authentication & Security** — The complete session vault system (AES-256-GCM with PBKDF2 key derivation from machine-id), interactive login flows (phone number + QR code), 2FA/SRP password handling, third-party `.session` migration with secure zeroization, and the `GOYGRAM_VAULT_KEY` override mechanism.
- **Full Client API Reference** — Every public method, every event type (`MsgObj`, `CbObj`, `PollObj`, `MemberObj`), the filter system with boolean composition, command routing, and keyboard builders.
- **Internals & Tooling** — The TL codec that builds MTProto TL-serialized bytes by hand, the RSA key registry with all 8 Telegram public keys, the code generation tools that scrape Telegram's Bot API docs and TL schema, and the `maturin`-based Rust extension build pipeline.
- **Advanced Patterns** — Multi-session farming, dual-transport routing, proxy tunneling (SOCKS5 + HTTP CONNECT), dynamic DC migration on `PHONE_MIGRATE` errors, and the QR code login token lifecycle.

## Quick Navigation

- **Just getting started?** → [Quick Start: Bot API](Quick-Start-Bot-API) or [Quick Start: MTProto Userbot](Quick-Start-MTProto-Userbot)
- **Want to understand the architecture?** → [Architecture Overview](Architecture-Overview) → [Split-Brain Design](Split-Brain-Design)
- **Digging into networking?** → [Bot API Transport](Bot-API-Transport) or [MTProto Transport](MTProto-Transport)
- **Auth deep-dive?** → [Session Vault (AES-256-GCM)](Session-Vault-AES-256-GCM) → [Interactive Auth Flow](Interactive-Auth-Flow)
- **API reference?** → [Client Full Reference](Client-Full-Reference) → [MTProto Actions Reference](MTProto-Actions-Reference)

## Project Snapshot

```python
# Split-brain in action — one runtime, two transports
from goygram import GoyGram, filters

app = GoyGram(
    bot_token="123456:ABC_TOKEN",     # Bot API transport
    api_id=123456,                     # MTProto transport
    api_hash="abcdef0123456789",
    session_name="my_account",
)

@app.on_msg(filt=filters.text)
async def echo(msg):
    await msg.reply("Received on either transport. GoyGram handles routing.")
```

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg?style=for-the-badge&logo=python)](https://www.python.org)
[![Rust Core](https://img.shields.io/badge/Rust_Core-Blazing_Fast-orange.svg?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-red.svg?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)
