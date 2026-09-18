---
title: Benchmarks
---

# Benchmarks

Reproducible measurements live in the [`benchmarks/`](https://github.com/GoyGram/GoyGram/tree/main/benchmarks) directory of the main repository.

Codec numbers below are GoyGram 0.7.89 on an AMD Ryzen 9 5950X VPS after the JSON/hex bridge was removed. Native PyDict `dumps`/`loads`. Not a live Telegram run and not a mock DC.

## AES-256-IGE throughput (MB/s, higher is better)

| Library | 256 B | 4 KiB | 64 KiB |
|---|---|---|---|
| GoyGram (Rust, AES-NI, built-in) | 544 | 1001 | 1094 |
| tgcrypto 1.2.5 (C, separate install) | 168 | 224 | 234 |
| pyrogram | 168 | 223 | 228 |
| telethon (default) | 12 | 14 | 14 |

Per-message latency at 256 B: GoyGram 0.4 µs, tgcrypto 1.3 µs, pyrogram 1.4 µs, telethon 23 µs.

## TL codec (ops/s)

Payload: `updateNewMessage` with ~200-char text, forward header, inline keyboard. Packet 356 B.

| Operation | ops/s |
|---|---|
| serialize `messages.sendMessage` | 343,991 |
| dumps `updateNewMessage` | 106,580 |
| loads `updateNewMessage` | 228,493 |
| echo loads+dumps | 106,562 |
| AES-256-IGE enc+dec of that packet | 850,540 |

loads latency (µs): p50 3.7, p95 6.6, p99 8.2, p99.9 20.0.

Layer 229 schema (823 methods, 1698 constructors) loads once. Warm `loads` is a few microseconds.

## AES-256-GCM (4 KiB, ops/s)

| Operation | ops/s |
|---|---|
| encrypt | 292,099 |
| decrypt | 308,479 |

## Cold import time (ms, lower is better)

| Library | ms |
|---|---|
| GoyGram | 74 |
| python-telegram-bot | 141 |
| telethon | 272 |
| pyrogram | 436 |
| aiogram | 2699 |

## Memory, RSS delta after import (MB, lower is better)

| Library | MB |
|---|---|
| GoyGram | 13 |
| python-telegram-bot | 19 |
| pyrogram | 35 |
| telethon | 48 |
| aiogram | 152 |

## Reproduce

```bash
git clone https://github.com/GoyGram/GoyGram && cd GoyGram/benchmarks
uv venv .bench && source .bench/bin/activate
uv pip install goygram telethon tgcrypto pyrogram aiogram python-telegram-bot
python bench_crypto.py
python bench_codec.py
python bench_import.py
```
