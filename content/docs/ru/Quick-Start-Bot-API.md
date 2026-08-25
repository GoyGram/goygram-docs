---
title: "API быстрого запуска бота"
---

# Быстрый старт — API ботов


```python
import asyncio
from goygram import GoyGram

app = GoyGram(bot_token="123456:bot_token")

@app.on_cmd("start")
async def start(msg):
    await msg.reply("Hello from GoyGram")

if __name__ == "__main__":
    asyncio.run(app.run())
```


`run()` использует длинный опрос. Перед опросом GoyGram пытается удалить вебхук с помощью `drop_pending_updates=False`; не оставляйте активным другой опросчик для того же бота.

Обработчики получают нормализованный объект сообщения. См. [Handlers and update](/ru/docs/Handlers-and-Updates) и [Вызовы Bot API](/ru/docs/Bot-API-Calls).