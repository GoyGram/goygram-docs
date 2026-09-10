---
title: "Опросы и участники"
---

# Опросы и обновления участников

GoyGram держит общий путь событий маленьким и сохраняет обновление целиком в `raw`.

## Обновления опросов

Для ответов Bot API `on_poll` получает `PollObj` (алиас динамического `goygram.types.Obj`) с полями `src`, `raw`, `app`, `id`, `question`, `closed`, `kind`. Специфичные для опроса поля читаются лениво через атрибуты, `.get()` и `[]`, если они есть в исходном обновлении:

```python
@app.on_poll(filt=filters.poll_open)
async def poll_answer(poll):
    print(poll.question)
    print(poll.get("option_ids", []))
    print(poll.raw)
```

Для отбора событий опросов используйте `filters.poll_filter(...)`, `poll_open`, `poll_closed`, `poll_question(...)`, `poll_contains(...)`, `poll_regex(...)`, `poll_type(...)`, `poll_chat(...)`, `poll_option(...)`, `poll_any`, `poll_answer`.

## Обновления участников чата

`on_member` получает `MemberObj` (алиас динамического `goygram.types.Obj`) с полями `src`, `raw`, `app`, `chat_id`, `from_id`, `user_id`, `old`, `new`, `kind`. Полное обновление `chat_member` Bot API или участника MTProto остаётся в `raw`:

```python
@app.on_member(filters.member_joined)
async def joined(member):
    print(member.chat_id, member.user_id, member.from_id)
    print(member.old, member.new)
    print(member.raw)
```

Дополнительные поля — даты, привилегии, кастомные титулы, информация о приглашении, `qts` и состояние списка каналов — доступны через `member.get(...)` или `member[...]`.

## Общие обновления MTProto

В актуальной схеме layer 229 содержится 172 конструктора обновлений: 165 `Update` и 7 обёрток `Updates`. Каждый структурный конструктор декодируется динамически. Конструкторы без специализированного объекта события приходят через `on_update`:

```python
@app.on_update(filt=filters.update_type("updateMessageReactions"))
async def reactions(update):
    message_id = update.get("msg_id") or update.get("message_id")
    print(update.raw)
```

`on_update` также получает сообщения, правки, колбэки, опросы и участников до их специализированных обработчиков. Конструктор различается по `update.update_type`.

## Восстановление пропущенного

MTProto хранит курсоры `pts`, `qts`, `date` и `seq`. После `updatesTooLong` или разрыва при реконнекте GoyGram запрашивает `updates.getDifference`, применяет возвращённый `state`, диспетчеризует восстановленные сообщения и `other_updates` и монотонно двигает персистентный курсор. С 0.7.79 разбор идёт полным циклом по слайсам с обработкой `differenceTooLong`, а для каналов — через `getChannelDifference` по отдельности.
