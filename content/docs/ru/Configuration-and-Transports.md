---
title: "Конфигурация и транспорты"
---

# Конфигурация и транспорты

Один объект `GoyGram` может включать Bot API, MTProto или оба транспорта.

```python
app = GoyGram(
    bot_token="BOT_TOKEN",
    api_id=12345,
    api_hash="API_HASH",
    session_name="production",
)
```

`bot_token` включает Bot API. `api_id` и `api_hash` включают MTProto. Это разные интерфейсы и разные типы авторизации.

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
```

Префикс `bot:` явно выбирает Bot API. Префикс `mt:` явно выбирает MTProto.

`await app.run()` запускает обработчики и включённые транспорты. `app.stop()` запускает аккуратное завершение.
