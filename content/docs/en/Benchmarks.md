---
title: Benchmarks
---

# Benchmarks

Reproducible measurements against the major Python Telegram libraries: telethon, pyrogram, aiogram, and python-telegram-bot. All numbers were taken on a single unremarkable VPS (AMD Ryzen 9 5950X), in a fresh process, Python 3.11. The scripts live in `benchmarks/` in the repository and run with a single command.

## AES-256-IGE throughput (MB/s, higher is better)

| Library | 256 B | 4 KiB | 64 KiB |
|---|---|---|---|
| GoyGram (Rust, AES-NI, built-in) | 544 | 1001 | 1094 |
| tgcrypto (C, separate install) | 168 | 224 | 234 |
| pyrogram | 168 | 223 | 228 |
| telethon (default) | 12 | 14 | 14 |

Per-message latency at 256 B: GoyGram 0.4 µs, tgcrypto 1.3 µs, pyrogram 1.4 µs, telethon 23 µs.

GoyGram's IGE path uses AES-NI intrinsics selected at runtime with a software fallback for older CPUs. tgcrypto 1.2.5 is table-based software AES, which is why the gap is 3-4.7x. Both are far beyond what a Telegram client needs in practice — the network round-trip dominates — but GoyGram's crypto is built in, while tgcrypto (or Telethon's `cryptg`) must be installed separately.

## TL codec (ops/s, higher is better)

| Operation | ops/s |
|---|---|
| serialize `messages.sendMessage` | ~285,000 |
| deserialize a `message` object | ~66,000 |

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

## Honest notes

- **tgcrypto loses on raw AES-IGE now.** tgcrypto 1.2.5 drives table-based software AES; GoyGram's core dispatches to AES-NI intrinsics when the CPU has them. The difference is that GoyGram's crypto is built in, while tgcrypto must be installed separately.
- **Telethon's default path is slow** because it drives OpenSSL through `ctypes`, re-running the key schedule and unpacking buffers byte-by-byte on every call. Its fast path (`cryptg`) is not installed by default.
- **aiogram's import time and memory** are dominated by pydantic v2.
- Numbers were measured on one machine; expect different absolute values elsewhere, similar ratios.
