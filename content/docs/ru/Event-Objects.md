---
title: "Объекты событий"
---

# Объекты событий

GoyGram приводит события Bot API и MTProto к небольшим Python-объектам.

## `MsgObj`

Сообщение: `text`, `chat_id`, `from_id`, `id`, `msg_id`, `is_me`, `cmd`, `args`, `match`, `raw`. Методы: `reply()` и `delete()`.

## `CbObj`

Нажатие callback-кнопки: `chat_id`, `from_id`, `msg_id`, `data`, `text`, `payload`, `raw`.

```python
await cb.answer("Готово")
await cb.edit("Новый текст")
```

## `PollObj`

Содержит `question`, `closed`, `kind` и исходное событие.

## `MemberObj`

Содержит `chat_id`, `user_id`, `old`, `new` и `kind`.

Не каждое поле есть у каждого типа обновления. Проверяйте значение перед использованием.
