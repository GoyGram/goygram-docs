---
title: "Сахарный API"
---

GoyGram сохраняет свою суть с нулевой абстракцией: динамическая диспетчеризация, ленивые необработанные поля, отсутствие генерируемых моделей. Слой сахара представляет собой набор тонких оберток *поверх* транспортов, добавленных в версии 0.7.74. Ничто ниже не меняется; здесь все — необязательное удобство. Если вы никогда не импортируете его, вы ничего не платите.

## Помощники форматирования

`goygram.sugar` предоставляет небольшой конструктор `html` для HTML-разметки Telegram:


```python
from goygram import html

text = html.join(
    html.b("Title"),
    html.code("x = 1"),
    html.link("docs", "https://example.com"),
    sep="\n",
)
await app.send_msg(chat, text, parse_mode="HTML")
```


Полный список: `b`/`bold`, `i`/`italic`, `u`, `s`/`strike`, `code`, `pre(lang)`, `link`, `mention(user_id, name)`, `spoiler`, `quote(text, expandable=)`, `emoji(custom_id)`, `join(*parts, sep=)`.

Утилиты форматирования находятся в том же модуле:

| Помощник | Что он делает |
|---|---|
| `human_size(2048)` | `2.0 KB` |
| `human_duration(90)` | `1m 30s` |
| `chunk_text(long, 4096)` | разбивает длинный текст на части размером с Telegram |
| `parse_entities_html(text, entities)` | преобразует объекты API ботов в HTML |
| `progress_bar(done, total)` | `[#####     ]` |
| `code_block(code, "py")` | изолированный блок как готовая к отправке строка |
| `plural_ru(3, "ключ", "ключа", "ключей")` | Русские формы множественного числа |
| `json_dumps(obj)` | красивый JSON, обеспечения_ascii=False |
| `b64e`/`b64d` | помощники base64 байт |
| `rand_id()` | случайное целое число для полей `random_id` |

Все они также реэкспортируются из пакета верхнего уровня: `from goygram import html, human_size, chunk_text`.

## Сахар объекта события

Каждый объект события (`e`) получил свойства только для чтения, которые извлекаются из необработанных полей с разумными резервными вариантами:


```python
@app.on_msg()
async def h(e):
    if e.is_private and e.has_text:
        words = e.words            # text.split()
        n = e.word_count
        urls = e.urls              # url entities as strings
        if e.is_reply:
            orig = e.reply_msg     # lazy Obj for reply_to_message
        await e.reply(html.b("ok"))
```


- Чат: `chat_type` (также читается `raw["chat"]["type"]`), `chat_title`, `username`, `is_private`, `is_group`, `is_super_group`, `is_channel`
- Отправитель: `full_name`, `mention` (готовая HTML-ссылка), `from_id`, `is_out`
- Носители: `media_type`, `file_name`, `file_size`, `mime`, `is_media`, `file_id`.
– Текст: `has_text`, `words`, `word_count`, `args_list`, `command_name`, `html_text`, `urls`, `entities`.
- Время: `date_ts`, `edit_date_ts`, `ago` (`"5m"`, `"2h"`, `"3d"`)

Методы зеркально отражают клиента: `reply()`, `respond()`, `edit()`, `delete()`, `ask()`, `copy_to()`, `forward_to()`, `typing()`, `mark_read()`, `get_chat()`, `get_sender()`, `download()`, `answer()` (обратные вызовы/встроенные), `react()`.

## Отправка мультимедиа

Одна точка входа, два транспорта. Передача байтов, пути или URL-адреса http(s):


```python
await app.send_photo(chat, "photo.jpg", "caption")
await app.send_doc(chat, b"report.pdf", via="bot")
await app.send_voice(chat, "note.ogg")
await app.send_sticker(chat, "CAACAgIAAx0...")
```


`send_photo`, `send_doc`/`send_document`, `send_audio`, `send_video`, `send_voice`, `send_sticker`, `send_animation` весь маршрут через `send_media()`, который выбирает активный транспорт (`via=` переопределяет каждый вызов), угадывает MIME по расширению и загружает через `mt.upload_file`, когда MTProto активен.

Другие помощники клиента, добавленные в версии 0.7.74: `edit_msg`, `delete_msg` (одиночный или список), `get_chat`/`get_user` (кешируется, `refresh=` для обхода), `copy_msg` (истинный `copyMessage` в Bot API), `forward_msg`, `send_action`, `mark_read`, `send_reaction`, `pin_msg`, `ask`, `iter_dialogs`.

## Итерация диалога


```python
async for d in app.iter_dialogs(limit=50, batch=100):
    print(d.get("peer"), d.get("top_message"))
```


Только для MTProto, разбиение на страницы с помощью `messages.getDialogs`, тот же ленивый шаблон, что и `iter_history`.

## Горячие клавиши в конструкторе клавиатуры

`KbdBuilder` получил сочетания клавиш на уровне строк (полный API см. на странице «Клавиатуры»): `url()`, `cb()`, `copy()`, `switch()`, `web()`, а также `row()`, `line(btn_dict)`, `join(other_builder)`, `len()` и правдивость. Всё цепляет.

## Новые фильтры

К существующему набору добавляются 42 новых фильтра (всего экспортировано 251). Основные моменты:


```python
from goygram.filters import has_document, file_ext, arg_int, in_chat, reply_to_me, outgoing, mime_prefix
```

- Присутствие в СМИ: `has_photo`, `has_video`, `has_audio`, `has_voice`, `has_document`, `has_sticker`, `has_animation`, `has_video_note`, `has_contact`, `has_location`, `has_poll`, `has_dice`
- Аргументы: `args_count(n)`, `args_n(n)`, `arg_is(i, v)`, `arg_int(i)`, `arg_float(i)`, `caption(sub?)`
– Область чата: `in_chat(ids...)`, `chat_id_range(lo, hi)`, `from_chat_type(types...)`, `outgoing`, `incoming`, `silent_msg`.
- Ответить/переслать: `reply_to_me`, `forwarded_from(uid)`, `edited_recently(within)`
- Содержимое: `text_lower`, `has_digits`, `only_digits`, `is_command`, `url_contains`, `hashtag(tags...)`, `has_caption_entities(type?)`, `mime_is`, `mime_prefix`, `file_ext(exts...)`, `cmd_group(names...)`
- Время/хаос: `time_window(start, end, tz)`, `weekday(days...)`, `random_chance(p)`

## Обработка ошибок

Зарегистрируйте обработчики исключений, возникающих внутри ваших собственных обработчиков:


```python
@app.on_error
async def report(evt, exc):
    await app.send_msg(admin_chat, f"handler died: {exc!r}")
```


Функции синхронизации также поддерживаются. Обработчики срабатывают после записи внутреннего журнала; сломанный обработчик ошибок регистрируется и никогда не распространяется. `StopPropagation` по-прежнему учитывается — это не ошибка.

## Разговоры

Соответствие `conv_wait` теперь стало точным: входящее сообщение сначала разрешает будущее ожидание с ключом `(chat_id, from_id)`, затем `(chat_id, None)` и возвращается к любому-ожидающему только тогда, когда событие не содержит отправителя. `Obj.ask(prompt)` ожидает *того же пользователя*, который инициировал его по умолчанию (вместо этого `from_me=True` ждет вас).


```python
@app.on_cmd("form")
async def form(e):
    await e.reply("Name?")
    name = await e.ask()
    if name is None:
        await e.reply("timed out")
        return
    await e.reply(f"Hi, {html.b(name.text)}")
```