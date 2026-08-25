---
title: "Вызовы MTProto"
---

# Вызовы MTProto

Для MTProto используется префикс `mt_`, затем имя пространства и метода в `snake_case`.

```python
dialogs = await app.mt_messages_get_dialogs(
    offset_date=0,
    offset_id=0,
    offset_peer={"_": "inputPeerEmpty"},
    limit=5,
    hash=0,
)
```

Это вызовет TL-метод `messages.getDialogs`.

Можно указать имя метода напрямую:

```python
result = await app.mt_req("messages.getDialogs", limit=5, hash=0)
```

Конструкторы TL передаются словарями с полем `_`:

```python
{"_": "inputPeerEmpty"}
```

Имена методов, параметры и результаты зависят от актуальной TL-схемы Telegram. Не запускайте два reader-цикла на одном MTProto-соединении: `app.run()` сам принимает обновления.
