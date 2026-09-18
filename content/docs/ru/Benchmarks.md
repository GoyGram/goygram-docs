---
title: "Бенчмарки"
---

# Бенчмарки

Воспроизводимые замеры лежат в [`benchmarks/`](https://github.com/GoyGram/GoyGram/tree/main/benchmarks). Цифры кодека: GoyGram 0.7.89, нативный PyDict, без JSON/hex моста. Это не живой Telegram и не mock DC.

## Пропускная способность AES-256-IGE (МБ/с, больше лучше)

| Библиотека | 256 Б | 4 КиБ | 64 КиБ |
|---|---|---|---|
| GoyGram (Rust, AES-NI, встроено) | 544 | 1001 | 1094 |
| tgcrypto 1.2.5 (C, отдельно) | 168 | 224 | 234 |
| pyrogram | 168 | 223 | 228 |
| telethon (по умолчанию) | 12 | 14 | 14 |

Задержка на 256 Б: GoyGram 0.4 мкс, tgcrypto 1.3 мкс, pyrogram 1.4 мкс, telethon 23 мкс.

## TL-кодек (операций/с)

Пакет: `updateNewMessage`, текст ~200 символов, форвард, инлайн-клавиатура. 356 байт.

| Операция | ops/s |
|---|---|
| serialize `messages.sendMessage` | 343 991 |
| dumps `updateNewMessage` | 106 580 |
| loads `updateNewMessage` | 228 493 |
| echo loads+dumps | 106 562 |
| AES-256-IGE enc+dec этого пакета | 850 540 |

Задержка loads (мкс): p50 3.7, p95 6.6, p99 8.2, p99.9 20.0.

## AES-256-GCM (4 КиБ, операций/с)

| Операция | ops/s |
|---|---|
| шифрование | 292 099 |
| расшифровка | 308 479 |

## Холодный импорт (мс, меньше лучше)

| Библиотека | мс |
|---|---|
| GoyGram | 74 |
| python-telegram-bot | 141 |
| telethon | 272 |
| pyrogram | 436 |
| aiogram | 2699 |

## Память, прирост RSS после импорта (МБ, меньше лучше)

| Библиотека | МБ |
|---|---|
| GoyGram | 13 |
| python-telegram-bot | 19 |
| pyrogram | 35 |
| telethon | 48 |
| aiogram | 152 |

## Как воспроизвести

```bash
git clone https://github.com/GoyGram/GoyGram && cd GoyGram/benchmarks
uv venv .bench && source .bench/bin/activate
uv pip install goygram telethon tgcrypto pyrogram aiogram python-telegram-bot
python bench_crypto.py
python bench_codec.py
python bench_import.py
```
