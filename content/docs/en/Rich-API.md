---
title: Rich API
---

Rich Messages are Telegram's new-generation message format: in-message buttons, collapsible details, collages, slideshows, maps, expandable quotes. GoyGram ships a builder with zero abstractions: every method appends raw HTML to a flat parts list, and the final payload is one `inputRichMessageHTML` constructor (MTProto) or one `{html}` JSON object (Bot API).

## The idea

No model classes, no tree structures. `Rich` is a parts list; `build()` joins it:

```python
from goygram import Rich

r = Rich().b("Bold").text(" plain").nl().link("Site", "https://example.com")
print(r.to_html())
# <b>Bold</b> plain<br><a href="https://example.com">Site</a>
```

`to_html()` also converts bare `\n` to `<br>` (Rich HTML collapses raw newlines), `to_msg()` returns the Bot API JSON payload, `to_tl()` the MTProto TL constructor.

## Sending

```python
await app.send_rich(chat_id, r)                    # MTProto or Bot API, auto
await app.send_rich(chat_id, "<b>raw html string</b>")  # plain string works too
await app.edit_rich(chat_id, msg_id, r)           # edit in place
```

Both transports normalize newlines themselves, so the `<br>` injection shim you needed before is gone.

## In-message buttons

The headline feature. Buttons live inside the message body, not in a reply keyboard:

```python
r = (
    Rich()
    .b("Menu")
    .nl()
    .btn_row(
        Rich().btn_url("Open site", "https://example.com"),
        Rich().btn_user("Profile", 111040773),
    )
    .btn_cb("Callback button", "menu:main")
)
await app.send_rich(chat_id, r)
```

Button kinds: `btn_url`, `btn_user`, `btn_cb` (callback data), `btn_app` (mini app), `btn_login`, `btn_inline` / `btn_inline_chosen` (inline query switches), `btn_copy` (copy-to-clipboard), `btn_disabled`. Every button takes an optional `style` (positive / destructive / neutral). `btn_row(*buttons, align=...)` puts several buttons on one row, `buttons(rows, align=...)` renders a list of rows.

## Blocks

```python
r = Rich()
r.details("Steps", "1. install\n2. import\n3. done")          # collapsible <details>
r.list(["one", "two", "three"], ordered=True)                  # <ol>/<ul>
r.quote("Quoted line", cite="Author")                         # <blockquote>
r.pull_quote("Big pull quote")                                 # pull-quote block
r.img("https://example.com/p.jpg", caption="Photo caption")    # HTTP(S) media block
r.video("https://example.com/v.mp4")
r.collage(["https://a/1.jpg", "https://a/2.jpg"], caption="Two")
r.slideshow([("https://a/1.jpg", "First"), ("https://a/2.jpg", "Second")])
r.map(55.75222, 37.61556)                                      # live map block
r.math(r"E = mc^2")                                            # LaTeX formula
r.time(1757000000)                                             # localized datetime entity
r.anchor("chapter-1")                                          # navigation anchor
r.emoji(5368324170671202286, "❤")                              # premium custom emoji
r.mention(111040773, "sam")                                    # user mention link
```

## Inline formatting

`text`, `b`, `i`, `u`, `s`, `spoiler`, `code`, `pre(lang)`, `link`, `heading(level)`, `nl`. All of them are one-line appends, no hidden state.

## html_to_entities: MTProto classic messages with formatting

Rich is one option; classic messages take raw text plus explicit TL entities. GoyGram converts HTML to that pair for you:

```python
await app.send_msg(chat_id, "<b>bold</b> <i>italic</i>", parse_mode="html")
```

With `parse_mode="html"` on MTProto, `send_msg`/`edit_msg` strip the tags and attach `messageEntityBold` / `messageEntityItalic` / `messageEntityTextUrl` / `messageEntityPre` / `messageEntitySpoiler` / `messageEntityBlockquote` / `inputMessageEntityMentionName` / `messageEntityCustomEmoji` spans automatically. The same function is importable directly:

```python
from goygram import html_to_entities
plain, entities = html_to_entities('<a href="tg://user?id=42">Sam</a> works')
```

## split_html_text: long HTML without broken tags

Sending long formatted output used to need a hand-rolled splitter that reopens tags on every part. Now:

```python
from goygram import split_html_text
for part in split_html_text(big_html, limit=4096):
    await app.send_msg(chat_id, part)
```

It tokenizes tags and text, tracks open tags on a stack, reserves room for closing tags, and reopens them at the start of each part. Sizes are counted in UTF-16 units (the way Telegram counts).

## extract_sent_message: one answer shape for sends

`send_msg` / `send_media` return the raw RPC result, which may be an `updates` wrapper, a bare message, or an `updateShortSentMessage`. Extract the message dict in one call:

```python
from goygram import extract_sent_message
res = await app.send_msg(chat_id, "hi")
msg = extract_sent_message(res)
msg_id = msg["id"] if msg else None
```

## get_self

Self account info without recursive dict walks:

```python
me = await app.get_self()          # cached user dict
me = await app.get_self(full=True) # adds users.getFullUser result under "full"
premium = me["full"].get("premium") if "full" in me else me.get("premium")
```

## CamelCase dynamic dispatch

Every one of the 185 Bot API methods and the full MTProto surface is reachable through dynamic attribute dispatch, in three styles:

```python
await app.get_me()                     # explicit sugar
await app.getMe()                      # Bot API camelCase
await app.AnswerInlineQuery(inline_query_id=q, results=[])  # camelCase too
await app.mt_users_getUsers(id=[{"_": "inputUserSelf"}])   # explicit MTProto
await app.UsersGetUsers(id=[{"_": "inputUserSelf"}])        # camel MTProto
```

Names starting with a known MTProto namespace (`users`, `channels`, `messages`, `contacts`, ...) route to MTProto first; everything else routes to Bot API first. Existing snake_case methods win over any dynamic resolution.
