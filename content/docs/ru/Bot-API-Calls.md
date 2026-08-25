---
title: "Вызовы Bot API"
---

# Вызовы Bot API

GoyGram переводит имена методов из `snake_case` в формат Telegram Bot API.

```python
await app.send_message(chat_id=123, text="Привет")
await app.delete_message(chat_id=123, message_id=456)
```

Это вызовет методы Telegram `sendMessage` и `deleteMessage`. Параметры со значением `None` не отправляются.

Если нужно указать имя метода как в документации Telegram:

```python
await app.bot_req("sendMessage", chat_id=123, text="Привет")
```

Динамические вызовы доступны, если приложение создано с `bot_token`. При включённых двух транспортах имя без префикса относится к Bot API. Для MTProto используется `mt_`.

Список параметров и формат ответа проверяйте в официальной документации [Telegram Bot API](https://core.telegram.org/bots/api).
