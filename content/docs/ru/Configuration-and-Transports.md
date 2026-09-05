---
title: "Конфигурация и транспорты"
---

# Конфигурация и транспорты

Один объект `GoyGram` может включать Bot API, MTProto или оба транспорта. Передайте все три параметра (`bot_token` + `api_id` + `api_hash`), чтобы запустить **гибридного бота**: транспорт Bot API плюс бот, авторизованный по MTProto через `auth.importBotAuthorization`.

```python
app = GoyGram(
    bot_token="BOT_TOKEN",
    api_id=12345,
    api_hash="API_HASH",
    session_name="production",
    default_transport="mtproto",   # "api", "mtproto" или "auto"
)
```

`bot_token` включает Bot API. `api_id` и `api_hash` включают MTProto. Это разные интерфейсы и разные типы авторизации.

Параметр `session=` принимает объект `Session` или зашифрованную строку сессии; `session_name=` — обычная короткая запись для файлового хранилища. `default_transport` задаёт транспорт по умолчанию для исходящих вызовов, когда `via` не указан.

## Bot API

```python
app = GoyGram(
    bot_token="BOT_TOKEN",
    bot_timeout=25,
    bot_base="https://api.telegram.org",
)
```

Обычно `bot_base` менять не нужно.

## MTProto

```python
app = GoyGram(
    api_id=12345,
    api_hash="API_HASH",
    session_name="my-account",
    proxy="socks5://127.0.0.1:1080",
)
```

GoyGram сам выбирает дата-центр Telegram. `mt_host`, `mt_port`, `mt_key` и `mt_iv` нужны только для специальных низкоуровневых подключений.

## Как выбрать транспорт

```python
await app.send_message(chat_id="bot:123456", text="сообщение боту")
await app.mt_messages_send_message(peer="me", message="сообщение пользователя")

# явный выбор транспорта для конкретного вызова:
await app.send_msg("123456", "через api", via="api")        # Bot API
await app.send_msg("123456", "через mtproto", via="mtproto")  # MTProto
```

Префикс `bot:` явно выбирает Bot API. Префикс `mt:` явно выбирает MTProto. `via="api"` — псевдоним Bot API, `via="mtproto"` — псевдоним MTProto (короткие `via="bot"` / `via="mt"` тоже работают). Без префикса и `via` используется `default_transport`, затем Bot API, если он есть, иначе MTProto.

`await app.run()` запускает обработчики и включённые транспорты. `app.stop()` запускает аккуратное завершение.
