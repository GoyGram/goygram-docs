---
title: Writing Code
---

# Writing GoyGram code

This is the shortest useful path from an empty folder to a working bot.

## 1. Create a bot

Create `bot.py`:

```python
import asyncio
from goygram import GoyGram

app = GoyGram(bot_token="YOUR_BOT_TOKEN")

@app.on_cmd("start")
async def start(msg):
    await msg.reply("Hello from GoyGram")

if __name__ == "__main__":
    asyncio.run(app.run())
```

Run it with:

```bash
python bot.py
```

`bot_token` is the password of your bot. Keep it out of Git and logs.

## 2. Listen for messages

```python
from goygram import filters

@app.on_msg(filt=filters.text)
async def echo(msg):
    await msg.reply("I received: " + msg.text)
```

`on_msg` registers a function. The function receives a `MsgObj`. `msg.text` is the incoming text and `msg.reply()` sends a reply in the same chat.

## 3. Add a command

```python
@app.on_cmd("ping")
async def ping(msg):
    await msg.reply("pong")
```

The handler runs for `/ping`. Write the command name without `/`.

## 4. Combine filters

```python
@app.on_msg(filt=filters.text & ~filters.me)
async def text_from_other_people(msg):
    await msg.reply("I received a message from someone else")
```

- `&` means both conditions must match;
- `|` means either condition may match;
- `~` means not;
- `filters.me` matches messages from the current bot or account.

## 5. Use an MTProto account

```python
import asyncio
from goygram import GoyGram

app = GoyGram(
    api_id=YOUR_API_ID,
    api_hash="YOUR_API_HASH",
    session_name="main",
)

@app.on_cmd("ping")
async def ping(msg):
    await msg.reply("pong from MTProto")

asyncio.run(app.run())
```

On the first run, GoyGram asks for the phone number, Telegram login code, and the 2FA password when needed. The session is stored in a vault file. Do not put these values in source code.

## 6. Call Bot API methods

```python
await app.get_chat(chat_id=123456789)
await app.send_document(chat_id=123456789, document=file_object)
await app.set_my_commands(commands=[])
```

Bot API names can be written in snake case. Bot API and MTProto are different interfaces, so their method names and arguments are not interchangeable.

## 7. Handle errors

```python
try:
    await msg.reply("Reply")
except Exception as error:
    app.logger.exception("Could not send reply: %s", error)
```

Do not print tokens, vault files, or authentication keys.

## 8. Add a new feature

1. Choose Bot API or MTProto.
2. Choose the event your feature needs.
3. Write one small handler.
4. Add a filter.
5. Test the normal case and the error case.
6. If the handler changes state, test restart and state cleanup.
7. Reuse the application client instead of opening a new network client per message.

More detail: [handlers and updates](Handlers-and-Updates), [filters](Filters), [events](Event-Objects), and [client reference](GoyGram-Client-Reference).
