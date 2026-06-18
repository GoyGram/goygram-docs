---
title: "MsgObj Reference"
---

# MsgObj Reference

`MsgObj` wraps incoming messages from both Bot API and MTProto transports. Every `on_msg` handler receives one.

## Class Definition

```python
class MsgObj:
    __slots__ = ("src", "raw", "app", "id", "chat_id", "from_id",
                 "text", "is_me", "cmd", "args", "match", "finds", "parts")

    def __init__(self, src, raw, app):
        self.src = src                     # "bot" or "mt"
        self.raw = raw                     # original normalized event dict
        self.app = app                     # AppCore reference
        self.id = raw.get("msg_id")        # message ID
        self.chat_id = raw.get("chat_id")  # chat/channel/user ID
        self.from_id = raw.get("from_id")  # sender user ID
        self.text = str(raw.get("text", "")) # message text (always string)
        self.is_me = bool(raw.get("is_me", False))  # from current account?
        self.cmd = None                    # set by command filter
        self.args = None                   # set by command filter
        self.match = None                  # set by regex/fullmatch
        self.finds = None                  # set by findall/finditer
        self.parts = None                  # set by split filter
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `msg_id` | `int\|None` | Alias for `id` |
| `src` | `str` | `"bot"` or `"mt"` — transport source |
| `chat_id` | `int\|str\|None` | Target chat ID |
| `from_id` | `int\|None` | Sender user ID |
| `text` | `str` | Message text (empty string if no text) |
| `is_me` | `bool` | True if the message is from the current account |
| `raw` | `dict` | Raw normalized event dict |
| `app` | `AppCore` | Internal app reference |

## Filter-Injected Fields

These fields start as `None` and are populated by specific filter classes during handler dispatch:

| Field | Set By | Type | Description |
|-------|--------|------|-------------|
| `cmd` | `command` filter | `str\|None` | Matched command name |
| `args` | `command` filter | `str\|None` | Everything after the command |
| `match` | `regex`, `fullmatch` | `re.Match\|None` | Regex match object |
| `finds` | `findall`, `finditer` | `list\|None` | All regex match results |
| `parts` | `split` | `list[str]\|None` | Text split by regex |

```python
@app.on_cmd("greet")
async def greet(msg):
    # msg.cmd == "greet"
    # msg.args == "extra text here"
    name = msg.args.strip() or "World"
    await msg.reply(f"Hello, {name}!")

@app.on_msg(filt=filters.regex(r"bug #(\d+)"))
async def bug_ref(msg):
    # msg.match.group(1) == "42" for "bug #42"
    bug_id = msg.match.group(1)
    await msg.reply(f"Bug #{bug_id} referenced")
```

## Methods

### `reply(text, kbd=None, topic_id=None, link_options=None, **kw)`

Reply to the message. Automatically uses the same transport the message came from.

```python
await msg.reply("Hello back")
await msg.reply("With keyboard", kbd=my_kbd)
await msg.reply("Click here", link_options={"is_disabled": True})
```

For Bot API: wraps in `reply_parameters`. For MTProto: builds `inputReplyToMessage`. Returns the transport call result.

### `delete()`

Delete this message.

```python
await msg.delete()
```

Returns `None` if `chat_id` or `msg_id` is missing. Uses Bot API `deleteMessage` or MTProto `messages.deleteMessages`.

### `net()`

Returns the transport instance for this message's source.

### `_resolve_peer(chat_id)`

Internal. Resolves a chat ID to an MTProto peer constructor: positive → `inputPeerUser`, negative above -1T → `inputPeerChat`, negative below -1T → `inputPeerChannel`.

## Event Source

The `src` field follows the message through the pipeline:

```
BotNet.spin() → bus.push("bot", data) → MsgObj(src="bot")
MTNet.spin() → bus.push("mt", data)  → MsgObj(src="mt")
```

## Memory Notes

`__slots__` — no `__dict__`. The `raw` dict is stored by reference, giving access to the full original event data for transport-specific fields.
