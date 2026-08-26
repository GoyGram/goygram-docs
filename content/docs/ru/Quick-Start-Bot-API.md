---
title: "Быстрый старт: Bot API"
---

# Быстрый старт — Bot API

```python
import asyncio
from goygram import GoyGram

app = GoyGram(bot_token="[REDACTED]")

@app.on_cmd("start")
async def start(msg):
    await msg.reply("Привет от GoyGram")

if __name__ == "__main__":
    asyncio.run(app.run())
```

По умолчанию `run()` использует long polling. Перед запуском polling GoyGram удаляет старый webhook с `drop_pending_updates=False`. Для одного бота должен работать только один polling или один webhook runtime.

## Webhook

Если Telegram должен отправлять обновления на ваш HTTPS-адрес, укажите `webhook_url`:

```python
app = GoyGram(
    bot_token="[REDACTED]",
    webhook_url="https://bot.example.com/telegram/webhook",
    webhook_host="127.0.0.1",
    webhook_port=8080,
    webhook_path="/telegram/webhook",
    webhook_secret_token="[REDACTED]",
)
```

В этом режиме `run()` поднимает HTTP listener, регистрирует webhook в Telegram и передаёт обновления тем же обработчикам. `getUpdates` не запускается. TLS обычно завершается в reverse proxy, который пересылает запросы на `webhook_host:webhook_port`.

Telegram отправляет секрет в заголовке `X-Telegram-Bot-Api-Secret-Token`. Неверный секрет получает отказ. При аккуратном завершении GoyGram удаляет webhook, который сам зарегистрировал.

Обработчики получают нормализованный объект сообщения. См. [обработчики и обновления](/ru/docs/Handlers-and-Updates) и [вызовы Bot API](/ru/docs/Bot-API-Calls).
