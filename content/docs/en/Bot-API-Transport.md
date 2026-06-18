---
title: "Bot API Transport"
---

# Bot API Transport

The Bot API transport (`goygram/vendor/botapi.py`) implements Telegram's HTTPS Bot API using `aiohttp` with long-polling `getUpdates`.

## Architecture

```python
class BotNet:
    def __init__(self, token, bus, timeout=25, base="https://api.telegram.org"):
        self.token = token
        self.bus = bus                 # shared event bus
        self.timeout = timeout         # getUpdates timeout (seconds)
        self.base = f"{base}/bot{token}"  # API base URL
        self.sess = None               # aiohttp.ClientSession (lazy)
        self.off = 0                   # update_id offset
        self.stop_ev = asyncio.Event()
```

## Connection Lifecycle

### Boot

```python
async def boot(self):
    if self.sess and not self.sess.closed:
        return  # already connected
    mod = self.mod()
    self.sess = mod.ClientSession(
        timeout=mod.ClientTimeout(total=self.timeout + 10),
        trust_env=True,
    )
```

Creates an `aiohttp.ClientSession` with:
- Total timeout: `self.timeout + 10` (default 35s)
- `trust_env=True`: respects HTTP_PROXY/HTTPS_PROXY environment variables

### Connection Reuse

The session is created once and reused. All API calls share the same TCP connection pool (HTTP keep-alive).

### Shutdown

```python
async def close(self):
    self.stop_ev.set()
    if self.sess and not self.sess.closed:
        await self.sess.close()
```

## Long Polling Loop

```python
async def spin(self):
    await self.boot()
    while not self.stop_ev.is_set():
        res = await self.req("getUpdates", {
            "offset": self.off,
            "timeout": self.timeout,  # 25s long-poll
            "allowed_updates": [
                "message", "edited_message", "callback_query",
                "poll", "chat_member", "my_chat_member"
            ],
        })
        for upd in res:
            uid = int(upd.get("update_id", 0))
            if uid >= self.off:
                self.off = uid + 1   # advance offset
            pkt = self.norm(upd)     # normalize to event dict
            if pkt:
                await self.bus.push("bot", pkt)
```

### Webhook Conflict Handling

If the server returns HTTP 409 on `getUpdates` (webhook is active):

```python
if r.status == 409 and m == "getUpdates":
    await self.req("deleteWebhook", {"drop_pending_updates": False})
    self.log.error("Webhook conflict detected. Webhook deleted and polling will retry.")
    return []
```

GoyGram **automatically deletes** any conflicting webhook and resumes polling. This is aggressive — it will kill any existing webhook setup without asking.

## Request Handling

### JSON Requests (no files)

```python
def body(self, data):
    if not self.has_file(data):
        return {"json": data}  # application/json
    # ... multipart form data for files
```

### File Upload (multipart/form-data)

Files are detected recursively through the payload dict. Any `bytes`, `bytearray`, `memoryview`, or `(filename, data, content_type)` tuple triggers multipart encoding:

```python
def has_file(self, v):
    if isinstance(v, (bytes, bytearray, memoryview)):
        return True
    if isinstance(v, tuple) and len(v) >= 2 and isinstance(v[1], (bytes, bytearray, memoryview)):
        return True
    if isinstance(v, list):
        return any(self.has_file(x) for x in v)
    if isinstance(v, dict):
        return any(self.has_file(x) for x in v.values())
    return False
```

File fields are added to `aiohttp.FormData`:

```python
def add_form(self, form, k, v):
    if isinstance(v, tuple) and len(v) >= 2:
        # (filename, data, content_type) or (filename, data)
        form.add_field(k, bytes(v[1]), filename=str(v[0]),
                       content_type=v[2] if len(v) > 2 else "application/octet-stream")
    elif isinstance(v, (bytes, bytearray, memoryview)):
        form.add_field(k, bytes(v), filename=f"{k}.bin",
                       content_type="application/octet-stream")
    elif isinstance(v, (dict, list)):
        form.add_field(k, json.dumps(v, ensure_ascii=False))
    elif isinstance(v, bool):
        form.add_field(k, "true" if v else "false")
    else:
        form.add_field(k, str(v))
```

## Event Normalization

The `norm()` method converts raw Bot API update dicts to normalized event dicts:

### Messages
```python
msg = upd.get("message") or upd.get("edited_message")
# → {"kind": "msg", "src": "bot", "msg_id": ..., "chat_id": ..., ...}
```

### Callback Queries
```python
cb = upd.get("callback_query")
# → {"kind": "cb", "src": "bot", "query_id": ..., "data": ..., ...}
```

### Polls
```python
poll = upd.get("poll")
# → {"kind": "poll", "src": "bot", "poll_id": ..., "question": ..., ...}
```

### Chat Member Updates
```python
mem = upd.get("chat_member") or upd.get("my_chat_member")
# → {"kind": "member", "src": "bot", "chat_id": ..., "old_status": ..., "new_status": ...}
```

## Error Handling

```python
async def req(self, m, data=None):
    async with self.sess.post(f"{self.base}/{m}", **body) as r:
        raw = await r.json(content_type=None)
    if r.status >= 400:
        raise RuntimeError(f"botapi {m} http {r.status}: {raw}")
    if not raw.get("ok"):
        raise RuntimeError(f"botapi {m} fail: {raw}")
    return raw["result"]
```

Note: `content_type=None` is passed to `r.json()` to handle Telegram's occasional non-standard Content-Type headers.

All errors raise `RuntimeError` — there's no typed exception hierarchy. The caller must catch and inspect.
