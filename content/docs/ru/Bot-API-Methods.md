---
title: "Методы API ботов"
---

# Методы API ботов

Уровень Bot API GoyGram поддерживает ВСЕ методы Telegram Bot API посредством динамической отправки. На этой странице описан механизм и доступные методы.

## Полностью динамическая отправка

В классе `BotAPI` НЕТ жестко запрограммированных типизированных методов — каждый вызов проходит через `__getattr__`:


```python
class BotAPI:
    def __getattr__(self, name):
        async def dyn(**kw):
            # snake_case → CamelCase conversion
            parts = name.split("_")
            meth = parts[0] + "".join(x[:1].upper() + x[1:] for x in parts[1:])
            return await self.call(meth, **kw)
        return dyn
```


Это означает ВСЕ эти работы:

```python
await app.sendAnimation(chat_id=..., animation=..., caption=...)
await app.getUserProfilePhotos(user_id=...)
await app.setMyCommands(commands=[...])
await app.forwardMessage(chat_id=..., from_chat_id=..., message_id=...)
await app.copyMessage(chat_id=..., from_chat_id=..., message_id=...)
await app.sendVideo(chat_id=..., video=..., caption=...)
await app.sendVoice(chat_id=..., voice=..., caption=...)
await app.sendVideoNote(chat_id=..., video_note=...)
await app.sendLocation(chat_id=..., latitude=..., longitude=...)
await app.sendVenue(chat_id=..., latitude=..., longitude=..., title=..., address=...)
await app.sendContact(chat_id=..., phone_number=..., first_name=...)
await app.sendPoll(chat_id=..., question=..., options=...)
await app.sendDice(chat_id=..., emoji="🎲")
await app.sendChatAction(chat_id=..., action="typing")
await app.getFile(file_id=...)
await app.kickChatMember(chat_id=..., user_id=...)
await app.restrictChatMember(chat_id=..., user_id=..., permissions=...)
await app.promoteChatMember(chat_id=..., user_id=..., ...)
await app.exportChatInviteLink(chat_id=...)
await app.setChatPhoto(chat_id=..., photo=...)
await app.deleteChatPhoto(chat_id=...)
await app.setChatTitle(chat_id=..., title=...)
await app.setChatDescription(chat_id=..., description=...)
await app.pinChatMessage(chat_id=..., message_id=...)
await app.unpinChatMessage(chat_id=..., message_id=...)
await app.leaveChat(chat_id=...)
await app.getChat(chat_id=...)
await app.getChatAdministrators(chat_id=...)
await app.getChatMemberCount(chat_id=...)
await app.getChatMember(chat_id=..., user_id=...)
await app.answerCallbackQuery(callback_query_id=..., text=...)
await app.setMyCommands(commands=..., scope=..., language_code=...)
await app.deleteMyCommands(scope=..., language_code=...)
await app.getMyCommands(scope=..., language_code=...)
await app.setWebhook(url=...)
await app.deleteWebhook(drop_pending_updates=...)
await app.getWebhookInfo()
await app.sendInvoice(chat_id=..., title=..., description=..., ...)
await app.answerShippingQuery(shipping_query_id=..., ok=...)
await app.answerPreCheckoutQuery(pre_checkout_query_id=..., ok=...)
await app.sendGame(chat_id=..., game_short_name=...)
await app.setGameScore(user_id=..., score=..., ...)
await app.getGameHighScores(user_id=..., ...)
# ... literally every method in the Bot API
```


## Сериализация параметров

Все параметры сериализуются через `dump()`:


```python
def dump(v):
    if hasattr(v, "to_dict"):
        return v.to_dict()  # keyboard objects, types
    if isinstance(v, list):
        return [dump(x) for x in v]
    if isinstance(v, dict):
        return {k: dump(x) for k, x in v.items() if x is not None}
    return v  # primitives pass through
```


Значения `None` отфильтровываются на уровне dict — это предотвращает отправку `null` для необязательных параметров.

## Типы API ботов

Модуль типов (`goygram/api/types.py`) предоставляет типизированные оболочки для основных объектов Bot API:

| Тип | Поля |
|------|--------|
| `User` | `id`, `is_bot`, `first_name`, `username?` |
| `Chat` | `id`, `type`, `title?`, `username?` |
| `Message` | `message_id`, `date`, `chat`, `text?` |

Все реализуют `to_dict()` для сериализации. Типы клавиатуры используют динамический `KbdBuilder` — см. [Система клавиатуры](Keyboard-System).

## Три шаблона доступа


```python
# 1. Via app — dynamic dispatch
await app.getChat(chat_id=...)

# 2. Via app.core.bot — raw HTTP call
await app.core.bot.req("getChat", {"chat_id": ...})

# 3. Via app.bot_req — convenience wrapper
await app.bot_req("getChat", chat_id=...)
```


Шаблон 1 является самым чистым и использует преобразование Snake_case → CamelCase.