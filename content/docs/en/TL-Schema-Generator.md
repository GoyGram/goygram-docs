---
title: TL Schema Generator
---

# TL Schema Generator

The `tools/gen_mtproto.py` utility generates `goygram/tl/schema.py` — Python classes for all TL constructors used in MTProto.

## How It Works

1. Parses a TL schema (either from a `--in` file, or built-in `FALLBACK`)
2. Splits lines of the form `name#crc fields... = ResultType;`
3. Generates classes inheriting from `TlObj` with `__slots__`, `to_dict()`, `to_bytes()`

## TL Line Format

```
resPQ#05162463 nonce:int128 server_nonce:int128 pq:bytes
    server_public_key_fingerprints:Vector<long> = ResPQ;
```

- `resPQ` — constructor name
- `#05162463` — CRC32 identifier
- Fields in `name:type` format
- `= ResPQ` — return type

## Generated Class Structure

```python
class ResPQ(TlObj):
    __slots__ = ('nonce', 'server_nonce', 'pq', 'server_public_key_fingerprints')
    cid = 0x05162463
    res = 'ResPQ'

    def __init__(self, nonce: Any, server_nonce: Any,
                 pq: Any, server_public_key_fingerprints: Any) -> None:
        self.nonce = nonce
        self.server_nonce = server_nonce
        self.pq = pq
        self.server_public_key_fingerprints = server_public_key_fingerprints

    def to_bytes(self) -> bytes:
        raw = struct.pack("<I", self.cid)
        raw += enc_val('int128', self.nonce)
        raw += enc_val('int128', self.server_nonce)
        raw += enc_val('bytes', self.pq)
        raw += enc_val('Vector<long>', self.server_public_key_fingerprints)
        return raw
```

## enc_val() — Field Serialization

Universal function for serializing TL types:

```python
def enc_val(tp: str, v: Any) -> bytes:
    if tp == "int":    return struct.pack("<i", int(v))
    if tp == "long":   return struct.pack("<q", int(v))
    if tp == "int128": return bytes(v)          # exactly 16 bytes
    if tp == "int256": return bytes(v)          # exactly 32 bytes
    if tp == "string": return enc_str(str(v))
    if tp == "bytes":  return enc_bytes(bytes(v))
    if tp == "Bool":   return struct.pack("<I", 0x997275b5 if v else 0xbc799737)
    if tp.startswith("Vector<"): return enc_vec(tp[7:-1], list(v))
    ...
```

## enc_bytes() — Prefix Encoding

```python
def enc_bytes(v: bytes) -> bytes:
    n = len(v)
    if n < 254:
        head = bytes([n])                     # 1 byte
    else:
        head = bytes([254]) + n.to_bytes(3, "little")  # 4 bytes
    raw = head + v
    return raw + (b"\x00" * pad4(len(raw)))   # align to 4
```

## REG — Constructor Dictionary

```python
REG = {
    0x05162463: ResPQ,
    0x83c95aec: P_Q_inner_data,
    ...
}
```

## FALLBACK Schema

If no TL schema is provided via `--in`, a built-in minimal schema is used:

```python
FALLBACK = """
resPQ#05162463 nonce:int128 server_nonce:int128 pq:bytes
    server_public_key_fingerprints:Vector<long> = ResPQ;
p_q_inner_data#83c95aec pq:bytes p:bytes q:bytes nonce:int128
    server_nonce:int128 new_nonce:int256 = P_Q_inner_data;
...
"""
```

This is sufficient for key exchange and basic authorization.

## types/functions Separation

The parser supports `---functions---` and `---types---` separators. Each element stores `kind` (`"ctor"` or `"func"`), allowing distinction between type constructors and RPC methods.
