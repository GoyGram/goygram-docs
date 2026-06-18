---
title: "Разрешение узла"

---
# Разрешение узла

MTProto требует сериализованных объектов «входного узла» TL для большинства операций чата. GoyGram автоматически преобразует идентификаторы чатов Python в ссылки на одноранговые узлы, сериализованные в TL.

## Логика `_resolve_peer()`


```python
def _resolve_peer(self, obj):
    chat_id = obj.get('chat_id') or obj.get('peer')
    access_hash = obj.get('access_hash', 0)

    # None → self
    if chat_id is None:
        return self.codec.input_peer_self()

    # Bytes → pass through (already TL-serialized)
    if isinstance(chat_id, bytes):
        return chat_id

    # String → parse
    if isinstance(chat_id, str):
        if chat_id in ('self', 'me'):
            return self.codec.input_peer_self()
        if chat_id.lstrip('-').isdigit():
            chat_id = int(chat_id)
        else:
            return self.codec.input_peer_self()  # unknown → self

    # Integer → resolve by sign + magnitude
    if chat_id == 0:
        return self.codec.input_peer_self()
    if chat_id > 0:
        return self.codec.input_peer_user(chat_id, int(access_hash))
    raw = -chat_id
    if raw > 1000000000000:  # supergroup/channel
        return self.codec.input_peer_channel(raw - 1000000000000, int(access_hash))
    return self.codec.input_peer_chat(raw)  # basic group
```


## Разрешение канала


```python
def _resolve_channel(self, obj):
    chat_id = obj.get('chat_id') or obj.get('channel')
    if isinstance(chat_id, int):
        raw = -chat_id if chat_id < 0 else chat_id
        if raw > 1000000000000:
            channel_id = raw - 1000000000000
        else:
            channel_id = raw
        return self.codec.input_channel(channel_id, int(access_hash))
```


## Разрешение пользователя


```python
def _resolve_user(self, obj):
    user_id = obj.get('user_id')
    if user_id is None or str(user_id) in ('self', 'me'):
        return self.codec.input_user_self()
    return self.codec.input_user(int(user_id), int(access_hash))
```


## Разрешение имени пользователя


```python
# Calls contacts.resolveUsername which returns peer type + ID + access_hash
username = str(obj.get('username') or obj.get('peer') or '').lstrip('@')
return self.codec.contacts_resolve_username(username=username)
```


## Сопоставление конструктора TL

| Идентификатор Python | Конструктор МТПрото |
|-----------|-------------------|
| `> 0` | `inputPeerUser#dde8a54c user_id:long access_hash:long` |
| `< 0`, `abs(id) ≤ 10^12` | `inputPeerChat#35a95cb9 chat_id:long` |
| `< 0`, `abs(id) > 10^12` | `inputPeerChannel#27bcbbfc channel_id:long access_hash:long` |
| `0` или `None` | `inputPeerSelf#7da07ec9` |
| `"self"` / `"me"` | `inputPeerSelf#7da07ec9` |