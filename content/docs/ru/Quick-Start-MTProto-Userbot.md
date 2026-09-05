---
title: "Быстрый старт MTProto"
---

# Быстрый старт — MTProto userbot

```python
import asyncio
from goygram import GoyGram, filters
from goygram.filters import command

app = GoyGram(
    api_id=ВАШ_API_ID,
    api_hash="ВАШ_API_HASH",
    session_name="my_first_userbot",
)

@app.on_msg(filt=command("ping") & filters.me)
async def ping_handler(msg):
    await msg.reply("Pong!")

asyncio.run(app.run())
```

Отправьте `/ping` из авторизованного аккаунта. `filters.me` оставляет только исходящие сообщения этого аккаунта.

При первом запуске GoyGram попросит номер телефона и код Telegram. Если включена двухфакторная защита, он попросит и пароль. Сессия сохраняется в `my_first_userbot.vault`.

Остановить приложение можно вызовом `app.stop()`.

## Бот через MTProto (auth.importBotAuthorization)

Бот может работать по сырому MTProto, без HTTP-транспорта Bot API. Передайте `bot_token` вместе с `api_id`/`api_hash`, и GoyGram авторизует бота через `auth.importBotAuthorization`:

```python
import asyncio
from goygram import GoyGram
from goygram.filters import command

app = GoyGram(
    bot_token="123456:ABC_TOKEN",
    api_id=123456,
    api_hash="ВАШ_API_HASH",
    default_transport="mtproto",   # предпочитать MTProto для исходящих
)

@app.on_msg(filt=command("ping"))
async def ping_handler(msg):
    await msg.reply("pong via MTProto")

asyncio.run(app.run())
```

Оба транспорта остаются доступны в одном рантайме. Переключайтесь для каждого вызова через `via="api"` (Bot API) или `via="mtproto"` (MTProto):

```python
await app.send_msg("123456789", "через Bot API", via="api")
await app.send_msg("123456789", "через MTProto", via="mtproto")
```

`default_transport` принимает `"api"`, `"mtproto"` или `"auto"` (Bot API, если есть токен, иначе MTProto).

Смотрите также: [сессии и вход](/ru/docs/Sessions-and-Authentication), [обработчики](/ru/docs/Handlers-and-Updates), [вызовы MTProto](/ru/docs/MTProto-Calls).
