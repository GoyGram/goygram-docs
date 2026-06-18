---
title: "Управление вебхуком"

---
# Управление вебхуком

GoyGram поддерживает веб-перехватчики Bot API наряду со стандартным режимом длительного опроса. Доступны три специальных метода.

## Установка вебхука


```python
await app.set_webhook("https://myserver.com/webhook")
# or with options:
await app.set_webhook(
    "https://myserver.com/webhook",
    certificate=open("cert.pem", "rb").read(),
    max_connections=40,
    allowed_updates=["message", "callback_query"],
    secret_token="my_secret"
)
```


## Удаление вебхука


```python
# Delete and drop any pending updates (delivered during downtime)
await app.delete_webhook(drop_pending_updates=True)

# Delete but keep pending updates (delivered on next poll)
await app.delete_webhook(drop_pending_updates=False)
```


## Запрос информации о вебхуке


```python
info = await app.get_webhook_info()
# info contains: url, has_custom_certificate, pending_update_count,
#                last_error_date, last_error_message, max_connections,
#                allowed_updates
```


## Автоматическое разрешение конфликтов веб-перехватчиков

Если во время `BotNet.spin()` сервер возвращает HTTP 409 (конфликт) на `getUpdates`, GoyGram **автоматически удаляет** любой существующий вебхук:


```python
if r.status == 409 and m == "getUpdates":
    await self.req("deleteWebhook", {"drop_pending_updates": False})
    self.log.error("Webhook conflict detected. Webhook deleted and polling will retry.")
    return []
```


Это также выполняется при запуске (`delete_webhook(drop_pending_updates=False)`) до начала цикла опроса.

**Внимание**: если у вас настроен вебхук где-то еще (например, на рабочем сервере), GoyGram удалит его без подтверждения. Либо отключите токен бота в GoyGram, либо явно обработайте настройку веб-перехватчика перед вызовом `run()`.

## Реализация

Все три метода делегируют `bot_req`:


```python
async def set_webhook(self, url, **kw):
    return await self.bot_req("setWebhook", url=url, **kw)

async def delete_webhook(self, drop_pending_updates=False):
    return await self.bot_req("deleteWebhook",
                              drop_pending_updates=drop_pending_updates)

async def get_webhook_info(self):
    return await self.bot_req("getWebhookInfo")
```


Это методы только для Bot API — в MTProto нет концепции веб-перехватчика.

## Вебхук против опроса

GoyGram предназначен в первую очередь для опроса (`getUpdates` в цикле). Методы веб-перехватчиков существуют для совместимости, но встроенного сервера веб-перехватчиков нет — вам придется обрабатывать входящие POST веб-перехватчиков на своем собственном HTTP-сервере (FastAPI, aiohttp, Flask и т. д.) и вручную отправлять события вашим обработчикам.