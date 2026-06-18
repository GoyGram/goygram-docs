# Transport Selection Logic

GoyGram supports dual transports — Bot API (HTTP) and MTProto (TCP). The `via()` method determines which transport to use, and `MsgObj.reply()` automatically routes through the correct one.

## The `via()` Method

```python
def via(self, chat_id: int | str, via: str | None = None) -> str:
    # 1. Explicit override
    if via in {"bot", "mt"}:
        if via == "bot" and self.bot is None:
            raise RuntimeError("bot net is not configured")
        if via == "mt" and self.mt is None:
            raise RuntimeError("mt net is not configured")
        return via

    # 2. Chat ID prefix inference
    if isinstance(chat_id, str) and chat_id.startswith("bot:"):
        if self.bot is None:
            raise RuntimeError("bot net is not configured")
        return "bot"

    if isinstance(chat_id, str) and chat_id.startswith("mt:"):
        if self.mt is None:
            raise RuntimeError("mt net is not configured")
        return "mt"

    # 3. Default: first available
    if self.bot is not None:
        return "bot"
    if self.mt is not None:
        return "mt"

    raise RuntimeError("no transport configured")
```

## Decision Priority

1. **Explicit `via=` parameter** — takes absolute precedence
2. **Chat ID prefix** (`"bot:"` or `"mt:"`) — explicit per-message routing
3. **Default fallback** — Bot API first, then MTProto

## Chat ID Prefix Stripping

The `raw_chat()` method strips prefixes before sending to the transport:

```python
def raw_chat(self, chat_id: int | str) -> int | str:
    if isinstance(chat_id, str) and ":" in chat_id:
        pfx, raw = chat_id.split(":", 1)
        if pfx in {"bot", "mt"}:
            if raw.lstrip("-").isdigit():
                return int(raw)
            return raw
    return chat_id
```

So `"bot:123456789"` becomes `123456789` when actually sent to the Bot API.

## Sending Messages

Messages are sent through transport-specific methods:

### Bot API

```python
# Dynamic dispatch — snake_case → CamelCase
await app.send_message(chat_id=123, text="Hello")

# Lower-level with special formatting (reply_to, kbd, topic_id)
await app.bot.send_msg(chat_id=123, text="Hello", kbd=my_kbd, topic_id=42)

# Direct call
await app.bot_req("sendMessage", chat_id=123, text="Hello")
```

### MTProto

```python
# Dynamic dispatch with full namespace
await app.mt_messages_send_message(peer=..., message="Hello", random_id=...)

# Direct call
await app.mt_req("messages.sendMessage", peer=..., message="Hello", random_id=...)
```

## Parameter Naming Differences

Bot API and MTProto use different parameter names for the same concepts:

| Concept | Bot API | MTProto |
|---------|---------|---------|
| Reply target | `reply_parameters` / `{"message_id": ...}` | `reply_to` |
| Keyboard | `reply_markup` | `kbd` |
| Topic | `message_thread_id` | `topic_id` |
| Link preview | `link_preview_options` | `link_options` |

`BotNet.send_msg()` handles Bot API parameter normalization. `MsgObj.reply()` handles both transports.

## Transport Selection in Replies

When a handler replies to a message, `MsgObj.reply()` uses the message's `src` to route through the correct transport:

```python
async def reply(self, txt, kbd=None, topic_id=None, link_options=None, **kw):
    if self.src == "bot" and self.app.bot is not None:
        # Build reply_parameters, reply_markup for Bot API
        return await self.app.bot_req("sendMessage",
            chat_id=self.chat_id, text=txt, ...)
    if self.app.mt is not None:
        # Resolve peer, build MTProto-specific fields
        return await self.app.mt_req("messages.sendMessage",
            peer=peer, message=txt, random_id=..., ...)
```

So if a message came via Bot API, the reply goes back via Bot API — automatically.
