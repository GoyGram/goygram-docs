---
title: Migration Guide
---

# Migration Guide

Migrating from other Python Telegram frameworks to GoyGram.

## From Telethon

### Session Migration

GoyGram automatically detects and migrates Telethon `.session` files:

```python
# Your existing Telethon session: default.session
# Just use the same session_name in GoyGram:
app = GoyGram(api_id=API_ID, api_hash=API_HASH, session_name="default")
# default.session → default.vault (automatic, zeroized after migration)
```

### API Differences

| Telethon | GoyGram |
|----------|---------|
| `client.send_message(entity, text)` | `msg.reply(text)` or `await app.send_message(chat_id=..., text=...)` |
| `client.iter_messages(entity)` | `await app.mt_messages_get_history(peer=..., limit=...)` |
| `client.get_me()` | `await app.mt_account_get_me()` |
| `client.get_dialogs()` | `await app.mt_messages_get_dialogs(limit=...)` |
| `@client.on(events.NewMessage)` | `@app.on_msg()` |
| `event.reply("text")` | `await msg.reply("text")` |
| `event.delete()` | `await msg.delete()` |
| `client.start()` | `await app.run()` |

### Handler Migration

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

## From Pyrogram

### Session Migration

Same as Telethon — GoyGram reads the SQLite `sessions` table:

```python
# Pyrogram session: mybot.session
app = GoyGram(api_id=API_ID, api_hash=API_HASH, session_name="mybot")
# mybot.session → mybot.vault
```

### API Differences

| Pyrogram | GoyGram |
|----------|---------|
| `app.send_message(chat_id, text)` | `await app.send_message(chat_id=..., text=...)` |
| `app.get_chat(chat_id)` | `await app.get_chat(chat_id)` |
| `@app.on_message(filters.text)` | `@app.on_msg(filt=filters.text)` |
| `@app.on_callback_query()` | `@app.on_cb()` |
| `message.reply_text("text")` | `await msg.reply("text")` |
| `app.run()` | `asyncio.run(app.run())` |

### Filter Migration

```python
# Pyrogram
@app.on_message(filters.command("start") & filters.private)

# GoyGram
@app.on_cmd("/start")
```

## From python-telegram-bot

### Session / Auth

python-telegram-bot is Bot API only. GoyGram supports Bot API AND MTProto.

```python
# python-telegram-bot
app = Application.builder().token("TOKEN").build()

# GoyGram
app = GoyGram(bot_token="TOKEN")
```

### Handler Migration

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

## From Aiogram 2.x/3.x

Note: GoyGram's `BotNet` contains elements of Aiogram (MIT) and Pyrogram (LGPL-3.0) as noted in the source headers.

Aiogram is Bot API only. GoyGram's Bot API usage is similar but with dual-transport capability:

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

## Key Concepts to Unlearn

1. **No separate client/bot distinction**: GoyGram's `GoyGram` class handles both bot and user accounts. One constructor, one `run()` call.

2. **No dispatcher object**: Handlers are registered directly on the app instance. No `dp.register()` — just decorators.

3. **No update/message type hierarchy**: Events are `MsgObj`, `CbObj`, `PollObj`, `MemberObj` — flat classes with `__slots__`. No `Message`, `CallbackQuery`, `ChatMemberUpdated` subclasses.

4. **No middleware**: No pre/post-processing pipeline. Just ordered handler lists. For middleware-like behavior, write a wrapper function or use the filter system.

5. **Raw dicts always available**: `msg.raw` gives you the full normalized event dict. No need to access `update.message` or `event.original_update` — it's all in `.raw`.
