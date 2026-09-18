---
title: "Бенчмарки"
---

# Бенчмарки

Воспроизводимые замеры лежат в [`benchmarks/`](https://github.com/GoyGram/GoyGram/tree/main/benchmarks). Скрипты сравнивают GoyGram с telethon, pyrogram, aiogram, python-telegram-bot и tgcrypto на одной машине.

Цифры кодека: GoyGram 0.7.89, нативный PyDict, без JSON/hex моста.

## Пропускная способность AES-256-IGE (МБ/с, больше лучше)

| Библиотека | 256 Б | 4 КиБ | 64 КиБ |
|---|---|---|---|
| GoyGram (Rust, AES-NI, встроено) | 544 | 1001 | 1094 |
| tgcrypto 1.2.5 (C, отдельно) | 168 | 224 | 234 |
| pyrogram | 168 | 223 | 228 |
| telethon (по умолчанию) | 12 | 14 | 14 |

Задержка на 256 Б: GoyGram 0.4 мкс, tgcrypto 1.3 мкс, pyrogram 1.4 мкс, telethon 23 мкс.

IGE-путь GoyGram использует AES-NI в рантайме, с программным запасным путём. tgcrypto 1.2.5 это табличный программный AES, отсюда разрыв в 3-4.7 раза. Оба быстрее, чем нужно клиенту: узкое место сеть. Криптография GoyGram встроена, tgcrypto (или `cryptg` у Telethon) ставится отдельно.

## TL-кодек, простой (операций/с)

| Операция | ops/s |
|---|---|
| serialize `messages.sendMessage` | 355 320 |
| loads `message` | 567 799 |

## TL-кодек, реалистичный `updateNewMessage` (операций/с)

Пакет: текст ~200 символов, форвард, инлайн-клавиатура. 356 байт.

| Операция | ops/s |
|---|---|
| dumps `updateNewMessage` | 105 803 |
| loads `updateNewMessage` | 235 798 |
| echo loads+dumps | 107 615 |
| AES-256-IGE enc+dec этого пакета | 862 432 |

Задержка loads (мкс): p50 3.7, p95 6.5, p99 9.1, p99.9 26.5.

Полная схема (layer 229, 823 метода, 1698 конструкторов) грузится один раз на процесс. Тёплый `loads` это несколько микросекунд.

## AES-256-GCM (4 КиБ, операций/с)

Шифрование хранилищ сессий (vault):

| Операция | ops/s |
|---|---|
| шифрование | 288 219 |
| расшифровка | 283 700 |

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

Числа сняты на VPS с AMD Ryzen 9 5950X. На другом железе абсолютные значения будут другими, соотношения близкими.
