---
title: Home
---

# GoyGram

![Логотип GoyGram](https://raw.githubusercontent.com/GoyGram/GoyGram/main/GoyGram.png)

GoyGram — библиотека Python для Telegram.

Она умеет работать двумя разными способами:

- **Bot API** — Telegram разговаривает с программой через HTTPS. Это обычный путь для ботов.
- **MTProto** — программа подключается как пользователь Telegram через низкоуровневое соединение. Это путь для userbot.

Внутри есть Python-код, Rust-расширение для части быстрых операций, общая очередь событий и два независимых транспорта. Эти транспорты не становятся одним «магическим» протоколом: Bot API и MTProto остаются разными системами.

Текущая опубликованная версия: **0.7.45**.

## Что реально публикуется

- Python wheels для Linux, Windows и macOS публикуются в PyPI.
- FreeBSD wheel собирается в настоящей FreeBSD VM и прикладывается к GitHub Release, потому что PyPI не принимает этот нестандартный platform tag.
- Для Termux собирается native Rust extension в `termux/termux-docker:x86_64` и прикладывается к GitHub Release. Это asset для x86_64, а не универсальный Android wheel.
- На ARM64 Termux пакет нужно собрать из исходников на самом устройстве.

## Начать

- [Installation](/docs/Installation)
- [Быстрый старт: Bot API](/docs/Quick-Start-Bot-API)
- [Быстрый старт: MTProto userbot](/docs/Quick-Start-MTProto-Userbot)
- [Как писать код для GoyGram](/docs/Writing-Code)
- [Как GoyGram раскладывает данные по байтам](/docs/Bytes-and-TL)
- [Конфигурация и транспорты](/docs/Configuration-and-Transports)

## Важно

`bot_token` относится к Bot API. `api_id` и `api_hash` относятся к MTProto. Это не взаимозаменяемые ключи.

Не вставляйте токены, API hash, session-файлы и содержимое vault в issues, логи или публичные репозитории.

## Остальная документация

- [Справочник клиента](/docs/GoyGram-Client-Reference)
- [Обработчики и обновления](/docs/Handlers-and-Updates)
- [Объекты событий](/docs/Event-Objects)
- [Фильтры](/docs/Filters)
- [Вызовы Bot API](/docs/Bot-API-Calls)
- [Вызовы MTProto](/docs/MTProto-Calls)
- [Сессии и аутентификация](/docs/Sessions-and-Authentication)
- [Ошибки и диагностика](/docs/Errors-Logging-and-Troubleshooting)
