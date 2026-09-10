---
title: "Сахарный API"
---

GoyGram сохраняет свою суть с нулевой абстракцией: динамическая диспетчеризация, ленивые необработанные поля, отсутствие генерируемых моделей. Слой сахара представляет собой набор тонких оберток *поверх* транспортов, добавленных в версии 0.7.74. Ничто ниже не меняется; здесь все — необязательное удобство. Если вы никогда не импортируете его, вы ничего не платите.

## Помощники по форматированию

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


`parse_mode="md"` (MarkdownV2) is also supported on MTProto sends and edits: `md_to_entities()` converts `*bold*`, `_italic_`, `__underline__`, `~~strike~~`, `||spoiler||`, `` `code` ``, ` 
```lang ...```
 `, and `[text](url)` / `[text](tg://user?id=...)` into native entities, stripping escapes and markers from the plain text. Both parsers emit offsets in UTF-16 code units (what Telegram expects), so emoji before an entity never shifts it. `md_escape(text)` escapes MarkdownV2 specials for raw Bot API sends.


```python
from goygram import md_to_entities, md_escape
plain, entities = md_to_entities("*hi* _there_ `[x](y)_")
await app.send_msg(chat, "*bold*", parse_mode="md")
```


Full list: `b`/`bold`, `i`/`italic`, `u`, `s`/`strike`, `code`, `pre(lang)`, `link`, `mention(user_id, name)`, `spoiler`, `quote(text, expandable=)`, `emoji(custom_id)`, `join(*parts, sep=)`.

Utility formatters live in the same module:

| Helper | What it does |
|---|---|
| `human_size(2048)` | `2.0 KB` |
| `human_duration(90)` | `1m 30s` |
| `chunk_text(long, 4096)` | splits long text into Telegram-sized parts |
| `parse_entities_html(text, entities)` | converts Bot API entities to HTML |
| `progress_bar(done, total)` | `[#####     ]` |
| `code_block(code, "py")` | fenced block as a ready-to-send string |
| `plural_ru(3, "ключ", "ключа", "ключей")` | Russian plural forms |
| `json_dumps(obj)` | pretty JSON, ensure_ascii=False |
| `b64e`/`b64d` | base64 bytes helpers |
| `rand_id()` | random int for `random_id` fields |

All of these are also re-exported from the top-level package: `from goygram import html, human_size, chunk_text`.

## Event object sugar

Every event object (`e`) gained read-only properties that pull from raw fields with sane fallbacks:


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


- Chat: `chat_type` (also reads `raw["chat"]["type"]`), `chat_title`, `username`, `is_private`, `is_group`, `is_super_group`, `is_channel`
- Sender: `full_name`, `mention` (ready HTML link), `from_id`, `is_out`
- Media: `media_type`, `file_name`, `file_size`, `mime`, `is_media`, `file_id`
- Text: `has_text`, `words`, `word_count`, `args_list`, `command_name`, `html_text`, `urls`, `entities`
- Time: `date_ts`, `edit_date_ts`, `ago` (`"5m"`, `"2h"`, `"3d"`)

Methods mirror the client: `reply()`, `respond()`, `edit()`, `delete()`, `ask()`, `copy_to()`, `forward_to()`, `typing()`, `mark_read()`, `get_chat()`, `get_sender()`, `download()`, `answer()` (callbacks/inline), `react()`.

## Sending media

Media sends carry automatic metadata: `send_voice`/`send_audio` probe the real duration via `media_duration()` (stdlib `wave` for WAV, `mutagen` if installed, `ffprobe` fallback) and attach `documentAttributeAudio` with the true length, so voice bubbles never show `0:00`. Non-OGG files sent as `voice` get their mime forced to `audio/ogg`. MTProto uploads now serialize nested constructors correctly (`inputFile` with `md5_checksum`) — photo/voice/audio sends work end-to-end.

One entry point, two transports. Pass bytes, a path, or an http(s) URL:


```python
await app.send_photo(chat, "photo.jpg", "caption")
await app.send_doc(chat, b"report.pdf", via="bot")
await app.send_voice(chat, "note.ogg")
await app.send_sticker(chat, "CAACAgIAAx0...")
```


`send_photo`, `send_doc`/`send_document`, `send_audio`, `send_video`, `send_voice`, `send_sticker`, `send_animation` all route through `send_media()`, which picks the active transport (`via=` overrides per call), guesses MIME by extension, and uploads via `mt.upload_file` when MTProto is active.

Other client helpers added in 0.7.74: `edit_msg`, `delete_msg` (single or list), `get_chat`/`get_user` (cached, `refresh=` to bypass), `copy_msg` (true `copyMessage` on Bot API), `forward_msg`, `send_action`, `mark_read`, `send_reaction`, `pin_msg`, `ask`, `iter_dialogs`.

Added in 0.7.75: `send_rich`/`edit_rich` (see [Rich API](/docs/Rich-API)), `download_media` (Bot API file_id or MTProto document/photo location, both transports), `get_self`/`get_self(full=True)` (self user dict, optionally with `users.getFullUser`), `search_messages` (MTProto `messages.search`), `iter_search` (lazy search iterator with pagination), `vote_poll` (`messages.sendVote`), `get_forum_topics` (Bot API `getForumTopics` or MTProto `messages.getForumTopics`), `send_media_group` (true album via `messages.sendMultiMedia`), `send_contact`/`send_venue`/`send_location`/`send_poll`/`send_dice`, `promote_member`/`ban_member`/`unban_member`/`create_invite_link`, `set_chat_title`/`set_chat_about`, `join_chat`/`leave_chat`, `get_chat_info`, `send_draft`, `pin_msg`/`unpin_msg`/`unpin_all`, `iter_participants`/`iter_members`, and a full typing map in `send_action` (`record_video`, `upload_document`, `choose_sticker`, `find_location`, `record_video_note`, `upload_video_note`, ... with `progress=`).

## Dialog iteration


```python
async for d in app.iter_dialogs(limit=50, batch=100):
    print(d.get("peer"), d.get("top_message"))
```


MTProto-only, paginated via `messages.getDialogs`, same lazy pattern as `iter_history`.

## Keyboard builder shortcuts

`KbdBuilder` got row-level shortcuts (see Keyboards page for the full API): `url()`, `cb()`, `copy()`, `switch()`, `web()`, plus `row()`, `line(btn_dict)`, `join(other_builder)`, `len()`, and truthiness. Everything chains.

## New filters

42 new filters join the existing set (251 total exported). Highlights:


```python
from goygram.filters import has_document, file_ext, arg_int, in_chat, reply_to_me, outgoing, mime_prefix
```


- Media presence: `has_photo`, `has_video`, `has_audio`, `has_voice`, `has_document`, `has_sticker`, `has_animation`, `has_video_note`, `has_contact`, `has_location`, `has_poll`, `has_dice`
- Arguments: `args_count(n)`, `args_n(n)`, `arg_is(i, v)`, `arg_int(i)`, `arg_float(i)`, `caption(sub?)`
- Chat scope: `in_chat(ids...)`, `chat_id_range(lo, hi)`, `from_chat_type(types...)`, `outgoing`, `incoming`, `silent_msg`
- Reply/forward: `reply_to_me`, `forwarded_from(uid)`, `edited_recently(within)`
- Content: `text_lower`, `has_digits`, `only_digits`, `is_command`, `url_contains`, `hashtag(tags...)`, `has_caption_entities(type?)`, `mime_is`, `mime_prefix`, `file_ext(exts...)`, `cmd_group(names...)`
- Time/chaos: `time_window(start, end, tz)`, `weekday(days...)`, `random_chance(p)`

## Error handling

Register handlers for exceptions raised inside your own handlers:


```python
@app.on_error
async def report(evt, exc):
    await app.send_msg(admin_chat, f"handler died: {exc!r}")
```


Sync functions are supported too. Handlers fire after the internal log entry; a broken error handler is logged, never propagated. `StopPropagation` is still respected — it is not an error.

## Conversations

`conv_wait` matching is now precise: an incoming message resolves the waiting future with key `(chat_id, from_id)` first, then `(chat_id, None)`, and only falls back to any-waiter when the event carries no sender. `Obj.ask(prompt)` waits for the *same user* who triggered it by default (`from_me=True` waits for yourself instead).

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