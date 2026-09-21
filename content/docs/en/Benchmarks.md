---
title: Benchmarks
---

# Benchmarks

Reproducible measurements live in the [`benchmarks/`](https://github.com/GoyGram/GoyGram/tree/main/benchmarks) directory of the main repository. The scripts compare GoyGram against telethon, pyrogram, aiogram, python-telegram-bot, and tgcrypto on the same machine.

All numbers are GoyGram 0.8.4 on an AMD Ryzen 9 5950X VPS. Tables use medians of repeated runs pinned to one CPU.

## AES-256-IGE throughput (MB/s, higher is better)

| Library | 256 B | 4 KiB | 64 KiB |
|---|---|---|---|
| GoyGram (Rust, AES-NI, built-in) | 503.7 | 969.3 | 1062.5 |
| tgcrypto 1.2.5 (C, separate install) | 151.3 | 198.6 | 204.3 |
| pyrogram | 144.9 | 196.2 | 202.4 |
| telethon (default) | 9.0 | 10.5 | 10.8 |

Per-message latency at 256 B: GoyGram 0.6 µs, tgcrypto 1.6 µs, pyrogram 1.7 µs, telethon 29.4 µs.

GoyGram's IGE path uses AES-NI intrinsics selected at runtime with a software fallback. tgcrypto 1.2.5 is table-based software AES, which is why the gap is 3-4.7x. Both are far beyond what a Telegram client needs. The network round-trip dominates. GoyGram's crypto is built in, while tgcrypto (or Telethon's `cryptg`) is a separate install.

## TL codec, simple (ops/s)

| Operation | ops/s |
|---|---|
| serialize `messages.sendMessage` | 351,270 |
| loads `message` | 577,821 |

## TL codec, realistic `updateNewMessage` (ops/s)

Payload: ~200-char text, forward header, inline keyboard. Packet 356 B.

| Operation | ops/s |
|---|---|
| dumps `updateNewMessage` | 97,283 |
| loads `updateNewMessage` | 225,347 |
| echo loads+dumps | 107,395 |
| AES-256-IGE enc+dec of that packet | 889,291 |

loads latency (µs): p50 3.8, p95 6.4, p99 8.9, p99.9 20.7.

The full official schema (layer 229, 823 methods, 1698 constructors) loads once per process. Warm `loads` is a few microseconds.

## AES-256-GCM (4 KiB, ops/s)

Used for vault encryption:

| Operation | ops/s |
|---|---|
| encrypt | 293,032 |
| decrypt | 290,105 |

## Cold import time (ms, lower is better)

| Library | ms |
|---|---|
| GoyGram | 77.2 |
| python-telegram-bot | 142.8 |
| telethon | 342.0 |
| pyrogram | 461.5 |
| aiogram | 3016.3 |

## Memory, RSS delta after import (MB, lower is better)

| Library | MB |
|---|---|
| GoyGram | 10.8 |
| python-telegram-bot | 18.8 |
| pyrogram | 35.6 |
| telethon | 48.4 |
| aiogram | 152.2 |

## Reproduce

```bash
git clone https://github.com/GoyGram/GoyGram && cd GoyGram/benchmarks
python -m venv .bench && source .bench/bin/activate
python -m pip install goygram telethon tgcrypto pyrogram aiogram python-telegram-bot
python bench_crypto.py
python bench_codec.py
python bench_import.py
```

Numbers above were measured on a single VPS with an AMD Ryzen 9 5950X; expect different absolute values on other hardware, similar ratios.
