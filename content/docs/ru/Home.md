---
title: "Home"
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

- [[Installation]]
- [[Quick-Start-Bot-API|Быстрый старт: Bot API]]
- [[Quick-Start-MTProto-Userbot|Быстрый старт: MTProto userbot]]
- [[Writing-Code|Как писать код для GoyGram]]
- [[Bytes-and-TL|Как GoyGram раскладывает данные по байтам]]
- [[Configuration-and-Transports|Конфигурация и транспорты]]

## Важно

`bot_token` относится к Bot API. `api_id` и `api_hash` относятся к MTProto. Это не взаимозаменяемые ключи.

Не вставляйте токены, API hash, session-файлы и содержимое vault в issues, логи или публичные репозитории.

## Остальная документация

- [[GoyGram-Client-Reference|Справочник клиента]]
- [[Handlers-and-Updates|Обработчики и обновления]]
- [[Event-Objects|Объекты событий]]
- [[Filters|Фильтры]]
- [[Bot-API-Calls|Вызовы Bot API]]
- [[MTProto-Calls|Вызовы MTProto]]
- [[Sessions-and-Authentication|Сессии и аутентификация]]
- [[Errors-Logging-and-Troubleshooting|Ошибки и диагностика]]