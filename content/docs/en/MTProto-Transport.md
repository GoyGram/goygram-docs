---
title: MTProto Transport
---

# MTProto Transport

`MTNet` (`goygram/vendor/mtproto.py`) is the raw TCP MTProto transport. It handles everything from socket connection to DH key exchange to AES-IGE packet encryption to TL message parsing. This is the most complex component in GoyGram.

## Architecture

```python
class MTNet:
    def __init__(self, host, port, bus, key=None, iv=None, *, proxy=None,
                 app_name=None, app_version=None, device_model=None,
                 system_version=None, system_lang_code="en",
                 lang_pack="", lang_code="en"):
        self.host = host              # MTProto server host
        self.port = port              # MTProto server port (443)
        self.bus = bus                # shared event bus
        self.rd = None                # asyncio.StreamReader
        self.wr = None                # asyncio.StreamWriter
        self.buf = bytearray()        # receive buffer
        self.stop_ev = asyncio.Event()
        self.seq = 0                  # message sequence number
        self.pending = {}             # {msg_id: (Future, request_obj)}
        self.auth_key = None          # 256-byte shared key (post-DH)
        self.server_salt = b'\x00'*8  # 8-byte server salt
        self.session_id = secrets.token_bytes(8)
        self.auth_ready = asyncio.Event()
        self.qr_update_ev = asyncio.Event()  # signals QR login updates
        self._init_done = False       # has initConnection been sent?
        self._api_id = None
```

## Connection Lifecycle

### Boot (TCP Connect + Abridged Tag)

```python
async def boot(self):
    if self.rd and self.wr and not self.wr.is_closing():
        return  # already connected

    px = self.proxy_cfg()
    if px is not None:
        self.rd, self.wr = await self.open_via_proxy(px)
    else:
        self.rd, self.wr = await asyncio.open_connection(self.host, self.port)

    # Send transport abridged tag
    self.wr.write(b"\xee\xee\xee\xee")
    await self.wr.drain()
    self.wrote_tag = True
```

The 4-byte `0xEEEEEEEE` is Telegram's "intermediate" transport marker. It tells the server this client uses the length-prefixed framing format.

### Shutdown

```python
async def close(self):
    if self.wr:
        self.wr.close()
        await self.wr.wait_closed()
        self.wr = None
        self.rd = None
```

## Packet Framing: Intermediate Transport

MTProto uses **length-prefixed** framing via the `IntermediateTransport` class:

```python
class IntermediateTransport:
    def pack(self, payload: bytes) -> bytes:
        return len(payload).to_bytes(4, 'little') + payload
```

Every packet on the wire:
```
┌────────────────────┬──────────────────────┐
│ length (4 bytes LE)│     payload          │
└────────────────────┴──────────────────────┘
```

### Receive Buffer & Frame Splitting

```python
def cut(self) -> list[bytes]:
    out = []
    i = 0
    raw = bytes(self.buf)
    while i < len(raw):
        if i + 4 > len(raw):
            break
        ln = int.from_bytes(raw[i:i+4], 'little')
        i += 4
        if i + ln > len(raw):
            i -= 4  # incomplete frame — wait for more data
            break
        out.append(raw[i:i+ln])
        i += ln
    self.buf[:] = raw[i:]  # keep remainder
    return out
```

Frames are split on the Python side. The Rust extension provides `cut()` as an alternative but it's not used in the current code.

## Read Loop

```python
async def read_packet(self) -> bytes:
    while True:
        for p in self.cut():
            return p  # found a complete frame
        raw = await self.rd.read(65536)
        if not raw:
            self._log_socket_close()
            raise ConnectionError('mt socket closed')
        self.buf.extend(raw)
```

Reads up to 64KB per syscall, accumulates in buffer, splits frames when complete.

If the socket closes unexpectedly:
```python
def _log_socket_close(self):
    if self.buf:
        log.debug(f"[RX] Socket closed. Left in buffer: {self.buf.hex()}")
        if len(self.buf) >= 4:
            err = int.from_bytes(self.buf[:4], 'little', signed=True)
            log.debug(f"[RX] Possible Telegram int32 error: {err}")
```

## Unencrypted Messages (Pre-DH)

Before the DH key exchange completes, all messages are sent unencrypted:

```python
async def invoke_unencrypted(self, body: bytes) -> bytes:
    await self.boot()
    pkt = self.pack(MTMessage.unencrypted(self.msg_ids.next(), body))
    self.wr.write(pkt)
    await self.wr.drain()
    resp = await self.read_packet()
    return resp
```

Unencrypted message format:
```
auth_key_id: 0 (i64)
message_id: i64
message_length: i32
body: bytes
```

## Encrypted Messages (Post-DH)

After DH exchange, every message is encrypted with AES-256-IGE:

```python
async def send(self, obj, req_msg_id=None):
    await self.ensure_auth_key()  # blocks until DH complete

    body = self._build_body(act, obj)

    # Wrap with initConnection on first message
    if not self._init_done and self._api_id:
        body = self.codec.wrap_init(self._api_id, body)
        self._init_done = True

    # Build MTProto message
    msg_id = req_msg_id or self.msg_ids.next()
    self.seq += 1
    seq_no = self.seq * 2 - 1

    m = b''
    m += self.server_salt                  # 8 bytes
    m += self.session_id                   # 8 bytes
    m += msg_id.to_bytes(8, 'little', signed=True)  # 8 bytes
    m += seq_no.to_bytes(4, 'little', signed=True)  # 4 bytes
    m += len(body).to_bytes(4, 'little', signed=True) # 4 bytes
    m += body

    # Pad to 16-byte boundary + 12-27 random padding bytes
    pad = secrets.token_bytes((16 - (len(m) + 12) % 16) % 16 + 12)

    # Compute msg_key
    msg_key_large = sha256(self.auth_key[88:120] + m + pad).digest()
    msg_key = msg_key_large[8:24]  # middle 16 bytes

    # AES-256-IGE encrypt
    aes_key, aes_iv = kdf_msg(self.auth_key, msg_key, True)
    enc = bytes(rx.aes_ige_enc_raw(m + pad, aes_key, aes_iv))

    # Build final packet
    auth_key_id = sha1(self.auth_key).digest()[-8:]
    pkt = self.pack(auth_key_id + msg_key + enc)

    self.wr.write(pkt)
    await self.wr.drain()
```

## RPC Request-Response

All RPC calls go through `_rpc_call`:

```python
async def _rpc_call(self, act, **kw):
    fut = loop.create_future()
    req_msg_id = self.msg_ids.next()
    obj = {'act': act}
    obj.update({k: v for k, v in kw.items() if v is not None})
    self.pending[req_msg_id] = (fut, obj)
    await self.send(obj, req_msg_id=req_msg_id)
    return await asyncio.wait_for(fut, timeout=30.0)
```

Response matching:
1. Send message with `msg_id` 
2. Store `(Future, request_dict)` in `self.pending[msg_id]`
3. When encrypted response arrives, `_handle_encrypted_packet` extracts `rpc_result` (`0xf35c6d01`)
4. Response's `req_msg_id` is matched against `self.pending`
5. Future is resolved with parsed result

### Bad Server Salt Recovery

If the server sends `bad_server_salt` (`0xedab447b`):

```python
if cid == 0xedab447b:
    bad_msg_id = rm.i64()
    new_salt = int.from_bytes(rm.take(8), 'little', signed=False)
    self.server_salt = new_salt.to_bytes(8, 'little')
    self._init_done = False

    # Resend the original request
    entry = self.pending.pop(bad_msg_id, None)
    if entry is not None:
        fut, saved_obj = entry
        new_msg_id = self.msg_ids.next()
        self.pending[new_msg_id] = (fut, saved_obj)
        asyncio.create_task(self._resend(new_msg_id, saved_obj))
```

This updates the salt, marks `_init_done = False` to re-send `initConnection`, then automatically resends the original request with a new `msg_id`. Completely transparent to the caller.

## The Spin Loop (Encrypted Read)

```python
async def spin(self):
    await self.auth_ready.wait()  # block until DH exchange completes
    while not self.stop_ev.is_set():
        pkt = await self.read_packet()
        self._handle_encrypted_packet(pkt)
```

If `ConnectionError` is raised, all pending futures are failed and the error propagates upward (shutting down the MTProto task).

## Message ID Generation

```python
class MsgIdGen:
    def next(self):
        now = int(time.time())
        self.offset = self.offset + 4 if now == self.last_time else 0
        self.last_time = now
        return (now * (2**32)) + self.offset
```

Message IDs encode timestamp (high bits) and a monotonically increasing counter (low bits, increments by 4). This is the standard MTProto msg_id format — Telegram requires monotonically increasing IDs.
