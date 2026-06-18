# Code Generation Tools

GoyGram includes two code generation tools in the `tools/` directory:

## 1. Bot API Generator (`tools/gen_botapi.py`)

Scrapes the [Telegram Bot API documentation](https://core.telegram.org/bots/api) and generates `goygram/api/types.py` and `goygram/api/methods.py`.

### How It Works

**Source**: `https://core.telegram.org/bots/api` (HTML page)

1. Fetches the HTML page (or reads a local file if `--in` is specified)
2. Parses `<h4>` headers (method/type names)
3. Parses `<table>` elements (parameters/fields)
4. Converts parameter types (e.g., `Integer` → `int`, `String` → `str`, `Boolean` → `bool`)
5. Generates Python classes with `to_dict()` serialization and `__slots__`

### Type Mapping

```
"Integer" → "int"
"String" → "str"  
"Boolean" → "bool"
"Float" → "float"
"True" → "bool"
"Array of X" → "list[X]"
"X or Y" → "X|Y"
"InputFile|String" → "bytes|str"
```

### Fallback Schema

If the website can't be fetched, a hardcoded minimal schema is used (covers User, Chat, Message, keyboards, and a few core methods).

### Usage

```bash
# Fetch from live docs
python tools/gen_botapi.py

# From local file
python tools/gen_botapi.py --in bot_api.html

# Custom output directory
python tools/gen_botapi.py --out /path/to/output
```

## 2. MTProto TL Schema Generator (`tools/gen_mtproto.py`)

Generates `goygram/tl/schema.py` from Telegram's TL schema.

### How It Works

Parses TL schema format:

```
resPQ#05162463 nonce:int128 server_nonce:int128 pq:bytes = ResPQ;
invokeWithLayer#da9b0d0d layer:int query:bytes = X;
---functions---
ping#7abe77ec ping_id:long = Pong;
```

Generates:
- Python classes for each TL constructor (with `to_bytes()` serializer)
- Registry dict `REG` mapping constructor IDs → classes
- Helper functions: `enc_val()`, `enc_vec()`, `enc_bytes()`, `enc_str()`

### Constructor Classes

Each TL constructor becomes a class:

```python
class ResPQ(TlObj):
    __slots__ = ('nonce', 'server_nonce', 'pq', 'server_public_key_fingerprints')
    cid = 0x05162463
    res = 'ResPQ'
    
    def to_bytes(self):
        raw = struct.pack("<I", self.cid)
        raw += enc_val("int128", self.nonce)
        raw += enc_val("int128", self.server_nonce)
        raw += enc_val("bytes", self.pq)
        raw += enc_val("Vector<long>", self.server_public_key_fingerprints)
        return raw
```

### Usage

```bash
# From built-in fallback
python tools/gen_mtproto.py

# From local TL schema file
python tools/gen_mtproto.py --in schema.tl

# Custom output directory
python tools/gen_mtproto.py --out /custom/path
```

## Why Code Generation?

1. **Bot API evolves**: New methods and types are added regularly. Regenerating from the live docs keeps the framework current without manual updates.
2. **Correct by construction**: The generator handles snake_case conversion, optional marking, and type mapping consistently — no human typos.
3. **Type safety**: Generated classes have proper type annotations for IDE support.

The generated files are committed to the repo — the generators are maintenance tools, not part of the runtime.
