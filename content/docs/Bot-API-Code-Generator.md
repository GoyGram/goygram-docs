---
title: "Bot API Code Generator"
---

# Bot API Code Generator

The `tools/gen_botapi.py` utility generates `goygram/api/types.py` and `goygram/api/methods.py` — typed Python classes for the Bot API.

## Data Sources

1. **Online**: parsing [core.telegram.org/bots/api](https://core.telegram.org/bots/api) via `HTMLParser`
2. **Local file**: `--in schema.json` (JSON with `types` and `methods` keys)
3. **Fallback**: built-in `FALLBACK` schema with basic types

## Parser: BotHtml

The `BotHtml(HTMLParser)` class looks for sections with `<h4>` headers (type/method names) followed by `<table>` elements (fields/parameters):

```python
class BotHtml(HTMLParser):
    def handle_starttag(self, tag, attrs):
        if tag == "h4":
            self.in_h4 = True       # start collecting name
        elif tag == "table":
            self.in_table = True    # start collecting table

    def flush(self):
        # Distinguish parameter tables from field tables by headers:
        if "parameter" in headers:
            # This is a method → self.methods.append(...)
        if "field" in headers:
            # This is a type → self.types.append(...)
```

## Type Conversion

The `py_t()` function converts Telegram notation to Python annotations:

```python
def py_t(tp: str, opt: bool = False) -> str:
    raw = tp.replace("Integer", "int").replace("String", "str") \
            .replace("Boolean", "bool").replace("Float", "float") \
            .replace("Array of ", "list[")
    raw = raw.replace(" or ", "|").replace("InputFile", "bytes|str") \
             .replace("Object", "dict[str,Any]")
    if opt and "None" not in raw:
        raw = f"{raw}|None"
    return raw or "Any"
```

Field names are converted to snake_case:

```python
def snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()
```

## types.py Generation

```python
def gen_types(spec) -> str:
    for tp in spec["types"]:
        name = tp["name"]
        fields = tp.get("fields", [])
        # Generates:
        # class {name}:
        #     __slots__ = (...)
        #     def __init__(self, ...): ...
        #     def to_dict(self) -> dict[str, Any]: ...
```

## methods.py Generation

```python
def gen_methods(spec) -> str:
    out = [..., "class BotAPI:", ...]
    for m in spec["methods"]:
        py_name = snake(m["name"])
        # Generates:
        # async def send_message(self, chat_id, text, ...) -> Message:
        #     data = {}
        #     if chat_id is not None: data["chat_id"] = dump(chat_id)
        #     ...
        #     return await self.net.req("sendMessage", data)
```

Plus dynamic `__getattr__`:

```python
def __getattr__(self, name: str) -> Any:
    async def dyn(**kw: Any) -> Any:
        parts = name.split("_")
        meth = parts[0] + "".join(x[:1].upper() + x[1:] for x in parts[1:])
        return await self.call(meth, **kw)
    return dyn
```

## FALLBACK Schema

Used when:
- Network is unavailable
- Page structure changed and the parser couldn't extract data
- Any other download error occurred

Contains a minimal set: `User`, `Chat`, `InlineKeyboardButton`, `InlineKeyboardMarkup`, `KeyboardButton`, `ReplyKeyboardMarkup`, `Message` + methods `getMe`, `sendMessage`, `editMessageText`, `deleteMessage`.

## Running

```bash
python tools/gen_botapi.py                     # from core.telegram.org
python tools/gen_botapi.py --in schema.json    # from JSON
python tools/gen_botapi.py --out custom/api/   # custom output path
```
