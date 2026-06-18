---
title: "Bot API Types"
---

# Bot API Types

GoyGram includes a set of lightweight typed wrappers for core Bot API data structures in `goygram/api/types.py`. These types use `__slots__` and expose `to_dict()` for clean serialization. Keyboard types are handled by the dynamic `KbdBuilder` (see [Keyboard System](Keyboard-System)) — no hardcoded button classes.

## Generation Tool

`tools/gen_botapi.py` parses [core.telegram.org/bots/api](https://core.telegram.org/bots/api) using `HTMLParser` (class `BotHtml`), extracting type and method tables from the official documentation to generate Python classes with `__slots__` and `to_dict()`.

```bash
# Generate from live website
python tools/gen_botapi.py

# Generate from a local JSON schema
python tools/gen_botapi.py --in schema.json
```

## Available Types

The current set (from the fallback schema used when the website is unreachable):

| Type | Fields |
|------|--------|
| **User** | `id`, `is_bot`, `first_name`, `username` |
| **Chat** | `id`, `type`, `title`, `username` |
| **Message** | `message_id`, `date`, `chat`, `text` |

Keyboard types (`InlineKeyboardMarkup`, `ReplyKeyboardMarkup`, `InlineKeyboardButton`, `KeyboardButton`) are no longer hardcoded — use the dynamic `KbdBuilder` via `app.ikb()` / `app.rkb()` instead.

## Class Structure

Every type follows a uniform pattern — dataclass-like initialization with `__slots__`:

```python
class User:
    __slots__ = ('id', 'is_bot', 'first_name', 'username')

    def __init__(self, id: int, is_bot: bool, first_name: str,
                 username: str | None = None) -> None:
        self.id = id
        self.is_bot = is_bot
        self.first_name = first_name
        self.username = username

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": dump(self.id),
            "is_bot": dump(self.is_bot),
            "first_name": dump(self.first_name),
            "username": dump(self.username),
        }
```

## Using Types

```python
from goygram.api.types import Chat

chat = Chat(id=123456, type="private", username="example")
await app.send_message(chat_id=chat.id, text=f"Hello {chat.username}!")
```

The `dump()` function recursively converts typed objects to plain dicts before JSON serialization.

## Fallback Schema

When the parser cannot fetch live types from the website (network unavailable, HTML structure changed), a baked-in `FALLBACK` schema in `tools/gen_botapi.py` provides a minimal set of types and methods for basic operation.

## Integration with BotAPI Class

The `BotAPI` class in `api/methods.py` uses dynamic dispatch — every method resolves through `__getattr__` with automatic snake_case→camelCase conversion. No typed method signatures are hardcoded:

```python
class BotAPI:
    def __getattr__(self, name: str) -> Any:
        async def dyn(**kw: Any) -> Any:
            parts = name.split("_")
            meth = parts[0] + "".join(x[:1].upper() + x[1:] for x in parts[1:])
            return await self.call(meth, **kw)
        return dyn
```

All parameters pass through `dump()` before being sent as JSON to the Bot API — this strips `None` values and converts typed objects to their dictionary representations recursively. Keyboard dicts from `KbdBuilder.build()` pass through as-is.
