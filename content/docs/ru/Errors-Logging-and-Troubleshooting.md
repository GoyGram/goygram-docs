---
title: "Errors Logging and Troubleshooting"
---

# Errors, Logging, and Troubleshooting

GoyGram exposes exceptions from `goygram.errors`, including `GoyGramError`, `TransportError`, `ConnectionClosedError`, `ProxyError`, `RPCError`, `FloodWaitError`, `AuthError`, `CodecError`, and `RustExtError`, plus Telegram-specific RPC subclasses.


```python
import asyncio
from goygram.errors import FloodWaitError

try:
    await app.send_message(chat_id=123, text="Hello")
except FloodWaitError as exc:
    await asyncio.sleep(exc.seconds)
```


## Common checks

- Confirm the installed package version and import path after upgrading.
- Keep only one Bot API poller active; GoyGram clears an existing webhook before it polls.
- For MTProto, make sure `api_id` and `api_hash` belong to the account/application and that the vault file is writable.
- If a userbot does not receive commands, verify the process is still running, use an outgoing command with `filters.me` when appropriate, and inspect the complete startup log.
- Do not share vault files, tokens, login codes, API hashes, or cloud passwords in logs or issues.

GoyGram uses Python logging. Configure the standard `logging` module in your application if you need different levels or destinations.