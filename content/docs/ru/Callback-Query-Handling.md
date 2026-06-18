---
title: "Обработка запросов обратного вызова"
---

# Обработка запроса обратного вызова

Запросы обратного вызова — это события от встроенных кнопок клавиатуры, полученные через `update.callback_query` в потоке длинного опроса Bot API. GoyGram нормализует их в экземпляры `CbObj` и направляет их через обработчики `on_cb`.

## Поток событий

1. `BotNet.spin()` опрашивает `getUpdates` с помощью `allowed_updates=["callback_query", ...]`
2. `BotNet.norm()` извлекает диктат `callback_query` из обновления.
3. Нормализованный пакет передается на шину событий с помощью `kind: "cb"`.
4. `Disp.consume()` десериализует пакет и вызывает `Disp.one()`.
5. `Disp.one()` создает `CbObj` и выполняет итерацию по `app.cb_hook`.

## Структура CbObj


```python
class CbObj:
    __slots__ = ("src", "raw", "app", "id", "chat_id", "from_id",
                 "msg_id", "data", "text")

    def __init__(self, src: str, raw: dict[str, Any], app: Any) -> None:
        self.src = src
        self.raw = raw
        self.app = app
        self.id = raw.get("query_id") or raw.get("id")
        self.chat_id = raw.get("chat_id")
        self.from_id = raw.get("from_id")
        self.msg_id = raw.get("msg_id")
        self.data = raw.get("data", "")
        self.text = raw.get("text", "")
```


Поля `data` и `text` извлекаются из нормализованного запроса обратного вызова. `data` — это `callback_data` нажатой встроенной кнопки. `text` — текст исходного сообщения (`message.text` или `message.caption`).

## ответ()

Отвечает на запрос обратного вызова через `answerCallbackQuery`:


```python
async def answer(self, text=None, alert=False, url=None, cache_time=0):
    if self.id is None:
        return None
    if hasattr(self.app, "answer_cb"):
        return await self.app.answer_cb(
            str(self.id), text=text, alert=alert,
            url=url, cache_time=cache_time
        )
    return await self.app.bot.call(
        "answerCallbackQuery",
        callback_query_id=str(self.id),
        text=text, show_alert=alert,
        url=url, cache_time=cache_time
    )
```


Параметры:

- `text` — текст всплывающего уведомления (до 200 символов)
- `alert` — отображать в виде диалогового окна предупреждения вместо всплывающего уведомления.
- `url` — URL для открытия вместо уведомления
- `cache_time` — как долго кэшировать ответ в секундах (по умолчанию 0)

Метод предпочитает путь высокого уровня `AppCore.answer_cb()`, возвращаясь к прямому пути `BotNet.call()`.

## редактировать()

Редактирует сообщение, к которому прикреплена встроенная кнопка:


```python
async def edit(self, text: str, kbd=None, **kw):
    if self.chat_id is None or self.msg_id is None:
        return None
    if hasattr(self.app, "edit_text"):
        return await self.app.edit_text(
            self.chat_id, int(self.msg_id), text,
            kbd=kbd, via=self.src, **kw
        )
    return await self.app.bot.call(
        "editMessageText",
        chat_id=self.chat_id,
        message_id=int(self.msg_id),
        text=text,
        **({"reply_markup": kbd} if kbd else {}),
        **kw
    )
```


Параметр `via=self.src` гарантирует, что редактирование будет проходить через тот же транспорт, который доставил обратный вызов (только Bot API для обратных вызовов, поскольку MTProto не имеет встроенных клавиатур).

## Использование


```python
app = GoyGram(bot_token="...")

@app.on_cb
async def handle_callback(cb: CbObj):
    if cb.data == "accept":
        await cb.answer("Accepted!", alert=True)
        await cb.edit("✅ Confirmed")
    elif cb.data == "cancel":
        await cb.answer("Cancelled")
        await cb.edit("❌ Cancelled")
    else:
        await cb.answer("Unknown action")
```


## Транспортное ограничение

`CbObj` по своей сути предназначен только для API ботов. Поле `src`, хотя и присутствует, всегда имеет значение `"bot"`, поскольку запросы обратного вызова недоступны в необработанном MTProto. И `answer()`, и `edit()` внутренне полагаются на `app.bot` (BotNet).

## Нормализация в BotNet.norm()

Запрос обратного вызова нормализован на основе необработанного обновления API бота в `BotNet.norm()`:


```python
cb = upd.get("callback_query")
if isinstance(cb, dict):
    msg = cb.get("message") or {}
    chat = msg.get("chat") or {}
    usr = cb.get("from") or {}
    return {
        "kind": "cb",
        "src": "bot",
        "query_id": cb.get("id"),
        "msg_id": msg.get("message_id"),
        "chat_id": chat.get("id"),
        "from_id": usr.get("id"),
        "data": cb.get("data", ""),
        "text": (msg.get("text") or msg.get("caption") or ""),
        "raw": upd,
    }
```