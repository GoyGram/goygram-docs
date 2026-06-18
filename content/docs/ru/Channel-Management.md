---
title: "Управление каналом"

---
# Управление каналом

Операции с каналом MTProto доступны через GoyGram.

## Получение информации о канале


```python
# Full channel info
info = await app.mt_channels_get_full_channel(chat_id=-10012345678)

# Participants
members = await app.mt_channels_get_participants(chat_id=-10012345678, limit=200)

# Admins
admins = await app.mt_channels_get_participants(chat_id=-10012345678, limit=50, filter="admins")
```


## Присоединение и выход


```python
# Join a public channel/group
await app.mt_channels_join_channel(chat_id=-10012345678)

# Leave
await app.mt_channels_leave_channel(chat_id=-10012345678)

# Via Bot API
await app.leave_chat(chat_id=-10012345678)
```


## Управление участниками


```python
# Invite users to channel
await app.mt_channels_invite_to_channel(
    chat_id=-10012345678,
    users=[user_id_1, user_id_2]
)

# Edit admin rights
await app.mt_channels_edit_admin(
    chat_id=-10012345678,
    user_id=target_user_id,
    is_admin=True,
    rights={...}
)

# Kick user
await app.mt_channels_kick_participant(
    chat_id=-10012345678,
    user_id=target_user_id
)

# Ban with duration
await app.mt_channels_ban_participant(
    chat_id=-10012345678,
    user_id=target_user_id,
    until_date=int(time.time()) + 86400  # 24h
)

# Unban
await app.mt_channels_unban_participant(
    chat_id=-10012345678,
    user_id=target_user_id
)

# Mute/unmute
await app.mt_channels_mute_participant(chat_id=..., user_id=...)
await app.mt_channels_unmute_participant(chat_id=..., user_id=...)
```


## Метаданные канала


```python
# Change title
await app.mt_channels_edit_title(chat_id=-10012345678, title="New Title")

# Change description
await app.mt_channels_edit_about(chat_id=-10012345678, about="New description")

# Set profile photo
await app.mt_channels_edit_photo(chat_id=-10012345678, photo=photo_bytes)
```


## Создание каналов


```python
# Create supergroup
await app.mt_channels_create_channel(title="My Group", about="Description", megagroup=True)

# Create broadcast channel
await app.mt_channels_create_channel(title="My Channel", about="Description", broadcast=True)
```


## Управление сообщениями в каналах


```python
# Pin/unpin messages
await app.mt_messages_pin_message(chat_id=-10012345678, msg_id=123)
await app.mt_messages_unpin_message(chat_id=-10012345678, msg_id=123)

# Delete messages (channel delete variant)
await app.mt_req("channels_delete_messages", channel=-10012345678, ids=[123, 124])

# Get pinned message
pinned = await app.mt_messages_get_pinned_message(chat_id=-10012345678)
```


## Эквиваленты API ботов

Некоторые операции с каналом также работают через Bot API:


```python
await app.ban_chat_member(chat_id=..., user_id=...)
await app.unban_chat_member(chat_id=..., user_id=...)
await app.restrict_chat_member(chat_id=..., user_id=..., permissions=...)
await app.promote_chat_member(chat_id=..., user_id=..., ...)
await app.get_chat_administrators(chat_id=...)
```