---
title: "Клавиатуры, форматирование и состояние"
---

# Клавиатуры, форматирование и состояние

## Клавиатуры

Клавиатуру можно собрать через объект приложения:

```python
keyboard = (
    app.ikb()
    .btn("Открыть", url="https://example.com")
    .row()
    .btn("Проверить", callback_data="ping")
)
await app.send_message(
    chat_id=123,
    text="Выберите действие:",
    reply_markup=keyboard.build(),
)
```

- `app.ikb()` создаёт inline-клавиатуру;
- `app.rkb(**opts)` создаёт обычную reply-клавиатуру;
- `app.frk(**opts)` создаёт ForceReply;
- `app.rgk(**opts)` убирает клавиатуру.

У `KbdBuilder` есть методы `btn()`, `row()`, `build()` и `to_dict()`. Параметры кнопки передаются выбранному типу клавиатуры Telegram.

## Форматирование

Если метод принимает `text` и `parse_mode`, можно подготовить их так:

```python
await app.send_message(chat_id=123, **app.html("<b>Привет</b>"))
```

Для MarkdownV2 используется `app.md(text)`. Не смешивайте HTML и MarkdownV2 в одном тексте.

## Состояние

По умолчанию состояние хранится в памяти и индексируется по `(chat_id, user_id)`:

```python
app.set_state(msg.chat_id, msg.from_id, "awaiting_name", {"step": 1}, ttl=300)
state = app.get_state(msg.chat_id, msg.from_id)
data = app.get_state_data(msg.chat_id, msg.from_id)
app.clear_state(msg.chat_id, msg.from_id)
```

`ttl` удаляет запись после указанного времени. Состояние пропадает после перезапуска процесса. Долгое хранение диалогов и маршрутизация шагов остаются задачей вашего приложения.
