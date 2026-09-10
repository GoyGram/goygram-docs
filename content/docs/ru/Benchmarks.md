---
title: "Бенчмарки"
---

# Бенчмарки

Воспроизводимые замеры лежат в каталоге [`benchmarks/`](https://github.com/GoyGram/GoyGram/tree/main/benchmarks) основного репозитория. Скрипты сравнивают GoyGram с telethon, pyrogram, aiogram, python-telegram-bot и tgcrypto на одной машине.

## Пропускная способность AES-256-IGE (МБ/с, больше — лучше)

| Библиотека | 256 Б | 4 КиБ | 64 КиБ |
|---|---|---|---|
| GoyGram (Rust, AES-NI, встроено) | 544 | 1001 | 1094 |
| tgcrypto 1.2.5 (C, отдельная установка) | 168 | 224 | 234 |
| pyrogram | 168 | 223 | 228 |
| telethon (по умолчанию) | 12 | 14 | 14 |

Задержка на сообщение при 256 Б: GoyGram 0.4 мкс, tgcrypto 1.3 мкс, pyrogram 1.4 мкс, telethon 23 мкс.

IGE-путь GoyGram использует интринсики AES-NI, выбираемые в рантайме, с программным фолбэком. tgcrypto 1.2.5 — табличный программный AES, отсюда разрыв в 3–4.7 раза. Оба варианта многократно быстрее потребностей Telegram-клиента — узкое место всегда сеть — но криптография GoyGram встроена, тогда как tgcrypto (или `cryptg` для Telethon) ставится отдельно.

## TL-кодек (операций/с)

| Операция | ops/s |
|---|---|
| сериализация `messages.sendMessage` | ~285 000 |
| десериализация объекта `message` | ~66 000 |

Полная официальная схема (layer 229, 823 метода, 1698 конструкторов) грузится из кэша за ~31 мс; тёплый вызов `serialize_method` стоит сильно меньше микросекунды. Динамическая диспетчеризация не значит «медленно».

## AES-256-GCM (4 КиБ, операций/с)

Используется для шифрования хранилищ сессий (vault):

| Операция | ops/s |
|---|---|
| шифрование | ~313 000 |
| расшифровка | ~304 000 |

## Время холодного импорта (мс, меньше — лучше)

| Библиотека | мс |
|---|---|
| GoyGram | 74 |
| python-telegram-bot | 141 |
| telethon | 272 |
| pyrogram | 436 |
| aiogram | 2699 |

## Память, прирост RSS после импорта (МБ, меньше — лучше)

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

Числа выше измерены на VPS с AMD Ryzen 9 5950X; на другом железе абсолютные значения будут другими, соотношения — близкими.
