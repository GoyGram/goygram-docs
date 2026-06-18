---
title: "Дизайн разделенного мозга"
---

# Дизайн с разделенным мозгом

«Разделенный мозг» — это определяющий архитектурный шаблон GoyGram: **две совершенно независимые реализации транспорта, питающие единый унифицированный конвейер событий.** Уровень Python делает это ощущение цельным; внутренности агрессивно разделены.

## Почему «Разделение мозга»?

Потому что каждый транспорт имеет свой собственный жизненный цикл соединения, свой цикл обновления, свой формат сериализации и свою собственную обработку ошибок, но они сходятся в одном и том же `asyncio.Queue` и одной и той же диспетчеризации обработчика. Правая половина (Bot API/HTTP) не знает, что левая половина (MTProto/TCP) существует. Это два мозга в одном теле.

## Точка сходимости


```python
# Both transports push to the SAME bus
# botapi.py:
await self.bus.push("bot", {"kind": "msg", ...})

# mtproto.py:
asyncio.ensure_future(self.bus.push("mt", {"kind": "msg", ...}))

# disp.py consumes from the SAME queue regardless of source
pkt = await self.bus.fetch()
```


Поле `src` (`"bot"` или `"mt"`) сохраняется в объекте события (`MsgObj.src`), поэтому обработчики могут различать его при необходимости. Но по умолчанию обработчики срабатывают в обоих случаях.

## Последовательность загрузки с двойным транспортом

Когда `app.run()` вызывается с настроенными обоими транспортами:


```
1. disp.consume() task starts (waiting on bus)
2. bot.spin() task starts (long-polling getUpdates)
3. mt.spin() task starts (reading TCP socket)
4. bootstrap_session() restores MTProto auth from vault
5. mt_req('get_state') syncs update state
6. Event loop waits on stop_ev
7. Both transports push events → Bus → Disp → Handlers
```


## Одиночный транспортный режим

GoyGram прекрасно работает всего с одним транспортом:


```python
# Pure Bot API (no api_id/api_hash)
app = GoyGram(bot_token="123:ABC")

# Pure MTProto (no bot_token)
app = GoyGram(api_id=123, api_hash="abc")
```


В режиме одного транспорта метод `via()` (который определяет маршрутизацию) просто выбирает единственный доступный транспорт. Никакого специального корпуса не требуется.

## Маршрутизация с учетом транспорта

Сообщения могут отправляться с явным предпочтением транспорта:


```python
# Force Bot API route
await app.bot.send_msg("bot:123456789", "via bot", via="bot")

# Force MTProto route
await app.bot.send_msg("mt:123456789", "via mt", via="mt")

# Chat ID prefix inference
await app.bot.send_msg("bot:123456789", "prefix routes to bot")
await app.bot.send_msg("mt:123456789", "prefix routes to mt")
```


Метод `via()` разрешает транспорт:


```python
def via(self, chat_id, via=None):
    if via in {"bot", "mt"}:
        return via  # explicit override
    if chat_id.startswith("bot:"):
        return "bot"  # prefix inference
    if chat_id.startswith("mt:"):
        return "mt"
    # Default: bot first, mt fallback
    if self.bot is not None:
        return "bot"
    if self.mt is not None:
        return "mt"
```


## Что каждый транспорт делает по-своему

| Особенность | API ботов | МТПрото |
|---------|---------|---------|
| Анализ сущности сообщения | Собственные объекты JSON | Преобразование сущностей HTML→TL в Python |
| Загрузка файла | aiohttp FormData (составной) | TL-сериализованный файл upload.file |
| Механизм обновления | `getUpdates` длинный опрос (таймаут 25 секунд) | Постоянный цикл чтения TCP |
| Конфликт вебхуков | Автоматически очищается на 409 | Н/Д |
| Формат клавиатуры | `reply_markup` ключ в формате JSON | TL-сериализованный `ReplyMarkup` |
| Управление темами | Тема форума Методы API ботов | Конструкторы TL `ForumTopic` |
| Формат ошибки | `{"ok": false, ...}` в формате JSON | Конструктор TL `RpcError` |
| Миграция DC | Н/Д (Telegram справится с этим) | Динамическое переподключение на `*_MIGRATE_*` |

## Цена разделения мозга

1. **Дублирование кода**: `BotNet` имеет свой собственный `send_msg()` с форматированием параметров, специфичным для Bot API (reply_parameters, Answer_markup, message_thread_id). Отправка сообщения MTProto проходит напрямую через `mt_req("messages.sendMessage", ...)`. В `AppCore` нет единого `send_msg` — вызывающие стороны должны использовать API, соответствующие транспорту.
2. **Затраты на нормализацию**: события API бота поступают в формате JSON; События MTProto поступают в виде байтов, сериализованных в TL. Оба должны быть нормализованы к одному и тому же формату `{"kind": ..., "msg_id": ..., ...}` перед попаданием на шину.
3. **Пробел в функциях**. Некоторые операции работают только с одним транспортом (например, для `edit_text` требуется Bot API; для `get_dialogs` требуется MTProto). Платформа справляется с этим, вызывая `RuntimeError`, когда вы пытаетесь сделать невозможное.

## Замысел дизайна

Такая архитектура существует потому, что **ничто другое не дает вам оба транспорта в одной и той же функции-обработчике.** Традиционные платформы заставляют вас выбирать один. GoyGram позволяет вам запускать бота И учетную запись пользователя в одном процессе, совместно использовать обработчики, совместно использовать состояние, совместно использовать цикл событий. Это ценностное предложение разделения мозга.