---
title: "Генератор схемы TL"

---
# Генератор схемы TL

Утилита `tools/gen_mtproto.py` генерирует `goygram/tl/schema.py` — классы Python для всех конструкторов TL, используемых в MTProto.

## Как это работает

1. Анализирует схему TL (либо из файла `--in`, либо из встроенного `FALLBACK`).
2. Разбивает строки вида `name#crc fields... = ResultType;`
3. Создает классы, наследующие от `TlObj` с `__slots__`, `to_dict()`, `to_bytes()`.

## Формат строки TL


```
resPQ#05162463 nonce:int128 server_nonce:int128 pq:bytes
    server_public_key_fingerprints:Vector<long> = ResPQ;
```


- `resPQ` — имя конструктора
- `#05162463` — идентификатор CRC32
- Поля в формате `name:type`.
- `= ResPQ` — тип возвращаемого значения

## Созданная структура классов


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


## enc_val() — Сериализация полей

Универсальная функция для сериализации типов TL:


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


## enc_bytes() — Префиксное кодирование


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


## REG — словарь конструктора


```python
REG = {
    0x05162463: ResPQ,
    0x83c95aec: P_Q_inner_data,
    ...
}
```


## FALLBACK-схема

Если схема TL не указана через `--in`, используется встроенная минимальная схема:


```python
FALLBACK = """
resPQ#05162463 nonce:int128 server_nonce:int128 pq:bytes
    server_public_key_fingerprints:Vector<long> = ResPQ;
p_q_inner_data#83c95aec pq:bytes p:bytes q:bytes nonce:int128
    server_nonce:int128 new_nonce:int256 = P_Q_inner_data;
...
"""
```


Этого достаточно для обмена ключами и базовой авторизации.

## типы/функции Разделение

Анализатор поддерживает разделители `---functions---` и `---types---`. Каждый элемент хранит `kind` (`"ctor"` или `"func"`), что позволяет различать конструкторы типов и методы RPC.