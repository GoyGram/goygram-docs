---
---

# Руководство по миграции

Миграция с других фреймворков Python Telegram на GoyGram.

## Из телемарафона

### Миграция сеанса

GoyGram автоматически обнаруживает и переносит файлы Telethon `.session`:


```python
# Your existing Telethon session: default.session
# Just use the same session_name in GoyGram:
app = GoyGram(api_id=API_ID, api_hash=API_HASH, session_name="default")
# default.session → default.vault (automatic, zeroized after migration)
```


### Различия API

| Телемарафон | ГойГрам |
|----------|---------|
| `client.send_message(entity, text)` | `msg.reply(text)` или `await app.send_message(chat_id=..., text=...)` |
| `client.iter_messages(entity)` | `await app.mt_messages_get_history(peer=..., limit=...)` |
| `client.get_me()` | `await app.mt_account_get_me()` |
| `client.get_dialogs()` | `await app.mt_messages_get_dialogs(limit=...)` |
| `@client.on(events.NewMessage)` | `@app.on_msg()` |
| `event.reply("text")` | `await msg.reply("text")` |
| `event.delete()` | `await msg.delete()` |
| `client.start()` | `await app.run()` |

### Миграция обработчика


```python
# Telethon
@client.on(events.NewMessage(pattern=r'\.ping'))
async def handler(event):
    await event.reply('pong')

# GoyGram
@app.on_cmd(".ping")
async def handler(msg):
    await msg.reply("pong")
```


## Из Пирограммы

### Миграция сеанса

То же, что и Telethon — GoyGram читает таблицу SQLite `sessions`:


```python
# Pyrogram session: mybot.session
app = GoyGram(api_id=API_ID, api_hash=API_HASH, session_name="mybot")
# mybot.session → mybot.vault
```


### Различия API

| Пирограмма | ГойГрам |
|----------|---------|
| `app.send_message(chat_id, text)` | `await app.send_message(chat_id=..., text=...)` |
| `app.get_chat(chat_id)` | `await app.get_chat(chat_id)` |
| `@app.on_message(filters.text)` | `@app.on_msg(filt=filters.text)` |
| `@app.on_callback_query()` | `@app.on_cb()` |
| `message.reply_text("text")` | `await msg.reply("text")` |
| `app.run()` | `asyncio.run(app.run())` |

### Миграция фильтров


```python
# Pyrogram
@app.on_message(filters.command("start") & filters.private)

# GoyGram
@app.on_cmd("/start")
```


## Из python-telegram-bot

### Сеанс/Аутентификация

python-telegram-bot — это только API ботов. GoyGram поддерживает Bot API И MTProto.


```python
# python-telegram-bot
app = Application.builder().token("TOKEN").build()

# GoyGram
app = GoyGram(bot_token="TOKEN")
```


### Миграция обработчика


```python
# python-telegram-bot
async def start(update, context):
    await update.message.reply_text("Hello")

app.add_handler(CommandHandler("start", start))

# GoyGram
@app.on_cmd("/start")
async def start(msg):
    await msg.reply("Hello")
```


## Из Айограммы 2.x/3.x

Примечание. `BotNet` GoyGram содержит элементы Aiogram (MIT) и Pyrogram (LGPL-3.0), как указано в заголовках исходного кода.

Aiogram — это только API ботов. Использование Bot API GoyGram аналогично, но с возможностью двойной транспортировки:


```python
# Aiogram 3.x
@dp.message(F.text)
async def echo(message: Message):
    await message.answer("Echo")

# GoyGram
@app.on_msg(filt=filters.text)
async def echo(msg):
    await msg.reply("Echo")
```


## Ключевые понятия, от которых стоит отучиться

1. **Нет отдельного различия между клиентом и ботом**: класс `GoyGram` GoyGram обрабатывает учетные записи как ботов, так и пользователей. Один конструктор, один вызов `run()`.

2. **Нет объекта-диспетчера**: обработчики регистрируются непосредственно в экземпляре приложения. Никаких `dp.register()` — только декораторы.

3. **Нет иерархии типов обновлений/сообщений**: события: `MsgObj`, `CbObj`, `PollObj`, `MemberObj` — плоские классы с `__slots__`. Нет подклассов `Message`, `CallbackQuery`, `ChatMemberUpdated`.

4. **Нет промежуточного программного обеспечения**: нет конвейера предварительной/постобработки. Только что заказал списки обработчиков. Для поведения, подобного промежуточному программному обеспечению, напишите функцию-оболочку или используйте систему фильтров.

5. **Необработанные диктовки всегда доступны**: `msg.raw` предоставляет вам полную нормализованную диктовку событий. Нет необходимости обращаться к `update.message` или `event.original_update` — все это есть в `.raw`.