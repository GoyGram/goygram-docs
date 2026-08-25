---
title: "Файлы и медиа"
---

# Файлы и медиа

Медиа Bot API вызывается так же, как остальные методы.

```python
await app.send_document(
    chat_id=msg.chat_id,
    document="FILE_ID_OR_URL",
    caption="Отчёт",
)

await app.send_photo(
    chat_id=msg.chat_id,
    photo="FILE_ID_OR_URL",
    caption="Скриншот",
)
```

`file_id` удобен для повторной отправки файла, который уже есть у Telegram. URL можно использовать там, где это разрешает сам Bot API.

Входящее медиа доступно через объект `MsgObj` и его поля `photo`, `document`, `video`, `audio`, `voice`, `sticker` и другие. Поля, которые GoyGram не выносит отдельно, остаются в `msg.raw`.

Для MTProto используются TL-методы с префиксом `mt_`. Их параметры должны соответствовать текущей TL-схеме Telegram.
