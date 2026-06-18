# Multi-Session Architecture

GoyGram supports running multiple independent MTProto sessions from the same codebase, each with its own vault file, authentication, and connection. No session-sharing, no shared state — clean isolation.

## Named Sessions

```python
app1 = GoyGram(
    api_id=API_ID, api_hash=API_HASH,
    session_name="account_1"
)

app2 = GoyGram(
    api_id=API_ID, api_hash=API_HASH,
    session_name="account_2"
)
```

Each session gets its own vault file:
- `account_1.vault` (encrypted)
- `account_2.vault` (encrypted)

## How Isolation Works

### Separate Files

The `session_name` parameter controls the vault filename:

```python
vault = Path(f"{session_name}.vault")
```

Changing `session_name` changes the file — that's the entire isolation mechanism. Each instance reads/writes a different vault.

### Separate Key Derivation

The vault key includes `session_name` in the derivation material:

```python
material = f"{_get_machine_id()}:{session_name}".encode()
key = hashlib.pbkdf2_hmac("sha256", material, salt, 600000, dklen=32)
```

Different session names → different keys → different encrypted blobs. Even if two vaults are on the same machine, knowing one key doesn't help with the other.

### Separate Connections

Each `GoyGram` instance creates its own `AppCore` → `MTNet` → TCP socket. No resource sharing:
- Separate TCP connections
- Separate DH key exchanges
- Separate auth keys
- Separate sequence numbers
- Separate message IDs

### Separate Event Loops

If you run them in the same process, they share the event loop but have separate asyncio tasks:

```python
import asyncio

async def main():
    app1 = GoyGram(api_id=..., api_hash=..., session_name="acc1")
    app2 = GoyGram(api_id=..., api_hash=..., session_name="acc2")

    @app1.on_msg(filt=filters.text)
    async def handler1(msg): ...

    @app2.on_msg(filt=filters.text)
    async def handler2(msg): ...

    await asyncio.gather(app1.run(), app2.run())
```

### Separate self_id

Each instance tracks its own user ID:

```python
app.self_id = uid
app.mt.self_id = uid
```

The `filters.me` filter uses `app.self_id` to determine if a message is "from me" — so `filters.me` correctly identifies messages from the correct account in each instance.

## Practical Multi-Session Patterns

### Farm Worker Pool

```python
workers = []
for i in range(5):
    app = GoyGram(
        api_id=API_ID, api_hash=API_HASH,
        session_name=f"worker_{i}"
    )

    @app.on_cmd(".ping")
    async def ping_handler(msg):
        await msg.reply(f"Worker {i} alive")

    workers.append(app)

await asyncio.gather(*[w.run() for w in workers])
```

### Bot + User Combo

```python
bot = GoyGram(bot_token="123:ABC")
user = GoyGram(api_id=123, api_hash="abc", session_name="user")

await asyncio.gather(bot.run(), user.run())
```

## Limitations

- **Same API credentials**: All sessions share the same `api_id`/`api_hash` in the constructor. The vault stores them per-session, but you can't use different credentials for different sessions without separate `GoyGram` constructor calls.
- **No session pooling**: Each session is an independent `GoyGram` instance. There's no built-in session pool or factory.
- **Process memory**: Each session consumes ~10-50MB of memory (Python objects + Rust extension + TCP buffers). At ~50 sessions, you'll feel it.
- **No cross-session state**: Sessions can't directly access each other's handlers or state. If you need coordination, use an external queue or shared state variable (with appropriate locking).
