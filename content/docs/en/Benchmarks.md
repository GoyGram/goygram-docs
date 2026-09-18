---
title: Benchmarks
---

# Benchmarks

Reproducible measurements live in the [`benchmarks/`](https://github.com/GoyGram/GoyGram/tree/main/benchmarks) directory of the main repository. The scripts compare GoyGram against telethon, pyrogram, aiogram, python-telegram-bot, and tgcrypto on the same machine.

Codec numbers are GoyGram 0.7.89 on an AMD Ryzen 9 5950X VPS after the JSON/hex bridge was removed.

## AES-256-IGE throughput (MB/s, higher is better)

| Library | 256 B | 4 KiB | 64 KiB |
|---|---|---|---|
| GoyGram (Rust, AES-NI, built-in) | 544 | 1001 | 1094 |
| tgcrypto 1.2.5 (C, separate install) | 168 | 224 | 234 |
| pyrogram | 168 | 223 | 228 |
| telethon (default) | 12 | 14 | 14 |

Per-message latency at 256 B: GoyGram 0.4 µs, tgcrypto 1.3 µs, pyrogram 1.4 µs, telethon 23 µs.

GoyGram's IGE path uses AES-NI intrinsics selected at runtime with a software fallback. tgcrypto 1.2.5 is table-based software AES, which is why the gap is 3-4.7x. Both are far beyond what a Telegram client needs. The network round-trip dominates. GoyGram's crypto is built in, while tgcrypto (or Telethon's `cryptg`) is a separate install.

## TL codec, simple (ops/s)

| Operation | ops/s |
|---|---|
| serialize `messages.sendMessage` | 355,320 |
| loads `message` | 567,799 |

## TL codec, realistic `updateNewMessage` (ops/s)

Payload: ~200-char text, forward header, inline keyboard. Packet 356 B.

| Operation | ops/s |
|---|---|
| dumps `updateNewMessage` | 105,803 |
| loads `updateNewMessage` | 235,798 |
| echo loads+dumps | 107,615 |
| AES-256-IGE enc+dec of that packet | 862,432 |

loads latency (µs): p50 3.7, p95 6.5, p99 9.1, p99.9 26.5.

The full official schema (layer 229, 823 methods, 1698 constructors) loads once per process. Warm `loads` is a few microseconds.

## AES-256-GCM (4 KiB, ops/s)

Used for vault encryption:

| Operation | ops/s |
|---|---|
| encrypt | 288,219 |
| decrypt | 283,700 |

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

Numbers above were measured on a single VPS with an AMD Ryzen 9 5950X; expect different absolute values on other hardware, similar ratios.
