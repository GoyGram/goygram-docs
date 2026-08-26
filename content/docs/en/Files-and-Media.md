---
title: Files and Media
---

# Files and media

Bot API media is sent through the same dynamic-call surface as every other Bot API method. Use Telegram's method parameters directly and pass the resulting keyword arguments to GoyGram.

## Send a file or media reference

```python
await app.send_document(
    chat_id=msg.chat_id,
    document="FILE_ID_OR_URL",
    caption="Report",
)

await app.send_photo(
    chat_id=msg.chat_id,
    photo="FILE_ID_OR_URL",
    caption="Screenshot",
)
```

A Telegram `file_id` is the most efficient way to resend media that Telegram already knows. URLs are accepted by methods that Telegram supports. For multipart uploads, use the parameter form supported by the current Bot API transport and test it against your target Telegram endpoint.

For Bot API files, use `await app.download_file(file_id, destination=None)`. It returns bytes when `destination` is omitted, or writes the file atomically to the supplied path.

## Forward and copy messages

```python
await app.forward_message(
    chat_id=target_chat,
    from_chat_id=msg.chat_id,
    message_id=msg.id,
)

await app.copy_message(
    chat_id=target_chat,
    from_chat_id=msg.chat_id,
    message_id=msg.id,
)
```

Dynamic names are converted from snake case to Bot API camel case: `copy_message` becomes `copyMessage`.

## Inspect incoming content

A message handler receives `MsgObj`. Its normalized fields include `text`, `id`, `chat_id`, and `from_id`; media and other Bot API fields remain accessible through `msg.raw`.

```python
@app.on_msg
async def inspect(msg):
    if msg.raw.get("document"):
        await msg.reply("Document received")
```

## MTProto media

For MTProto, `app.core.mt.upload_file(source, file_name=None, part_size=524288)` uploads raw file parts through `upload.saveFilePart`, and `app.core.mt.download_file(location, destination, offset=0, limit=524288)` downloads raw file parts through `upload.getFile`. Arguments for media methods such as `messages.sendMedia` must match the active Telegram TL schema. Read [MTProto Calls](/docs/MTProto-Calls) before using raw MTProto objects.

Also see [Bot API Calls](/docs/Bot-API-Calls) and [Event Objects](/docs/Event-Objects).