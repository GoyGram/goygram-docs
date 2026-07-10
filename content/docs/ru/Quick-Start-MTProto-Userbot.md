---
title: "Быстрый запуск пользовательского бота MTProto"
---

# Быстрый старт — MTProto Userbot

Это минимальное приложение-юзербот. При первом запуске выполняется интерактивная авторизация Telegram, если указанное хранилище еще не содержит действительный сеанс.


```python
import asyncio
from goygram import GoyGram, filters
from goygram.filters import command

app = GoyGram(
    api_id=123456,
    api_hash="your_api_hash",
    session_name="my_first_userbot",
)

@app.on_msg(filt=command("ping") & filters.me)
async def ping_handler(msg):
    await msg.reply("Pong!")

if __name__ == "__main__":
    asyncio.run(app.run())
```


Отправьте `/ping` или `!ping` с авторизованного аккаунта. `filters.me` ограничивает этот обработчик исходящими сообщениями из этой учетной записи.

## Что происходит при запуске

1. GoyGram выбирает дата-центр Telegram, затем создает или возобновляет работу `my_first_userbot.vault`.
2. При отсутствии действующего ключа авторизации запрашивается номер телефона и код входа; Также может быть запрошен Telegram 2FA.
3. Он запускает программу чтения MTProto и отправляет входящие обновления зарегистрированным обработчикам.

Вызовите `app.stop()` из обработчика или отмените задачу, чтобы полностью завершить `app.run()`.

См. [[Сеансы и аутентификация|Сеансы и аутентификация]], [[Обработчики и обновления|Обработчики и обновления]] и [[MTProto-Calls|Вызовы MTProto]].