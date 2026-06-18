---
title: Callback Query Handling
---

# Callback Query Handling

Callback Queries are events from inline keyboard buttons received through `update.callback_query` in the Bot API long-polling stream. GoyGram normalizes these into `CbObj` instances and routes them through `on_cb` handlers.

## Event Flow

1. `BotNet.spin()` polls `getUpdates` with `allowed_updates=["callback_query", ...]`
2. `BotNet.norm()` extracts the `callback_query` dict from the update
3. The normalized packet is pushed to the event bus with `kind: "cb"`
4. `Disp.consume()` deserializes the packet and calls `Disp.one()`
5. `Disp.one()` creates `CbObj` and iterates through `app.cb_hook`

## CbObj Structure

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

The fields `data` and `text` are extracted from the normalized callback query. `data` is the `callback_data` of the pressed inline button. `text` is the text of the originating message (`message.text` or `message.caption`).

## answer()

Responds to the callback query via `answerCallbackQuery`:

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

Parameters:

- `text` — popup notification text (up to 200 characters)
- `alert` — show as an alert dialog instead of a toast
- `url` — URL to open instead of a notification
- `cache_time` — how long to cache the answer in seconds (default 0)

The method prefers the high-level `AppCore.answer_cb()` pathway, falling back to a direct `BotNet.call()`.

## edit()

Edits the message to which the inline button is attached:

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

The `via=self.src` parameter ensures the edit goes through the same transport that delivered the callback (only Bot API for callbacks, since MTProto doesn't have inline keyboards).

## Usage

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

## Transport Constraint

`CbObj` is inherently Bot API-only. The `src` field, while present, is always `"bot"` because callback queries are not available in raw MTProto. Both `answer()` and `edit()` rely on `app.bot` (BotNet) internally.

## Normalization in BotNet.norm()

The callback query is normalized from the raw Bot API update in `BotNet.norm()`:

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
