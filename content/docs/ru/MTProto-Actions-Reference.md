---
title: "Справочник по действиям MTProto"

---
# Справочник по действиям MTProto

Все действия MTProto доступны через `app.mt_req(action, **kw)` или сгенерированные оболочки `app.mt_<action>(**kw)`. Это то, что на самом деле поддерживает кодовая база — реверс-инжиниринг из `_build_body()` в `vendor/mtproto.py`.

## Аутентификация

| Действие | Описание | Ключевые параметры |
|--------|-------------|---------------|
| `auth_send_code` | Запросить код авторизации | `phone`, `api_id`, `api_hash` |
| `auth_sign_in` | Войти с кодом | `phone`, `phone_code_hash`, `code`, `api_id` |
| `account_get_password` | Получить параметры пароля 2FA | `api_id` |
| `auth_check_password` | Завершить SRP 2FA | `srp_id`, `A`, `M1`, `api_id` |
| `auth_export_login_token` | Экспортировать токен входа QR | `api_id`, `api_hash`, `except_ids` |
| `auth_import_login_token` | Импортировать перенесенный QR-токен | `token`, `api_id` |
| `auth_log_out` | Выйти из текущей сессии | _(нет)_ |

## Сообщения

| Действие | Описание | Ключевые параметры |
|--------|-------------|---------------|
| `send_msg` | Отправить текстовое сообщение | `chat_id`, `text`, `reply_to`, `parse_mode` |
| `edit_msg` | Редактировать сообщение | `chat_id`, `msg_id`, `text` |
| `del_msg` / `delete_messages` | Удалить сообщения | `chat_id` / `ids`, `revoke` |
| `channels_delete_messages` | Удалить сообщения в канале | `channel`, `ids` |
| `forward_messages` | Переслать сообщения | `from_chat_id`, `chat_id`, `ids` |
| `get_dialogs` | Получить список диалогов | `limit`, `offset_date`, `offset_id` |
| `get_history` | Получить историю чата | `chat_id`, `limit`, `offset_id` |
| `get_messages` | Получайте конкретные сообщения | `ids` |
| `search_messages` | Поиск сообщений в чате | `chat_id`, `q`, `limit` |
| `send_typing` | Показать индикатор набора текста | `chat_id` |
| `pin_message` | Закрепить сообщение | `chat_id`, `msg_id`, `silent` |
| `unpin_message` / `unpin_all` | Открепить сообщения | `chat_id` |
| `read_history` / `mark_read` | Отметить чат как прочитанный | `chat_id`, `max_id` |
| `save_draft` | Сохранить черновик сообщения | `chat_id`, `message`, `reply_to_msg_id` |
| `clear_draft` / `get_all_drafts` | Получить/очистить черновики | _(нет)_ |

## Пользователи и контакты

| Действие | Описание | Ключевые параметры |
|--------|-------------|---------------|
| `get_me` | Получить текущую информацию о пользователе | _(нет)_ |
| `get_users` | Получить информацию о пользователях по идентификаторам | `ids`, `access_hash` |
| `get_full_user` | Получить полный профиль пользователя | `user_id` |
| `resolve_peer` / `resolve_username` | Разрешить @username для пиринга | `username` |
| `update_status` | Установить онлайн/оффлайн | `offline` (логическое значение) |
| `get_state` | Получайте обновления состояния | _(нет)_ |
| `get_difference` | Получите разницу в обновлениях | `pts`, `date`, `qts` |

## Каналы и группы

| Действие | Описание | Ключевые параметры |
|--------|-------------|---------------|
| `get_full_chat` | Получить полную информацию о чате | `chat_id` |
| `get_full_channel` | Получить полную информацию о канале | `chat_id` |
| `get_participants` | Получить участников чата | `chat_id`, `offset`, `limit` |
| `join_channel` | Присоединяйтесь к каналу | `chat_id` |
| `leave_channel` | Покинуть канал | `chat_id` |
| `invite_to_channel` | Пригласить пользователей на канал | `chat_id`, `users` |
| `edit_title` | Изменить название чата/канала | `chat_id`, `title` |
| `edit_about` | Изменить описание чата/канала | `chat_id`, `about` |

## Сгенерированные методы-оболочки

Все вышеперечисленное плюс эти дополнительные сгенерированные оболочки (устанавливаются в `AppCore` при загрузке модуля):


```
mt_users_get_full_user, mt_contacts_resolve_phone, mt_messages_get_dialogs, mt_messages_get_history,
mt_messages_get_messages, mt_messages_send_reaction, mt_messages_forward_messages,
mt_copy_messages, mt_pin_message, mt_unpin_message,
mt_read_history, mt_delete_history, mt_get_participants,
mt_get_full_user, mt_get_full_chat, mt_get_full_channel,
mt_join_channel, mt_leave_channel, mt_edit_admin,
mt_invite_to_channel, mt_kick_participant,
mt_ban_participant, mt_unban_participant,
mt_mute_participant, mt_unmute_participant,
mt_create_group, mt_create_channel, mt_edit_title,
mt_edit_about, mt_set_photo, mt_delete_photo,
mt_get_pinned_message, mt_search_messages,
mt_search_global, mt_send_typing, mt_upload_file,
mt_download_file, mt_save_draft, mt_clear_draft,
mt_mark_read, mt_mark_unread
```


## Соглашение о вызовах


```python
# Direct call
result = await app.mt_req("get_dialogs", limit=50)

# Wrapper call
result = await app.mt_messages_get_dialogs(limit=50)

# Dynamic call (via __getattr__)
result = await app.mt_messages_get_dialogs(limit=50)
```


Все три пути ведут к одному и тому же `_rpc_call` → `send` → зашифрованному TCP-пути.

## Неподдерживаемые действия

Если вы вызываете действие, не указанное в `_build_body()`, оно вызывает:

```python
raise NotImplementedError(f'MTProto method not implemented: {act}')
```


Чтобы добавить поддержку, расширьте цепочку `if/elif` в `_build_body()` и добавьте соответствующий сериализатор TL в `MTCodec`.