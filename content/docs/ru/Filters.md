---
title: "Фильтры"
---

# Фильтры

Фильтр решает, нужно ли передавать событие обработчику. Фильтры можно соединять операторами `&`, `|` и `~`.

```python
from goygram import filters
from goygram.filters import command, regex

@app.on_msg(filt=command("ban") & filters.admin & ~filters.me)
async def ban(msg):
    ...

@app.on_msg(filt=regex(r"^https?://"))
async def links(msg):
    ...
```

- `&` — оба условия должны быть верны;
- `|` — достаточно одного;
- `~` — отрицание.

Часто используются `filters.text`, `filters.me`, `filters.incoming`, `filters.outgoing`, `filters.private`, `filters.group`, `filters.channel`, `filters.photo`, `filters.document`, `filters.reply`, `filters.forwarded`, `filters.edited`, `filters.admin`.

Для команд есть `command("start")`. Для текста подходят `regex(...)`, `startswith(...)`, `endswith(...)`, `contains(...)` и `equals(...)`.

Фильтр, который не подходит событию, просто не вызывает обработчик.
