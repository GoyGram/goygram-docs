---
title: "Benchmarks"
---

# Benchmarks

Reproducible measurements live in the [`benchmarks/`](https://github.com/GoyGram/GoyGram/tree/main/benchmarks) directory of the main repository. The scripts compare GoyGram against telethon, pyrogram, aiogram, python-telegram-bot, and tgcrypto on the same machine.

## AES-256-IGE throughput (MB/s, higher is better)

| Library | 256 B | 4 KiB | 64 KiB |
|---|---|---|---|
| GoyGram (Rust, AES-NI, built-in) | 544 | 1001 | 1094 |
| tgcrypto 1.2.5 (C, separate install) | 168 | 224 | 234 |
| pyrogram | 168 | 223 | 228 |
| telethon (default) | 12 | 14 | 14 |

Per-message latency at 256 B: GoyGram 0.4 µs, tgcrypto 1.3 µs, pyrogram 1.4 µs, telethon 23 µs.

GoyGram's IGE path uses AES-NI intrinsics selected at runtime with a software fallback. tgcrypto 1.2.5 is table-based software AES, which is why the gap is 3-4.7x. Both are far beyond what a Telegram client needs — the network round-trip dominates — but GoyGram's crypto is built in, while tgcrypto (or Telethon's `cryptg`) is a separate install.

## TL codec (ops/s)

| Operation | ops/s |
|---|---|
| serialize `messages.sendMessage` | ~285,000 |
| deserialize `message` object | ~66,000 |

The full official schema (layer 229, 823 methods, 1698 constructors) loads in ~31 ms from cache; a warm `serialize_method` call costs well under a microsecond. Dynamic dispatch does not mean slow.

## AES-256-GCM (4 KiB, ops/s)

Used for vault encryption:

| Operation | ops/s |
|---|---|
| encrypt | ~313,000 |
| decrypt | ~304,000 |

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