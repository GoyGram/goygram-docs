# MTProto Actions Reference

All MTProto actions available via `app.mt_req(action, **kw)` or the generated `app.mt_<action>(**kw)` wrappers. This is what the codebase actually supports — reverse-engineered from `_build_body()` in `vendor/mtproto.py`.

## Authentication

| Action | Description | Key Parameters |
|--------|-------------|---------------|
| `auth_send_code` | Request auth code | `phone`, `api_id`, `api_hash` |
| `auth_sign_in` | Sign in with code | `phone`, `phone_code_hash`, `code`, `api_id` |
| `account_get_password` | Get 2FA password params | `api_id` |
| `auth_check_password` | Complete SRP 2FA | `srp_id`, `A`, `M1`, `api_id` |
| `auth_export_login_token` | Export QR login token | `api_id`, `api_hash`, `except_ids` |
| `auth_import_login_token` | Import migrated QR token | `token`, `api_id` |
| `auth_log_out` | Log out current session | _(none)_ |

## Messages

| Action | Description | Key Parameters |
|--------|-------------|---------------|
| `send_msg` | Send a text message | `chat_id`, `text`, `reply_to`, `parse_mode` |
| `edit_msg` | Edit a message | `chat_id`, `msg_id`, `text` |
| `del_msg` / `delete_messages` | Delete messages | `chat_id` / `ids`, `revoke` |
| `channels_delete_messages` | Delete messages in channel | `channel`, `ids` |
| `forward_messages` | Forward messages | `from_chat_id`, `chat_id`, `ids` |
| `get_dialogs` | Get dialog list | `limit`, `offset_date`, `offset_id` |
| `get_history` | Get chat history | `chat_id`, `limit`, `offset_id` |
| `get_messages` | Get specific messages | `ids` |
| `search_messages` | Search messages in chat | `chat_id`, `q`, `limit` |
| `send_typing` | Show typing indicator | `chat_id` |
| `pin_message` | Pin a message | `chat_id`, `msg_id`, `silent` |
| `unpin_message` / `unpin_all` | Unpin messages | `chat_id` |
| `read_history` / `mark_read` | Mark chat as read | `chat_id`, `max_id` |
| `save_draft` | Save message draft | `chat_id`, `message`, `reply_to_msg_id` |
| `clear_draft` / `get_all_drafts` | Get/clear drafts | _(none)_ |

## Users & Contacts

| Action | Description | Key Parameters |
|--------|-------------|---------------|
| `get_me` | Get current user info | _(none)_ |
| `get_users` | Get user info by IDs | `ids`, `access_hash` |
| `get_full_user` | Get full user profile | `user_id` |
| `resolve_peer` / `resolve_username` | Resolve @username to peer | `username` |
| `update_status` | Set online/offline | `offline` (bool) |
| `get_state` | Get updates state | _(none)_ |
| `get_difference` | Get updates difference | `pts`, `date`, `qts` |

## Channels & Groups

| Action | Description | Key Parameters |
|--------|-------------|---------------|
| `get_full_chat` | Get full chat info | `chat_id` |
| `get_full_channel` | Get full channel info | `chat_id` |
| `get_participants` | Get chat participants | `chat_id`, `offset`, `limit` |
| `join_channel` | Join a channel | `chat_id` |
| `leave_channel` | Leave a channel | `chat_id` |
| `invite_to_channel` | Invite users to channel | `chat_id`, `users` |
| `edit_title` | Change chat/channel title | `chat_id`, `title` |
| `edit_about` | Change chat/channel description | `chat_id`, `about` |

## Generated Wrapper Methods

All of the above plus these additional generated wrappers (set on `AppCore` at module load):

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

## Calling Convention

```python
# Direct call
result = await app.mt_req("get_dialogs", limit=50)

# Wrapper call
result = await app.mt_messages_get_dialogs(limit=50)

# Dynamic call (via __getattr__)
result = await app.mt_messages_get_dialogs(limit=50)
```

All three paths lead to the same `_rpc_call` → `send` → encrypted TCP path.

## Unsupported Actions

If you call an action not in `_build_body()`, it raises:
```python
raise NotImplementedError(f'MTProto method not implemented: {act}')
```

To add support, extend the `if/elif` chain in `_build_body()` and add the corresponding TL serializer in `MTCodec`.
