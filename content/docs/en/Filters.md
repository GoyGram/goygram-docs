---
title: Filters
---

# Filters

Filters are lightweight callable predicates. They read fields lazily from the event object, so nested Bot API messages and structured MTProto messages use the same filter API. Combine filters with `&`, `|`, `^`, `~`, `-`, or the composition helpers.

```python
@app.on_msg(filt=(filters.photo | filters.document) & filters.caption_contains("invoice"))
async def media_handler(msg):
    await msg.respond("media received")
```

A missing optional field makes a predicate false. Constructor filters such as `command(...)`, `regex(...)`, `media_size(...)`, and `update_type(...)` are created with call syntax.

## All exported filters

The current source exports **207 filters and helper classes** (excluding the base `Filter`).

### Text and parsing

`text`, `command`, `regex`, `fullmatch`, `findall`, `finditer`, `split`, `contains`, `contains_any`, `contains_all`, `startswith`, `endswith`, `text_len`, `word_count`, `line_count`, `numeric`, `json_text`, `is_language`.

### Entities and formatting

`has_entity`, `has_url`, `has_mention`, `has_hashtag`, `has_cashtag`, `has_email`, `has_phone`, `has_bold`, `has_italic`, `has_code`, `has_pre`, `has_spoiler`, `has_custom_emoji`, `has_blockquote`, `has_underline`, `has_strikethrough`, `has_text_link`, `has_text_mention`, `has_bank_card`, `mentioned`, `has_protected_content`, `has_media_spoiler`, `has_markup`, `has_inline_kbd`, `has_reply_kbd`, `has_web_preview`, `has_sender_name`.

### Media

`photo`, `video`, `audio`, `document`, `sticker`, `animation`, `voice`, `video_note`, `location`, `contact`, `venue`, `dice`, `game`, `invoice`, `story`, `giveaway`, `media`, `media_group`, `caption`, `media_size`, `media_duration`, `media_mime`, `media_width`, `media_height`, `file_name`, `specific_media_group`, `album_len`, `caption_regex`, `caption_contains`, `caption_len`.

### Chat and message metadata

`private`, `group`, `supergroup`, `channel`, `chat_type`, `forum`, `chat`, `any_chat`, `not_chat`, `topic`, `me`, `from_user`, `from_any`, `not_from`, `is_bot`, `is_premium`, `is_verified`, `is_scam`, `is_fake`, `is_support`, `is_contact`, `is_mutual_contact`, `lang_code`, `edited`, `forwarded`, `reply`, `pinned`, `has_protected_content`, `has_media_spoiler`, `via_bot`, `is_topic_message`, `has_markup`, `has_inline_kbd`, `has_reply_kbd`, `has_web_preview`, `silent`, `from_offline`, `effect`, `noforwards`, `views`, `forwards`, `reaction`, `has_sender_name`, `signature`, `message_id`.

### Service updates

`new_chat_members`, `left_chat_member`, `new_chat_title`, `new_chat_photo`, `delete_chat_photo`, `group_created`, `supergroup_created`, `channel_created`, `migrate_to`, `migrate_from`, `pinned_msg`, `connected_website`, `proximity_alert`, `video_chat_started`, `video_chat_ended`, `video_chat_scheduled`, `message_auto_delete_timer`, `successful_payment`, `refunded_payment`, `users_shared`, `chat_shared`, `write_access_allowed`, `boost_added`, `forum_topic_created`, `forum_topic_edited`, `forum_topic_closed`, `forum_topic_reopened`, `general_forum_topic_hidden`, `general_forum_topic_unhidden`, `giveaway_created`, `giveaway_completed`, `giveaway_winners`, `service`.

### Callbacks

`cb_data`, `cb_startswith`, `cb_endswith`, `cb_contains`, `cb_regex`, `cb_payload`, `cb_json`, `cb_kvp`, `cb_from`, `cb_chat`, `cb_msg`, `cb_game`, `cb_any`.

### Polls

`poll_filter`, `poll_closed`, `poll_open`, `poll_question`, `poll_contains`, `poll_regex`, `poll_type`, `poll_chat`, `poll_option`, `poll_any`, `poll_answer`.

### Membership

`member_joined`, `member_left`, `member_banned`, `member_unbanned`, `member_promoted`, `member_demoted`, `member_restricted`, `member_unrestricted`, `member_status`, `member_chat`, `member_user`, `member_by`, `member_self`, `member_any`.

### Composition and limits

`update_type`, `network`, `user`, `state`, `state_any`, `any_filter`, `none_filter`, `func`, `all_of`, `any_of`, `none_of`, `at_least`, `at_most`, `exactly`, `invert`, `if_`, `unless`, `once`, `limit`, `every_n`, `cooldown`, `throttled`, `filter_data`.

## Diagnostics

- `filter.explain(event)` returns the evaluated tree and result.
- `filter.tree()` returns the composition tree without evaluating an event.
- `filter_data(key=value, ...)` matches fields in any event object.

All filter expressions remain synchronous predicates; expensive work belongs in the asynchronous handler.
