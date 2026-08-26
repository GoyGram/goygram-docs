---
title: "Фильтры"
---

# Фильтры

Фильтр решает, нужно ли передавать событие обработчику. Фильтры можно соединять операторами `&`, `|` и `~`.

```python
from goygram import filters
from goygram.filters import command, regex

@app.on_msg(filt=command("ban") & filters.chat_type("supergroup") & ~filters.me)
async def ban(msg):
    ...

@app.on_msg(filt=regex(r"^https?://"))
async def links(msg):
    ...
```

- `&` — оба условия должны быть верны;
- `|` — достаточно одного;
- `~` — отрицание.

Часто используются `filters.text`, `filters.me`, `filters.user`, `filters.private`, `filters.group`, `filters.supergroup`, `filters.channel`, `filters.chat_type(...)`, `filters.photo`, `filters.document`, `filters.reply`, `filters.forwarded`, `filters.edited`, `filters.has_hashtag`.

Для команд есть `command("start")`. Для текста подходят `regex(...)`, `startswith(...)`, `endswith(...)`, `contains(...)`, `contains_any(...)`, `contains_all(...)`, `text_len(...)`, `word_count(...)` и `line_count(...)`.

Фильтр, который не подходит событию, просто не вызывает обработчик.
