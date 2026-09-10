---
title: "Сахарный API"
---

Ядро GoyGram остаётся с нулём абстракций: динамическая диспетчеризация, ленивые сырые поля, никаких сгенерированных моделей. Сахарный слой — это тонкие обёртки *поверх* транспортов, появившиеся в 0.7.74. Ничего ниже не меняется, всё здесь — необязательное удобство. Не импортируете — не платите.

## Помощники форматирования

`goygram.sugar` даёт небольшой билдер `html` для HTML-разметки Telegram:

```python
from goygram import html

text = html.join(
    html.b("Заголовок"),
    html.code("x = 1"),
    html.link("доки", "https://example.com"),
    sep="\n",
)
await app.send_msg(chat, text, parse_mode="HTML")
```

Полный список: `b`/`bold`, `i`/`italic`, `u`, `s`/`strike`, `code`, `pre(lang)`, `link`, `mention(user_id, name)`, `spoiler`, `quote(text, expandable=)`, `emoji(custom_id)`, `join(*parts, sep=)`.

Утилиты форматирования лежат в том же модуле:

| Помощник | Результат |
|---|---|
| `human_size(2048)` | `2.0 KB` |
| `human_duration(90)` | `1m 30s` |
| `chunk_text(long, 4096)` | режет длинный текст на куски по лимиту Telegram |
| `parse_entities_html(text, entities)` | конвертирует entities Bot API в HTML |
| `progress_bar(done, total)` | `[#####     ]` |
| `code_block(code, "py")` | fenced-блок в виде готовой строки |
| `plural_ru(3, "ключ", "ключа", "ключей")` | русские формы множественного числа |
| `json_dumps(obj)` | красивый JSON, ensure_ascii=False |
| `b64e`/`b64d` | base64-помощники для байтов |
| `rand_id()` | случайное целое для полей `random_id` |

Всё это реэкспортировано с верхнего уровня: `from goygram import html, human_size, chunk_text`.

## Сахар объекта события

Каждый объект события (`e`) получил свойства только для чтения, которые достаются из сырых полей с разумными фолбэками:

```python
@app.on_msg()
async def h(e):
    if e.is_private and e.has_text:
        words = e.words            # text.split()
        n = e.word_count
        urls = e.urls              # url-entities строками
        if e.is_reply:
            orig = e.reply_msg     # ленивый Obj для reply_to_message
        await e.reply(html.b("ok"))
```

- Чат: `chat_type`, `chat_title`, `username`, `is_private`, `is_group`, `is_super_group`, `is_channel`
- Отправитель: `full_name`, `mention` (готовая HTML-ссылка), `from_id`, `is_out`
- Медиа: `media_type`, `file_name`, `file_size`, `mime`, `is_media`, `file_id`
- Текст: `has_text`, `words`, `word_count`, `args_list`, `command_name`, `html_text`, `urls`, `entities`
- Время: `date_ts`, `edit_date_ts`, `ago` (`"5m"`, `"2h"`, `"3d"`)

Методы зеркалят клиент: `reply()`, `respond()`, `edit()`, `delete()`, `ask()`, `copy_to()`, `forward_to()`, `typing()`, `mark_read()`, `get_chat()`, `get_sender()`, `download()`, `answer()` (колбэки/inline), `react()`.

## Отправка медиа

Одна точка входа, два транспорта. Принимает байты, путь или http(s)-URL:

```python
await app.send_photo(chat, "photo.jpg", "подпись")
await app.send_doc(chat, b"report.pdf", via="bot")
await app.send_voice(chat, "note.ogg")
await app.send_sticker(chat, "CAACAgIAAx0...")
```

`send_photo`, `send_doc`/`send_document`, `send_audio`, `send_video`, `send_voice`, `send_sticker`, `send_animation` — всё идёт через `send_media()`, который выбирает активный транспорт (`via=` переопределяет на каждый вызов), угадывает MIME по расширению и загружает через `mt.upload_file`, когда активен MTProto.

Другие помощники клиента из 0.7.74: `edit_msg`, `delete_msg` (одно сообщение или список), `get_chat`/`get_user` (с кэшем, `refresh=` обходит его), `copy_msg` (настоящий `copyMessage` в Bot API), `forward_msg`, `send_action`, `mark_read`, `send_reaction`, `pin_msg`, `ask`, `iter_dialogs`.

## Итерация диалогов

```python
async for d in app.iter_dialogs(limit=50, batch=100):
    print(d.get("peer"), d.get("top_message"))
```

Только MTProto: пагинация через `messages.getDialogs`, тот же ленивый паттерн, что у `iter_history`.

## Шорткаты билдера клавиатур

`KbdBuilder` получил строковые шорткаты (полный API — на странице клавиатур): `url()`, `cb()`, `copy()`, `switch()`, `web()`, а также `row()`, `line(btn_dict)`, `join(other_builder)`, `len()` и truthiness. Всё чейнится.

## Новые фильтры

К существующим добавились 42 фильтра (всего экспортируется 251). Основное:

```python
from goygram.filters import has_document, file_ext, arg_int, in_chat, reply_to_me, outgoing, mime_prefix
```

- Медиа: `has_photo`, `has_video`, `has_audio`, `has_voice`, `has_document`, `has_sticker`, `has_animation`, `has_video_note`, `has_contact`, `has_location`, `has_poll`, `has_dice`
- Аргументы: `args_count(n)`, `args_n(n)`, `arg_is(i, v)`, `arg_int(i)`, `arg_float(i)`, `caption(sub?)`
- Область чата: `in_chat(ids...)`, `chat_id_range(lo, hi)`, `from_chat_type(types...)`, `outgoing`, `incoming`, `silent_msg`
- Ответы и пересылки: `reply_to_me`, `forwarded_from(uid)`, `edited_recently(within)`
- Контент: `text_lower`, `has_digits`, `only_digits`, `is_command`, `url_contains`, `hashtag(tags...)`, `has_caption_entities(type?)`, `mime_is`, `mime_prefix`, `file_ext(exts...)`, `cmd_group(names...)`
- Время/хаос: `time_window(start, end, tz)`, `weekday(days...)`, `random_chance(p)`

## Обработка ошибок

Регистрируйте обработчики исключений, которые вылетают из ваших же хендлеров:

```python
@app.on_error
async def report(evt, exc):
    await app.send_msg(admin_chat, f"handler died: {exc!r}")
```

Синхронные функции тоже поддерживаются. Обработчики ошибки срабатывают после внутренней записи в лог; сломанный error-обработчик логируется и никогда не пробрасывается наружу. `StopPropagation` по-прежнему уважается — это не ошибка.

## Диалоги (conversations)

Сопоставление в `conv_wait` стало точным: входящее сообщение сначала резолвит ожидающий future по ключу `(chat_id, from_id)`, затем `(chat_id, None)`, и только потом откатывается к любому ждущему, если у события нет отправителя. `Obj.ask(prompt)` по умолчанию ждёт *того же пользователя*, который вызвал (`from_me=True` ждёт вас самого):

```python
@app.on_cmd("form")
async def form(e):
    await e.reply("Имя?")
    name = await e.ask()
    if name is None:
        await e.reply("время вышло")
        return
    await e.reply(f"Привет, {html.b(name.text)}")
```

## Админство и модерация

Права передаются обычными словарями, маппинг одинаков на обоих транспортах:

```python
await app.ban_member(chat, user, until=ts)
await app.unban_member(chat, user)
await app.kick_member(chat, user)
await app.promote_member(chat, user, rights={"can_delete_messages": True}, title="mod")
await app.demote_member(chat, user)
await app.restrict_member(chat, user, {"send_messages": True}, until=ts)
await app.set_slow_mode(chat, 30)
```

Ссылки-приглашения (в MTProto это `messages.getExportedChatInvites` / `messages.editExportedChatInvite`):

```python
links = await app.get_invite_links(chat, admin_id=me)
await app.edit_invite_link(chat, link, name="main", member_limit=50)
await app.revoke_invite_link(chat, link)
await app.approve_join_request(chat, user)
await app.decline_join_request(chat, user)
```

`on_update` получает типизированные `updatePendingJoinRequests` / `updateBotChatInviteRequester` с распакованными `chat_id` / `from_id`.

## Истории (Stories)

Домен только для MTProto (в Bot API нет story-методов для ботов):

```python
mine = await app.get_stories("me")
res = await app.send_story("me", "photo.jpg", "подпись", pinned=True, period=86400)
await app.edit_story("me", story_id, caption="новая")
await app.delete_story("me", [1, 2])
await app.read_stories(peer, max_id=5)
views = await app.get_story_views(peer, [1])
link = await app.export_story_link(peer, story_id)
```

`updateStory` / `updateReadStories` / `updateSentStoryReaction` приходят типизированными с полями `owner_id` / `story_id`.

## Звёзды и подарки

```python
balance = await app.get_stars_balance()
gifts = await app.get_star_gifts()
await app.send_star_gift(peer, gift_id, message="с днём рождения")
```

`send_star_gift` идёт по реальному пути: `inputInvoiceStarGift` → `payments.getPaymentForm` → `payments.sendStarsForm`. `updateBotChatBoost` приходит типизированным с сырой нагрузкой `boost`.

## Черновики и отложенные сообщения

```python
await app.save_draft(chat, "недописанный текст")
drafts = await app.get_all_drafts()
sched = await app.get_scheduled_messages(chat)
await app.send_scheduled(chat, "привет", schedule_date=ts)
await app.delete_scheduled(chat, [msg_id])
```

`updateDraftMessage` приходит типизированным с `chat_id` и сырой нагрузкой черновика.

## Выгрузка данных (takeout)

Любой MTProto-вызов принимает `takeout_id=` и автоматически оборачивается в `invokeWithTakeout`:

```python
t = await app.start_takeout(files=True)
tid = t["result"]["id"]
res = await app.mt_req("account.getPrivacy", takeout_id=tid, key={"_": "inputPrivacyKeyStatusTimestamp"})
await app.finish_takeout(tid, success=False)
```

Init и finish не оборачивают сами себя; любой другой вызов с `takeout_id` едет внутри takeout-контекста.

## Покрытие обновлений

`on_update` теперь превращает все значимые семейства обновлений в типизированные поля до raw-фолбэка: набор текста (user/chat/channel), истории, папки и фильтры диалогов, бусты, реакции (вариант сообщений и бот-вариант), заявки на вступление, черновики, закреплённые сообщения, прочтение истории, статус/имя/телефон/emoji пользователя, сервисные уведомления, удаление сообщений и изменения участников каналов. Неизвестные обновления по-прежнему приходят с `update_type` + `raw` без потерь.
