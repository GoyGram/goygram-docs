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

Смотрите также: [сессии и вход](/ru/docs/Sessions-and-Authentication), [обработчики](/ru/docs/Handlers-and-Updates), [вызовы MTProto](/ru/docs/MTProto-Calls).
