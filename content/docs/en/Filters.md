---
title: Filters
---

# Filters

Filters are callable predicates. Combine them with `&`, `|`, and `~`.

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

## Core message filters

Common predicates include:

- Identity and direction: `me`, `user`, `from_user(id)`, `from_any(*ids)`, `not_from(*ids)`, `is_bot`, `is_premium`, `is_verified`, `is_scam`, `is_fake`, `is_support`.
- Chat context: `private`, `group`, `supergroup`, `channel`, `forum`, `chat_type(type)`, `chat(id)`, `any_chat(*ids)`, `not_chat(*ids)`, `topic(id)`.
- Text: `text`, `command(*names)`, `regex(pattern)`, `fullmatch(pattern)`, `startswith(prefix)`, `endswith(suffix)`, `contains(value)`, `contains_any(...)`, `contains_all(...)`, `text_len(...)`, `word_count(...)`, `line_count(...)`, `numeric`, `json_text`, `is_language(...)`.
- Reply and forwarding: `reply`, `forwarded`, `via_bot`.
- Media: `media`, `photo`, `video`, `audio`, `voice`, `document`, `sticker`, `animation`, `video_note`, `location`, `contact`, `venue`, `dice`, `game`, `invoice`, `story`, `giveaway`, `media_group`.
- Metadata: `edited`, `pinned`, `silent`, `mentioned`, `has_mention`, `has_hashtag`, `has_url`, `has_media_spoiler`, `has_protected_content`.
- State and identity checks: `is_bot`, `is_premium`, `is_verified`, `is_scam`, `is_fake`, `is_support`, `lang_code(...)`, and `state(...)`.

## Entities and callback data

Entity predicates include `has_mention`, `has_url`, `has_hashtag`, `has_email`, `has_phone`, `has_bold`, `has_italic`, `has_code`, `has_pre`, `has_text_link`, and `has_custom_emoji`.

For callbacks, use `cb_data(value)`, `cb_startswith(prefix)`, `cb_endswith(suffix)`, `cb_contains(value)`, `cb_regex(pattern)`, `cb_payload(...)`, `cb_json(...)`, `cb_kvp(...)`, `cb_from(id)`, `cb_chat(id)`, `cb_msg(id)`, `cb_game`, and `cb_any`.

Some predicates only make sense for a particular update type. A missing field simply makes that predicate false.
