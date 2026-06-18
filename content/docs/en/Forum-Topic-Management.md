---
title: "Forum / Topic Management"
---

# Forum / Topic Management

GoyGram provides full forum topic management through both transports. All forum methods are implemented directly on `AppCore` and exposed via `GoyGram`.

## Topic Lifecycle

```python
# Create a topic
result = await app.create_topic(chat_id=-10012345678, name="Announcements")
# Optional: icon_color (RGB decimal, e.g., 7322096 for blue)

# Edit topic name + icon
await app.edit_topic(chat_id=-10012345678, topic_id=42,
                     name="Important Announcements")

# Close topic (read-only)
await app.close_topic(chat_id=-10012345678, topic_id=42)

# Reopen closed topic
await app.reopen_topic(chat_id=-10012345678, topic_id=42)

# Delete topic entirely
await app.delete_topic(chat_id=-10012345678, topic_id=42)

# Unpin all messages in a topic
await app.unpin_all_topic_msgs(chat_id=-10012345678, topic_id=42)
```

## General Topic

The "General" topic (topic_id=1) has special methods:

```python
# Rename General topic
await app.edit_general_topic(chat_id=-10012345678, name="Main Chat")

# Hide General topic from view
await app.hide_general_topic(chat_id=-10012345678)

# Show it again
await app.unhide_general_topic(chat_id=-10012345678)

# Close/reopen General topic
await app.close_general_topic(chat_id=-10012345678)
await app.reopen_general_topic(chat_id=-10012345678)
```

## Implementation

All topic methods follow the same pattern:

```python
async def create_topic(self, chat_id, name, icon_color=None, via=None, **kw):
    way = self.via(chat_id, via)
    dst = self.raw_chat(chat_id)
    if way == "bot":
        return await self.bot_req("createForumTopic",
                                  chat_id=dst, name=name,
                                  icon_color=icon_color, **kw)
    return await self.mt_req("create_topic",
                             chat_id=dst, name=name,
                             icon_color=icon_color, **kw)
```

Dual-transport: Bot API uses the Forum Topic methods from the Bot API, MTProto uses TL methods.

## Bot API vs MTProto Parameter Names

| Concept | Bot API | MTProto |
|---------|---------|---------|
| Topic ID | `message_thread_id` | `topic_id` |
| Custom emoji | `icon_custom_emoji_id` | `icon_custom_emoji_id` (same) |

## Sending Messages to Topics

```python
# Via topic_id parameter
await app.bot.send_msg(chat_id=-10012345678, text="Topic message",
                   topic_id=42)

# Via message_thread_id (Bot API native naming also works)
await app.bot.send_msg(chat_id=-10012345678, text="Topic message",
                   message_thread_id=42)
```

The `send_msg` method maps `topic_id` to the correct transport field:
- Bot API: `message_thread_id`
- MTProto: `topic_id`
