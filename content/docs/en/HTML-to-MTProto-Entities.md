# HTML to MTProto Entities

When sending messages via MTProto with `parse_mode="HTML"`, GoyGram converts HTML tags to Telegram's TL entity format. This is a pure-Python regex parser — no external HTML library.

## The Conversion Function

```python
def _html_to_entities(text: str) -> tuple[str, list[tuple[int, int, int, str | None]]]:
    """Returns (cleaned_text, entities_list)."""
```

Each entity is:
```python
(offset: int, length: int, type_code: int, url: str | None)
```

## Supported Tags

| HTML Tag | Type Code | Description |
|----------|-----------|-------------|
| `<b>`, `<strong>` | 1 | Bold |
| `<i>`, `<em>` | 2 | Italic |
| `<u>`, `<ins>` | 3 | Underline |
| `<s>`, `<strike>`, `<del>` | 4 | Strikethrough |
| `<code>` | 5 | Inline code |
| `<pre>` | 6 | Preformatted block |
| `<a href="...">` | 7 | Text link (with URL) |
| (text mention) | 8 | Text mention (with user ID) |

## How It Works

The parser uses `re.finditer` to find all tags, then tracks offsets with a stack:

```python
tags = {
    'b': 1, 'strong': 1,
    'i': 2, 'em': 2,
    'u': 3, 'ins': 3,
    's': 4, 'strike': 4, 'del': 4,
    'code': 5,
    'pre': 6,
}

it = re.finditer(r'</?([a-zA-Z][a-zA-Z0-9]*)(?:\s+[^>]*)?>', text)
```

For each tag:
1. **Opening tag**: Push `(current_offset, tag_name, url_or_None)` onto stack
2. **Closing tag**: Pop matching tag from stack, compute `length = current_offset - tag_offset`, add entity

For `<a>` tags, the `href` attribute is extracted:
```python
href = re.search(r'href=["\']([^"\']*)["\']', m.group(0))
url = href.group(1) if href else None
```

## Edge Cases

- **Unclosed tags**: Any unclosed tags at the end of parsing still generate entities (length = remaining text). This matches Telegram's own behavior.
- **Mismatched closing tags**: The parser walks the stack backward to find a matching opening tag. If `<b><i>text</b></i>`, the `</b>` closes the `<i>` (last opened, first matched).
- **Empty entities**: If `length <= 0`, the entity is skipped (not added to the list).

## Integration

The parser is called in `MTNet._build_body()` when `parse_mode == "HTML"`:

```python
if act in {'messages.sendMessage', 'app.bot.send_msg'}:
    text = str(obj.get('text') or obj.get('message') or '')
    entities = None
    if obj.get('parse_mode') == 'HTML':
        text, entities = _html_to_entities(text)
    return self.codec.messages_send_message(
        peer=peer, message=text,
        entities=entities,
        ...
    )
```

The raw HTML tags are stripped from the text; only the formatted text + entity list is sent.

## Entity Encoding in TL

The entity list is serialized into TL format by `MTCodec._encode_entities()`:

```python
def _encode_entities(self, entities):
    raw = u32(0x1cb5c415) + i32(len(entities))  # Vector header
    for offset, length, tp, url in entities:
        if tp == 7 and url:
            raw += u32(0x76a6d327) + i32(offset) + i32(length) + tl_str(url)
        elif tp == 1:
            raw += u32(0xbd610bc9) + i32(offset) + i32(length)  # messageEntityBold
        elif tp == 2:
            raw += u32(0x826f8b60) + i32(offset) + i32(length)  # messageEntityItalic
        # ... etc for each type
```

Each entity type has its own TL constructor ID. The resulting bytes are embedded in the `messages.sendMessage` payload.

## Parsing Limitations

- No nested `<a>` tags (will cause misparsing)
- No `<span>` or CSS-based styling (Telegram doesn't support it)
- `<pre>` with `language` attribute is not supported (plain `<pre>` only)
- Escaped HTML entities (`&lt;`, `&gt;`) are not handled (they'll appear as literal text)
