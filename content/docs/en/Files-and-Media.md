---
title: Files and Media
---

# Files and media

Bot API media is sent through the same dynamic-call surface as every other Bot API method. Use Telegram's method parameters directly and pass the resulting keyword arguments to GoyGram.

## Send a file or media reference

```python
await app.send_document(
    chat_id=msg.chat.id,
    document="FILE_ID_OR_URL",
    caption="Report",
)

await app.send_photo(
    chat_id=msg.chat.id,
    photo="FILE_ID_OR_URL",
    caption="Screenshot",
)
```

A Telegram `file_id` is the most efficient way to resend media that Telegram already knows. URLs are accepted by methods that Telegram supports. For multipart uploads, use the parameter form supported by the current Bot API transport and test it against your target Telegram endpoint.

## Forward and copy messages

```python
await app.forward_message(
    chat_id=target_chat,
    from_chat_id=msg.chat.id,
    message_id=msg.message_id,
)

await app.copy_message(
    chat_id=target_chat,
    from_chat_id=msg.chat.id,
    message_id=msg.message_id,
)
```

Dynamic names are converted from snake case to Bot API camel case: `copy_message` becomes `copyMessage`.

## Inspect incoming content

A message handler receives `MsgObj`. Common fields include `text`, `caption`, `photo`, `document`, `video`, `audio`, `voice`, `sticker`, and `reply_to_message`. Bot API fields that GoyGram does not normalize remain accessible through `msg.raw`.

```python
@app.on_msg
async def inspect(msg):
    if msg.document:
        await msg.reply("Document received")
```

## MTProto media

For MTProto, call the schema method explicitly through the `mt_` prefix, for example `mt_messages_send_media`. Arguments must match the active Telegram TL schema. Read [MTProto Calls](/docs/MTProto-Calls) before using raw MTProto objects.

Also see [Bot API Calls](/docs/Bot-API-Calls) and [Event Objects](/docs/Event-Objects).