---
title: "Filters"
---

# Filters

Filters are callable predicates. Combine them with `&`, `|`, and `~`.


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


## Core message filters

Common predicates include:

- Identity and direction: `me`, `outgoing`, `incoming`, `bot`, `user`, `from_user(id)`, `from_chat(id)`, `sender(id)`, `chat(id)`.
- Chat context: `private`, `group`, `supergroup`, `channel`, `forum`, `broadcast`, `is_group`, `is_channel`, `chat_type(type)`.
- Text: `text`, `command(*names, prefixes=("/", "!"), ignore_case=True, sep=" ")`, `regex(pattern)`, `fullmatch(pattern)`, `startswith(prefix)`, `endswith(suffix)`, `contains(value)`, `equals(value)`, `length(minimum, maximum)`.
- Reply and forwarding: `reply`, `reply_to(message_id)`, `forwarded`, `via_bot`.
- Media: `media`, `photo`, `video`, `audio`, `voice`, `document`, `animation`, `sticker`, `location`, `contact`, `poll`, `dice`, `web_page`, `invoice`.
- Metadata: `edited`, `scheduled`, `pinned`, `silent`, `mentioned`, `hashtag`, `url`, `has_media_spoiler`, `has_protected_content`.
- Access checks: `admin`, `creator`, `member`, `restricted`, `left`, `kicked`, `can_send_messages`, `can_send_media`, `can_delete_messages`, `can_restrict_members`, and other `can_*` capability checks.

## Entities and callback data

Entity predicates include `has_mention`, `has_url`, `has_hashtag`, `has_bot_command`, `has_bold`, `has_italic`, `has_code`, `has_pre`, `has_text_link`, and `has_custom_emoji`.

For callbacks, use `callback_data(value)`, `callback_startswith(prefix)`, `callback_endswith(suffix)`, `callback_contains(value)`, `callback_regex(pattern)`, `callback_from_user(id)`, and `callback_in_chat(id)`.

Some predicates only make sense for a particular update type. A missing field simply makes that predicate false.