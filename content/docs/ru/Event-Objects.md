---
title: "Объекты событий"
---

# Объекты событий

GoyGram использует один динамический `Obj` для событий всех типов. Нормализованный словарь доступен как `raw`; поля, не попавшие в быстрый путь, доступны через ленивые атрибуты, `.get()` и `[]`.

`MsgObj`, `CbObj`, `PollObj`, `MemberObj`, `UpdateObj` и `InlineObj` — алиасы одного `goygram.types.Obj`. Отдельного класса под каждый тип нет и реестра моделей нет: объект формируется событием, которое он несёт, а `kind` (`"msg"`, `"cb"`, `"poll"`, `"member"`, `"inline"`, `"update"`, `"edit"`) говорит слою диспетчеризации, какой путь использовать.

## Общие поля

У каждого объекта события есть:

- `src`: `"mt"` или `"bot"`;
- `raw`: полное нормализованное обновление, а для MTProto и исходное декодированное;
- `app`: владеющий инстанс `GoyGram`;
- `id`, `chat_id`, `from_id`, `msg_id`, `kind`;
- `text`, `data`, `query`, `cmd`, `args`, `match` там, где событие их несёт;
- `inline_message_id` для колбэков от inline-сообщения.

Поля, различающиеся от обновления к обновлению, доступны без реестра моделей и тяжёлых аллокаций:

```python
@app.on_msg
async def inspect(msg):
    reply_to = msg.get("reply_to")
    entities = msg.entities
    media = msg.get("media")
    views = msg.get("views", 0)
```

`msg.field` и `msg.get("field", default)` сначала смотрят нормализованное событие, затем исходное сообщение Bot API или конструктор `message` MTProto — включая будущие поля схемы. `msg["field"]` бросает `KeyError`, если поля нет. `msg.to_dict()` возвращает нормализованный словарь без копирования.

## Inline-режим и колбэки

Inline-сообщения не живут в чате, к которому бот может обратиться по `chat_id` + `message_id`: Telegram адресует их через `inline_message_id`, и `Obj` хранит его как полноценное поле.

```python
@app.on_inline
async def inline_results(e):
    await e.answer(results=[
        e.article("r1", "Заголовок", "текст", kbd=[
            [{"text": "Нажми", "callback_data": "go"}],
        ]),
    ])

@app.on_cb
async def button(cb):
    if cb.inline_message_id is not None:
        await cb.edit("отредактировано в inline-сообщении")
    await cb.answer()
```

`e.article()` кладёт `reply_markup` на уровень результата — там, где его ждёт Bot API — и сам заворачивает сырой список рядов кнопок в `{"inline_keyboard": ...}`.

`await cb.edit(text, kbd=None)` редактирует сообщение, к которому пришита кнопка: по `inline_message_id` для inline-сообщений или по `chat_id` + `message_id` для обычных. Если Bot API-клиент не настроен, `edit()` бросает `RuntimeError`, а не молчит.

`await cb.answer(text=None, alert=False, url=None, cache_time=0)` отвечает на колбэк; для inline-запросов `await e.answer(results=[...])` отвечает на сам запрос.

## Методы сообщений

- `await msg.reply(text, kbd=None, topic_id=None, link_options=None, **kw)` — ответ в том же чате;
- `await msg.respond(text, **kw)` — новое сообщение без ответа на исходное;
- `await msg.edit(text, **kw)` — редактирование исходного сообщения;
- `await msg.forward_to(chat_id, **kw)` — пересылка;
- `await msg.pin(...)` / `await msg.unpin(**kw)` — закрепление;
- `await msg.react(reaction, **kw)` — реакция;
- `await msg.download(destination=None)` — скачивание Bot API-медиа при наличии `file_id`;
- `await msg.delete()` — удаление;
- `msg.net()` — исходный транспорт.

## Переходы участников

У событий участников есть `old` и `new` статусы (`old_status` / `new_status` в raw), `user_id` и `chat_id`. Полные объекты участников, права и кастомные титулы остаются в `raw` и доступны лениво.

## `on_update`

`on_update` получает тот же `Obj` для каждого структурированного события, включая сообщения, правки, колбэки, опросы и участников. Он сохраняет имя конструктора и полный raw:

```python
@app.on_update
async def any_update(update):
    print(update.update_type)
    print(update.raw)
```

`update.type` и `update.update_type` — алиасы. Не каждое поле есть у каждого типа обновления: для опциональных полей используйте `.get()` или фильтры.
