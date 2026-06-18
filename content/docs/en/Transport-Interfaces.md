---
title: Transport Interfaces
---

# Transport Interfaces

GoyGram abstracts two Telegram communication protocols behind a unified interface: **BotNet** (Bot API HTTP long polling) and **MTNet** (MTProto TCP with AES-IGE encryption).

## Architecture

```
┌─────────────────────────────────────────┐
│                AppCore                  │
│  ┌──────────────────────────────────┐   │
│  │  via() — transport selection     │   │
│  │  bot_req() / mt_req() — calls    │   │
│  └──────────┬──────────┬────────────┘   │
│             │          │                │
│      ┌──────▼──┐  ┌───▼──────┐         │
│      │ BotNet  │  │ MTNet   │          │
│      │ (HTTP)  │  │ (TCP)   │          │
│      └────┬────┘  └───┬─────┘          │
│           │           │                │
│     Bot API       MTProto              │
└─────────────────────────────────────────┘
```

## BotNet — Bot API Transport

HTTP long polling via `aiohttp`:

```python
class BotNet:
    def __init__(self, token: str, bus: Any, timeout: int = 25,
                 base: str = "https://api.telegram.org") -> None:
        self.token = token
        self.bus = bus
        self.timeout = timeout
        self.base = f"{base}/bot{token}"
```

Key methods:

| Method | Purpose |
|--------|---------|
| `req(method, data)` | Send a Bot API request, return `result` |
| `call(method, **kw)` | Convenience wrapper for `req()` |
| `send_msg(chat_id, text, **kw)` | Send a message via `sendMessage` |
| `del_msg(chat_id, msg_id)` | Delete a message via `deleteMessage` |
| `norm(upd)` | Normalize a raw update dict |
| `spin()` | Long-polling loop |

### Message Sending

```python
async def send_msg(self, chat_id, text, reply_to=None, kbd=None,
                   topic_id=None, link_preview_options=None, **kw):
    data = {"chat_id": chat_id, "text": text, **kw}
    if reply_to is not None:
        data["reply_parameters"] = {"message_id": reply_to}
    if kbd is not None:
        data["reply_markup"] = kbd.to_dict() if hasattr(kbd, "to_dict") else kbd
    if topic_id is not None:
        data["message_thread_id"] = topic_id
    opts = link_preview_options or kw.get("link_options")
    if opts is not None:
        data["link_preview_options"] = opts.to_dict() if hasattr(opts, "to_dict") else opts
    return await self.req("sendMessage", data)
```

### File Uploads

`BotNet` automatically detects file/binary content and switches from JSON to multipart form data:

```python
def has_file(self, v: Any) -> bool:
    if isinstance(v, (bytes, bytearray, memoryview)):
        return True
    if isinstance(v, tuple) and isinstance(v[1], (bytes, bytearray, memoryview)):
        return True
    # recursively checks lists and dicts
```

Files can be passed as raw `bytes`, file-like objects, or `(filename, data, mime_type)` tuples.

### Long Polling

```python
async def spin(self) -> None:
    while not self.stop_ev.is_set():
        res = await self.req("getUpdates", {
            "offset": self.off,
            "timeout": self.timeout,
            "allowed_updates": [
                "message", "edited_message", "callback_query",
                "poll", "chat_member", "my_chat_member"
            ],
        })
        for upd in res:
            uid = int(upd.get("update_id", 0))
            if uid >= self.off:
                self.off = uid + 1
            pkt = self.norm(upd)
            if pkt:
                await self.bus.push("bot", pkt)
```

Automatic webhook cleanup: if a 409 conflict occurs on `getUpdates`, GoyGram calls `deleteWebhook` and retries.

## MTNet — MTProto Transport

TCP connection with AES-IGE encryption, full MTProto 2.0 handshake, and proxy support:

```python
class MTNet:
    def __init__(self, host: str, port: int, bus: Any,
                 key: bytes | None = None, iv: bytes | None = None,
                 *, proxy: str | None = None, ...) -> None:
```

Key methods:

| Method | Purpose |
|--------|---------|
| `send(obj)` | Encrypt and send an MTProto request |
| `_rpc_call(act, **kw)` | Make an RPC call with Future correlation |
| `call(act, **kw)` | High-level RPC call with 2FA support |
| `send_msg(chat_id, text, **kw)` | Send a message |
| `del_msg(chat_id, msg_id)` | Delete a message |
| `spin()` | Receive loop for encrypted packets |
| `ensure_auth_key()` | Complete DH key exchange |

### Proxy Support

MTNet supports SOCKS5 and HTTP CONNECT proxies through environment variables or explicit configuration:

```python
def proxy_cfg(self) -> ProxyCfg | None:
    raw = self.proxy_url or os.getenv("ALL_PROXY") or \
          os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY")
    if not raw:
        return None
    p = urllib.parse.urlparse(raw)
    # Parse and return ProxyCfg(scheme, host, port, user, pwd)
```

## via() — Transport Selection

`AppCore.via()` determines the transport based on `chat_id` prefix or explicit `via` parameter:

```python
def via(self, chat_id: int | str, via: str | None = None) -> str:
    if via in {"bot", "mt"}:
        return via
    if isinstance(chat_id, str):
        if chat_id.startswith("bot:"): return "bot"
        if chat_id.startswith("mt:"):  return "mt"
    if self.bot is not None: return "bot"
    if self.mt is not None:  return "mt"
    raise RuntimeError("no transport configured")
```

Chat ID prefixes:
- `bot:123456789` → routes through BotNet
- `mt:123456789` → routes through MTNet
- Bare integer → defaults to available transport (BotNet first, then MTNet)

## raw_chat() — ID Normalization

Strips the transport prefix from chat IDs:

```python
def raw_chat(self, chat_id: int | str) -> int | str:
    if isinstance(chat_id, str) and ":" in chat_id:
        pfx, raw = chat_id.split(":", 1)
        if pfx in {"bot", "mt"}:
            if raw.lstrip("-").isdigit():
                return int(raw)
            return raw
    return chat_id
```

## MsgObj.reply() — Transport-Agnostic Reply

`MsgObj.reply()` routes through the correct transport automatically based on `self.src`:

```python
async def reply(self, txt, kbd=None, topic_id=None,
                link_options=None, **kw):
    if self.src == "bot" and self.app.bot is not None:
        # Build reply_parameters, reply_markup, etc.
        return await self.app.bot_req("sendMessage",
            chat_id=self.chat_id, text=txt, ...)
    if self.app.mt is not None:
        # Resolve peer, build MTProto-specific fields
        return await self.app.mt_req("messages.sendMessage",
            peer=peer, message=txt, random_id=..., ...)
    return None
```

`self.src` is preserved from the original packet (`"bot"` or `"mt"`), so replies automatically go through the same channel that delivered the message.
