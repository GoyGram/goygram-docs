---
title: Quick Start Bot API
---

# Quick Start: Bot API

Get a Telegram bot running in 30 seconds with GoyGram.

## 1. Install

```bash
pip install goygram
```

Requires Python 3.11+.

## 2. Get a Bot Token

Talk to [@BotFather](https://t.me/BotFather) on Telegram to create a bot and get a token.

## 3. Write Your Bot

```python
import asyncio
from goygram import GoyGram, filters

app = GoyGram(bot_token="123456:ABC_TOKEN")

@app.on_msg(filt=filters.text)
async def echo(msg):
    await msg.reply(f"You said: {msg.text}")

asyncio.run(app.run())
```

## 4. Run It

```bash
python bot.py
```

Your bot is now running. Send it a message and it echoes back.

## Going Further

### Commands

```python
@app.on_cmd("/start")
async def start(msg):
    await msg.reply("Welcome to GoyGram!")
```

### Inline Keyboards

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

### Send Photos/Documents

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

### Dynamic API Calls

Any Bot API method works, even undocumented ones:

```python
await app.sendAnimation(chat_id=..., animation=..., caption=...)
await app.getUserProfilePhotos(user_id=...)
await app.setMyCommands(commands=[...])
```

### Formatting

```python
await msg.reply(**app.html("<b>Bold</b> and <i>italic</i>"))
await msg.reply(**app.md("**Bold** and *italic*"))
```

### Webhooks (Instead of Polling)

```python
await app.set_webhook("https://myserver.com/webhook")
# GoyGram still polls by default. For a pure webhook setup,
# call set_webhook and handle webhook events on your HTTP server.
```

## Logging

```bash
GOYGRAM_LOG=DEBUG python bot.py  # verbose
GOYGRAM_LOG=WARNING python bot.py  # quiet
```

Levels: `DEBUG`, `INFO`, `WARNING`, `ERROR`.

## Error Handling

GoyGram raises standard Python exceptions — wrap API calls in try/except:

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

## Media Groups

Send multiple photos as an album:

```python
@app.on_cmd("/album")
async def send_album(msg):
    photos = [
        {"type": "photo", "media": "https://example.com/photo1.jpg", "caption": "First"},
        {"type": "photo", "media": "https://example.com/photo2.jpg"},
    ]
    await app.send_media_group(msg.chat_id, photos)
```

## File Upload from Disk

```python
@app.on_cmd("/upload")
async def upload_file(msg):
    # Send a local file — tuple format: (filename, bytes)
    with open("/path/to/report.pdf", "rb") as f:
        await app.send_document(msg.chat_id, ("report.pdf", f.read()))
```

The tuple format `(filename, bytes)` is detected by `BotNet.has_file()` and sent as multipart form data. You can also pass raw `bytes` (auto-named) or a URL string.

## Poll Handling

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

## Forum Topic Messages

Send messages to specific topics in forum supergroups:

```python
@app.on_cmd("/topic")
async def topic_msg(msg):
    # Send to topic 42 in forum supergroup -10012345678
    await app.bot.send_msg(-10012345678, "Hello topic!", topic_id=42)
```

## Reply Keyboard

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

## Full Bot Example

Here's a complete bot with commands, callbacks, files, and polls:

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
