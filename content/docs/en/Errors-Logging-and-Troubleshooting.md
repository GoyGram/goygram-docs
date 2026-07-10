# Errors, Logging, and Troubleshooting

GoyGram exposes Telegram and transport exceptions from `goygram.errors`, including `GoyError`, `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `FloodWait`, `ServerError`, `NetworkError`, `MTProtoError`, `TLSerializationError`, and `TLDeserializationError`.

```python
from goygram.errors import FloodWait

try:
    await app.send_message(chat_id=123, text="Hello")
except FloodWait as exc:
    await asyncio.sleep(exc.retry_after or 1)
```

## Common checks

- Confirm the installed package version and import path after upgrading.
- Keep only one Bot API poller active; GoyGram clears an existing webhook before it polls.
- For MTProto, make sure `api_id` and `api_hash` belong to the account/application and that the vault file is writable.
- If a userbot does not receive commands, verify the process is still running, use an outgoing command with `filters.me` when appropriate, and inspect the complete startup log.
- Do not share vault files, tokens, login codes, API hashes, or cloud passwords in logs or issues.

GoyGram uses Python logging. Configure the standard `logging` module in your application if you need different levels or destinations.
