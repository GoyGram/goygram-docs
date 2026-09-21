---
title: "Бенчмарки"
---

# Бенчмарки

Воспроизводимые замеры лежат в [`benchmarks/`](https://github.com/GoyGram/GoyGram/tree/main/benchmarks). Скрипты сравнивают GoyGram с telethon, pyrogram, aiogram, python-telegram-bot и tgcrypto на одной машине.

Все числа сняты на GoyGram 0.8.4 и AMD Ryzen 9 5950X. В таблицах указаны медианы нескольких запусков с привязкой к одному ядру CPU.

## Пропускная способность AES-256-IGE (МБ/с, больше лучше)

| Библиотека | 256 Б | 4 КиБ | 64 КиБ |
|---|---|---|---|
| GoyGram (Rust, AES-NI, встроено) | 503.7 | 969.3 | 1062.5 |
| tgcrypto 1.2.5 (C, отдельно) | 151.3 | 198.6 | 204.3 |
| pyrogram | 144.9 | 196.2 | 202.4 |
| telethon (по умолчанию) | 9.0 | 10.5 | 10.8 |

Задержка на 256 Б: GoyGram 0.6 мкс, tgcrypto 1.6 мкс, pyrogram 1.7 мкс, telethon 29.4 мкс.

IGE-путь GoyGram использует AES-NI в рантайме, с программным запасным путём. tgcrypto 1.2.5 это табличный программный AES, отсюда разрыв в 3-4.7 раза. Оба быстрее, чем нужно клиенту: узкое место сеть. Криптография GoyGram встроена, tgcrypto (или `cryptg` у Telethon) ставится отдельно.

## TL-кодек, простой (операций/с)

| Операция | ops/s |
|---|---|
| serialize `messages.sendMessage` | 351 270 |
| loads `message` | 577 821 |

## TL-кодек, реалистичный `updateNewMessage` (операций/с)

Пакет: текст ~200 символов, форвард, инлайн-клавиатура. 356 байт.

| Операция | ops/s |
|---|---|
| dumps `updateNewMessage` | 97 283 |
| loads `updateNewMessage` | 225 347 |
| echo loads+dumps | 107 395 |
| AES-256-IGE enc+dec этого пакета | 889 291 |

Задержка loads (мкс): p50 3.8, p95 6.4, p99 8.9, p99.9 20.7.

Полная схема (layer 229, 823 метода, 1698 конструкторов) грузится один раз на процесс. Тёплый `loads` это несколько микросекунд.

## AES-256-GCM (4 КиБ, операций/с)

Шифрование хранилищ сессий (vault):

| Операция | ops/s |
|---|---|
| шифрование | 293 032 |
| расшифровка | 290 105 |

## Холодный импорт (мс, меньше лучше)

| Библиотека | мс |
|---|---|
| GoyGram | 77.2 |
| python-telegram-bot | 142.8 |
| telethon | 342.0 |
| pyrogram | 461.5 |
| aiogram | 3016.3 |

## Память, прирост RSS после импорта (МБ, меньше лучше)

| Библиотека | МБ |
|---|---|
| GoyGram | 10.8 |
| python-telegram-bot | 18.8 |
| pyrogram | 35.6 |
| telethon | 48.4 |
| aiogram | 152.2 |

## Как воспроизвести

```bash
git clone https://github.com/GoyGram/GoyGram && cd GoyGram/benchmarks
python -m venv .bench && source .bench/bin/activate
python -m pip install goygram telethon tgcrypto pyrogram aiogram python-telegram-bot
python bench_crypto.py
python bench_codec.py
python bench_import.py
```

Числа сняты на VPS с AMD Ryzen 9 5950X. На другом железе абсолютные значения будут другими, соотношения близкими.
