---
title: "Быстрый старт: API бота"

---
# Быстрый старт: API бота

Запустите бот Telegram за 30 секунд с помощью GoyGram.

## 1. Установить


```bash
pip install goygram
```


Требуется Python 3.11+.

## 2. Получите токен бота

Поговорите с [@BotFather](https://t.me/BotFather) в Telegram, чтобы создать бота и получить токен.

## 3. Напишите своего бота


```python
import asyncio
from goygram import GoyGram, filters

app = GoyGram(bot_token="123456:ABC_TOKEN")

@app.on_msg(filt=filters.text)
async def echo(msg):
    await msg.reply(f"You said: {msg.text}")

asyncio.run(app.run())
```


## 4. Запустите это


```bash
python bot.py
```


Ваш бот теперь работает. Отправьте ему сообщение, и оно ответит эхом.

## Идем дальше

### Команды


```python
@app.on_cmd("/start")
async def start(msg):
    await msg.reply("Welcome to GoyGram!")
```


### Встроенные клавиатуры


```python
@app.on_cmd("/menu")
async def menu(msg):
    kbd = (
        app.ikb()
        .btn("Option A", callback_data="opt_a")
        .btn("Option B", callback_data="opt_b")
        .build()
    )
    await msg.reply("Choose:", kbd=kbd)

@app.on_cb()
async def on_callback(cb):
    await cb.answer(f"You picked {cb.data}")
    await cb.edit(f"Selected: {cb.data}")
```


### Отправить фотографии/документы


```python
@app.on_cmd("/photo")
async def send_photo(msg):
    await app.send_photo(msg.chat_id, "https://example.com/photo.jpg",
                         caption="Check this out")

@app.on_cmd("/file")
async def send_file(msg):
    with open("report.pdf", "rb") as f:
        await app.send_document(msg.chat_id, ("report.pdf", f.read()))
```


### Динамические вызовы API

Работает любой метод Bot API, даже недокументированный:


```python
await app.sendAnimation(chat_id=..., animation=..., caption=...)
await app.getUserProfilePhotos(user_id=...)
await app.setMyCommands(commands=[...])
```


### Форматирование


```python
await msg.reply(**app.html("<b>Bold</b> and <i>italic</i>"))
await msg.reply(**app.md("**Bold** and *italic*"))
```


### Вебхуки (вместо опроса)


```python
await app.set_webhook("https://myserver.com/webhook")
# GoyGram still polls by default. For a pure webhook setup,
# call set_webhook and handle webhook events on your HTTP server.
```


## Ведение журнала


```bash
GOYGRAM_LOG=DEBUG python bot.py  # verbose
GOYGRAM_LOG=WARNING python bot.py  # quiet
```


Уровни: `DEBUG`, `INFO`, `WARNING`, `ERROR`.

## Обработка ошибок

GoyGram вызывает стандартные исключения Python — вызовы API обертываются в try/Exception:


```python
@app.on_cmd("/admin")
async def admin_cmd(msg):
    try:
        admins = await app.get_admins(msg.chat_id)
        names = [a.get("user", {}).get("first_name", "?") for a in admins]
        await msg.reply("Admins: " + ", ".join(names))
    except Exception as e:
        err = str(e)
        if "403" in err:
            await msg.reply("I don't have permission to see admins.")
        else:
            await msg.reply(f"Error: {err}")
```


## Медиа-группы

Отправьте несколько фотографий в виде альбома:


```python
@app.on_cmd("/album")
async def send_album(msg):
    photos = [
        {"type": "photo", "media": "https://example.com/photo1.jpg", "caption": "First"},
        {"type": "photo", "media": "https://example.com/photo2.jpg"},
    ]
    await app.send_media_group(msg.chat_id, photos)
```


## Загрузка файла с диска


```python
@app.on_cmd("/upload")
async def upload_file(msg):
    # Send a local file — tuple format: (filename, bytes)
    with open("/path/to/report.pdf", "rb") as f:
        await app.send_document(msg.chat_id, ("report.pdf", f.read()))
```


Формат кортежа `(filename, bytes)` обнаруживается `BotNet.has_file()` и отправляется как данные составной формы. Вы также можете передать необработанный `bytes` (с автоматическим именем) или строку URL.

## Обработка опроса


```python
@app.on_cmd("/poll")
async def create_poll(msg):
    await app.send_poll(
        chat_id=msg.chat_id,
        question="What's your favorite color?",
        options=["Red", "Blue", "Green"],
        is_anonymous=False
    )

@app.on_poll()
async def poll_update(poll):
    if poll.closed:
        print(f"Poll '{poll.question}' is now closed")
```


## Сообщения в темах форума

Отправляйте сообщения в определенные темы в супергруппах форума:


```python
@app.on_cmd("/topic")
async def topic_msg(msg):
    # Send to topic 42 in forum supergroup -10012345678
    await app.bot.send_msg(-10012345678, "Hello topic!", topic_id=42)
```


## Ответить на клавиатуру


```python
@app.on_cmd("/keyboard")
async def show_keyboard(msg):
    kbd = (
        app.rkb(resize_keyboard=True, one_time_keyboard=True)
        .btn("Yes")
        .btn("No")
        .build()
    )
    await msg.reply("Proceed?", kbd=kbd)
```


## Полный пример бота

Вот полноценный бот с командами, обратными вызовами, файлами и опросами:


```python
import asyncio
from goygram import GoyGram, filters

app = GoyGram(bot_token="123456:ABC_TOKEN")

@app.on_cmd("/start")
async def start(msg):
    kbd = (
        app.ikb()
        .btn("📸 Photo", callback_data="photo")
        .btn("📄 File", callback_data="file")
        .build()
    )
    await msg.reply("Welcome! Choose an option:", kbd=kbd)

@app.on_cb()
async def handle_cb(cb):
    if cb.data == "photo":
        await cb.answer("Sending photo...")
        await app.send_photo(cb.chat_id, "https://picsum.photos/400/300",
                             caption="Here's a random photo!")
    elif cb.data == "file":
        await cb.answer("Sending file...")
        await app.send_document(cb.chat_id, ("hello.txt", b"Hello from GoyGram!"))

@app.on_msg(filt=filters.text)
async def echo(msg):
    await msg.reply(f"Echo: {msg.text}")

asyncio.run(app.run())
```