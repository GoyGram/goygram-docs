---
---

# Форум / Управление темами

GoyGram обеспечивает полное управление темами форума через оба транспорта. Все методы форума реализованы непосредственно в `AppCore` и доступны через `GoyGram`.

## Жизненный цикл темы


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


## Общая тема

Тема «Общие» (topic_id=1) имеет специальные методы:


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


## Реализация

Все методы темы следуют одному и тому же шаблону:


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


Двойной транспорт: Bot API использует методы темы форума из Bot API, MTProto использует методы TL.

## Bot API против имен параметров MTProto

| Концепция | API ботов | МТПрото |
|---------|---------|---------|
| Идентификатор темы | `message_thread_id` | `topic_id` |
| Пользовательские смайлы | `icon_custom_emoji_id` | `icon_custom_emoji_id` (тот же) |

## Отправка сообщений в темы


```python
# Via topic_id parameter
await app.bot.send_msg(chat_id=-10012345678, text="Topic message",
                   topic_id=42)

# Via message_thread_id (Bot API native naming also works)
await app.bot.send_msg(chat_id=-10012345678, text="Topic message",
                   message_thread_id=42)
```


Метод `send_msg` сопоставляет `topic_id` с правильным транспортным полем:
- API бота: `message_thread_id`
- MTProto: `topic_id`