---
title: "Файлы и медиа"
---

# Файлы и медиа

Медиа Bot API отправляется через ту же поверхность динамических вызовов, что и остальные методы. Используйте параметры методов Telegram напрямую и передавайте их в GoyGram как ключевые аргументы.

## Отправка файла или медиа

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

`file_id` — самый эффективный способ переслать медиа, которое Telegram уже знает. URL принимаются методами, где их поддерживает сам Bot API. Для multipart-загрузки используйте форму параметров актуального Bot API-транспорта и проверяйте её на своём эндпоинте.

Файлы Bot API скачиваются через `await app.download_file(file_id, destination=None)`: без `destination` вернутся байты, с путём — файл атомарно записывается на диск.

## Пересылка и копирование сообщений

```python
await app.forward_message(
    chat_id=target_chat,
    from_chat_id=msg.chat_id,
    message_id=msg.id,
)

await app.copy_message(
    chat_id=target_chat,
    from_chat_id=msg.chat_id,
    message_id=msg.id,
)
```

Динамические имена переводятся из snake_case в camelCase Bot API: `copy_message` превращается в `copyMessage`.

## Разбор входящих сообщений

Обработчик сообщений получает `MsgObj` (алиас динамического `goygram.types.Obj`). Среди нормализованных полей: `text`, `id`, `chat_id`, `from_id`; медиа и прочие Bot API-поля доступны через `msg.raw`.

```python
@app.on_msg
async def inspect(msg):
    if msg.raw.get("document"):
        await msg.reply("Получил документ")
```

## Медиа MTProto

В MTProto `app.core.mt.upload_file(source, file_name=None, part_size=524288)` загружает файлы по частям через `upload.saveFilePart`, а `app.core.mt.download_file(location, destination, offset=0, limit=524288)` скачивает части через `upload.getFile`. Аргументы медийных методов вроде `messages.sendMedia` должны соответствовать активной TL-схеме Telegram. Перед работой с сырыми MTProto-объектами прочитайте [Вызовы MTProto](/docs/MTProto-Calls).

`file_reference` у Telegram со временем протухает. Если во время скачивания сервер отвечает `FILE_REFERENCE_EXPIRED`, GoyGram сам обновляет ссылку из медиа-полезной нагрузки исходного сообщения и повторяет тот же запрос — без вашего участия:

```python
data = await core.download_media(msg, dest=None)
```

Обновление берётся из медиа-данных сообщения или документа, поэтому старые, но ещё валидные ссылки восстанавливаются при первом использовании.

## Параллельные загрузки charged

Для больших файлов стандартные `upload_file` / `download_file` работают по одному соединению. Транспорт `charged` открывает до 20 параллельных MTProto-соединений на общем auth-ключе сессии и раскидывает части файла по ним (stride-схема):

```python
handle = await app.charged_upload("big_video.mp4", part_size=524288)

size = await app.charged_download(location, "backup.mp4", size=known_size)
```

- `charged_upload(source, file_name, part_size, progress, connections)` — возвращает описатель загрузки (id, parts, md5), маленькие файлы (до 10 МБ) отправляются как единый `upload.saveBigFilePart`-набор, большие — как big-file по частям;
- `charged_download(location, destination, size, part_size, progress, media_source, connections)` — если размер заранее неизвестен (size=0), автоматически откатывается на обычный `download_file`;
- при ответе `FILE_MIGRATE_X` charged сам экспортирует авторизацию в файловый DC (`auth.exportAuthorization` / `auth.importAuthorization`), кэширует ключ этого DC в vault и повторяет загрузку;
- число соединений подбирается автоматически по размеру файла (1 МБ — 1 соединение, 50 МБ — 10, от 100 МБ — 20) либо задаётся аргументом `connections`.

Техника параллельных соединений адаптирована из mautrix-telegram (parallel_file_transfer, AGPL-3.0).

См. также [Вызовы Bot API](/docs/Bot-API-Calls) и [Объекты событий](/docs/Event-Objects).
