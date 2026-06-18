---
title: MTProto Raw Calls
---

# MTProto Raw Calls

MTProto calls use the `mt_` prefix and flow through `MTNet._rpc_call()`. The system follows a request-response pattern with `asyncio.Future`-based correlation.

## The mt_ Prefix

Any method accessed via `app.mt_*` is routed to the MTProto transport through `AppCore.__getattr__`. The `mt_` prefix is stripped and the name is converted to dotted CamelCase via `_mt_method_name()`:

```python
# Examples of working MTProto calls:
await app.mt_messages_get_dialogs(limit=50)
await app.mt_messages_get_history(chat_id=123, limit=100)
await app.mt_messages_send_reaction(chat_id=456, msg_id=789, reaction="👍")
await app.mt_channels_join_channel(chat_id=-1001234567890)
```

There are no pre-built method wrappers — every MTProto call goes through `__getattr__` → `_dynamic_method` → `_mt_method_name` → `mt_req`.

Usage:

```python
await app.mt_messages_get_dialogs(limit=50)
await app.mt_messages_get_history(chat_id=123, limit=100)
await app.mt_messages_send_reaction(chat_id=456, msg_id=789, reaction="👍")
await app.mt_channels_join_channel(chat_id=-1001234567890)
```

## _rpc_call() — The Core

The heart of MTProto communication:

```python
async def _rpc_call(self, act: str, **kw: Any) -> dict[str, Any]:
    loop = asyncio.get_running_loop()
    fut: asyncio.Future[dict[str, Any]] = loop.create_future()
    req_msg_id = self.msg_ids.next()
    obj = {'act': act}
    obj.update({k: v for k, v in kw.items() if v is not None})
    self.pending[req_msg_id] = (fut, obj)
    await self.send(obj, req_msg_id=req_msg_id)
    return await asyncio.wait_for(fut, timeout=30.0)
```

The mechanism:

1. An `asyncio.Future` is created to await the response
2. A monotonic `msg_id` is generated via `MsgIdGen`
3. The request `(future, raw_object)` is stored in `self.pending`
4. `self.send()` encrypts with AES-IGE and transmits over TCP
5. The caller awaits with `asyncio.wait_for(fut, timeout=30.0)` — a 30-second timeout

## Pending Dict and Response Correlation

```python
self.pending: dict[int, tuple[asyncio.Future[dict[str, Any]], dict[str, Any]]] = {}
```

Responses arrive asynchronously in `_handle_encrypted_packet()`. When an `rpc_result` (constructor ID `0xf35c6d01`) is received, the `req_msg_id` is extracted and the corresponding `Future` in `pending` is resolved:

```python
if cid == 0xf35c6d01:
    req_msg_id = rm.i64()
    result = inner[12:]
    entry = self.pending.pop(req_msg_id, None)
    fut = entry[0] if isinstance(entry, tuple) else entry
    if fut and not fut.done():
        parsed = self._parse_rpc_result(result)
        fut.set_result(parsed)
```

## 30-Second Timeout

If no response arrives within 30 seconds, `asyncio.wait_for` raises `TimeoutError`, and the pending entry is cleaned up:

```python
except asyncio.TimeoutError:
    self.pending.pop(req_msg_id, None)
    raise TimeoutError(
        f'no response for act={act} msg_id={req_msg_id}'
    )
```

## Server Salt Handling

When a `bad_server_salt` (constructor `0xedab447b`) is received, the session automatically re-sends the request with the updated salt:

```python
if cid == 0xedab447b:
    bad_msg_id = rm.i64()
    new_salt = int.from_bytes(rm.take(8), 'little', signed=False)
    self.server_salt = new_salt.to_bytes(8, 'little')
    self._init_done = False
    entry = self.pending.pop(bad_msg_id, None)
    if entry is not None:
        fut, saved_obj = entry
        if not fut.done():
            new_msg_id = self.msg_ids.next()
            self.pending[new_msg_id] = (fut, saved_obj)
            asyncio.create_task(self._resend(new_msg_id, saved_obj))
```

## 2FA Password Flow

GoyGram supports SRP-based 2FA authentication. `_auth_check_password_flow` in `security.py` orchestrates the three-step process:

```python
async def _auth_check_password_flow(self, password: str, api_id: int) -> dict[str, Any]:
    # Step 1: Get password parameters
    state = await self._rpc_call('account_get_password', api_id=api_id)
    # Step 2: Compute SRP challenge
    srp_id, a_pub, m1 = _compute_password_check(state, password)
    # Step 3: Submit challenge
    return await self._rpc_call(
        'auth_check_password_srp',
        srp_id=srp_id, A=a_pub, M1=m1, api_id=api_id
    )
```

The SRP computation (`_compute_password_check`) implements the full Telegram SRP protocol with SHA-256, PBKDF2-HMAC-SHA-512 (100,000 iterations), and 2048-bit modular arithmetic.

## DC Migration Retry

`_mt_req_with_migrate` in `security.py` handles `PHONE_MIGRATE_X` and `NETWORK_MIGRATE_X` errors, automatically reconnecting to the correct data center:

```python
async def _mt_req_with_migrate(app, act, **kw):
    while True:
        res = await app.mt_req(act, **kw)
        err = _extract_error(res) or ""
        dc_id = _extract_migrate_dc(err)
        if dc_id is None:
            return res
        # Switch to the new DC
        endpoint = pick_dc_endpoint(dc_map, preferred_dc=dc_id)
        await app.mt.close()
        app.mt.host = endpoint.host
        app.mt.port = endpoint.port
        app.mt.auth_key = None
        app.mt._init_done = False
        app.mt.session_id = secrets.token_bytes(8)
        await app.mt.boot()
        await app.mt.ensure_auth_key()
```

## Message Body Construction

`_build_body` normalizes the action name via `_norm_act()` (snake_case → dotted CamelCase) and delegates to the Rust extension for TL serialization:

```python
def _build_body(self, act: str, obj: dict[str, Any]) -> bytes:
    data = {}
    for k, v in obj.items():
        if k == 'act' or v is None:
            continue
        if isinstance(v, (bytes, bytearray)):
            data[k] = v.hex()
        elif isinstance(v, memoryview):
            data[k] = bytes(v).hex()
        else:
            data[k] = v
    tl_name = self._norm_act(act)
    return bytes(_ext.serialize_method(tl_name, json.dumps(data)))
```

The Rust extension resolves the TL method name against its loaded schema and serializes the arguments to binary TL format. `_norm_act()` converts names like `messages_send_message` → `messages.sendMessage`.

Peer resolution (`_resolve_peer`) converts chat/user/channel IDs to their TL `InputPeer*` representations.
