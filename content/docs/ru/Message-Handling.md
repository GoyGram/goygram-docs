---
title: "Обработка сообщений"
---

# Обработка сообщений

Как сообщения передаются с серверов Telegram в вашу функцию-обработчик через каждый уровень GoyGram.

## Полный конвейер


```
Telegram Server
    │
    ▼ (HTTPS or TCP)
BotNet.spin() / MTNet.spin()
    │  parse raw response
    │  normalize to event dict
    ▼
bus.push("bot"/"mt", {kind: "msg", msg_id: ..., ...})
    │
    ▼ (asyncio.Queue)
Disp.consume() → bus.fetch()
    │
    ▼
Disp.one(pkt)
    │  create MsgObj(src, data, app)
    ▼
for fn in app.hook:       ← on_msg handlers (with filters)
    try: await fn(msg)
for fn in app.cmd_hook:   ← on_cmd handlers
    try: await fn(msg)
```


## Нормализация API ботов

В `BotNet.norm()`:


```python
msg = upd.get("message") or upd.get("edited_message")
if not isinstance(msg, dict):
    return None

chat = msg.get("chat") or {}
usr = msg.get("from") or {}
txt = msg.get("text")
if txt is None:
    txt = msg.get("caption") or ""

return {
    "kind": "msg",
    "src": "bot",
    "upd_id": upd.get("update_id"),
    "msg_id": msg.get("message_id"),
    "chat_id": chat.get("id"),
    "from_id": usr.get("id"),
    "text": txt,
    "is_me": False,   # bot messages are never "from me" in Bot API
    "raw": upd,
}
```


Примечание. Сообщения API бота никогда не устанавливают `is_me = True`, поскольку бот не может получать свои собственные сообщения через `getUpdates`. Фильтр `filters.me` работает для ботов только путем сравнения `from_id` с `self_id` (собственный идентификатор пользователя бота из `getMe`).

## Анализ сообщений MTProto

MTProto более сложен. Входящие сообщения поступают в виде сериализованных по TL конструкторов `UpdateNewMessage` или `UpdateShortMessage` внутри зашифрованного пакета:


```python
# UpdateNewMessage → UpdateShortMessage → text extraction
if cid in {0x3131d92f, 0x384523f4}:  # UpdateNewMessage, UpdateShortMessage
    flags = rm.i32()
    msg_id = rm.i32()
    user_id = rm.i64()
    msg_text = rm.tl_bytes().decode("utf-8", errors="ignore")
    is_out = bool(flags & 2)  # flag bit 2 = outgoing

    sid = getattr(self, 'self_id', 0) or 0
    pkt = {
        "kind": "msg",
        "msg_id": msg_id,
        "chat_id": user_id if not is_out else (sid or user_id),
        "from_id": user_id if not is_out else (sid or user_id),
        "text": msg_text,
        "is_me": is_out or (sid != 0 and user_id == sid),
    }
    asyncio.ensure_future(self.bus.push("mt", pkt))
```


Для `UpdateNewChannelMessage` и `UpdateNewScheduledMessage` (CID `0x1f2b0afd`) синтаксический анализатор выполняет эвристический поиск текста:


```python
# Scan the TL binary for a printable, non-numeric text chunk
# This is a best-effort parser — it looks for TL string markers
# and extracts the first plausible text payload
for i in range(search_end - 2, 0, -1):
    n0 = data[i]
    if n0 < 254 and i + 1 + n0 <= len(data):
        candidate = data[i+1:i+1+n0]
        decoded = candidate.decode('utf-8')
        if decoded.isprintable() and not decoded.isdigit():
            txt = decoded
            break
```


Это эвристическое извлечение не идеально — оно захватывает первую найденную печатную строку. Сложные сообщения с медиа-подписями могут разрешать текст подписи вместо основного текста. Это известное ограничение.

## Выполнение обработчика

Обработчики получают `MsgObj` и могут:


```python
# Reply
await msg.reply("text")
await msg.reply("text", kbd=keyboard)
await msg.reply("text", link_options=LinkOpts(disabled=True))

# Delete
await msg.delete()

# Edit (Bot API only, and only your own messages)
await msg.edit("new text")

# Access raw data
print(msg.raw)  # full normalized event dict
```


## Редактирование сообщений

Чтобы отредактировать отправленное вами сообщение:


```python
await app.edit_text(chat_id, msg_id, "Updated text")
# or from a CbObj:
await cb.edit("Updated text")
```


Редактирование работает только с транспортом Bot API. Редактирование сообщений MTProto существует, но требует метода `messages.editMessage` TL (поддерживается в `_build_body`).

## Удаление сообщений


```python
await msg.delete()           # delete this specific message
await app.del_msg(chat_id, msg_id)  # delete any message
```


Оба транспорта поддерживают удаление:
- **API бота**: HTTP-вызов `deleteMessage`.
- **MTProto**: `messages.deleteMessages` с `revoke=True`