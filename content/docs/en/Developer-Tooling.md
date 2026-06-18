# Developer Tooling

Built-in introspection tools for exploring GoyGram's API surface.

## `app.help()` / `print_methods(app)`

Prints a developer overview to console:

```
=== GoyGram Developer Help ===
• Dynamic methods:
  - app.sendDocument(...), app.getChat(...), app.getUpdates(...)
  - app.mt_<method>(...) for MTProto actions, e.g. app.mt_messages_get_dialogs(...)
• Built-in shortcuts:
  - send_message(chat_id, text, ...)
  - send_photo, send_document, send_poll, etc.
  - edit_text(chat_id, msg_id, text, ...)
  - del_msg(chat_id, msg_id, ...)
  - answer_cb(cb_id, text=None, ...)
  - help()
• Filters:
  - text: Message has text
  - me: Event from current account/bot
  - Combine with &, |, ~ (Filter operators)
```

## `dir(app)`

Shows all available methods, including dynamic entries:

```python
>>> dir(app)
['answer_cb', 'ban_chat_member', 'close', 'create_topic', 
 'del_msg', 'delete_webhook', 'edit_text', 'get_chat',
 'get_admins', 'get_webhook_info', 'help', 'html', 'md',
 'mt_messages_get_dialogs', 'mt_users_get_full_user', 'on_cb', 'on_cmd', 'on_member',
 'on_msg', 'on_poll', 'run', 'send_document', 'send_message',
 'send_photo', 'set_webhook', 'stop', ...]
```

The `__dir__` augmentation adds common dynamic methods:

```python
def __dir__(self):
    base = set(super().__dir__())
    base.update({"help", "sendDocument", "getChat",
                  "getUpdates", "mt_messages_get_dialogs"})
    return sorted(base)
```

## Inspecting the Core

```python
# Access internal components
app.core           # AppCore instance
app.core.bus       # Event bus (asyncio.Queue)
app.core.bot       # BotNet instance (if configured)
app.core.mt        # MTNet instance (if configured)
app.core.self_id   # Current account's user ID
app.core.api_id    # API ID

# Check transport status
print(app.core.bot is not None)  # Bot API enabled?
print(app.core.mt is not None)   # MTProto enabled?
```

## Runtime Inspection

```python
# List registered handlers
print(len(app.core.hook))      # message handlers
print(len(app.core.cmd_hook))  # command handlers
print(len(app.core.cb_hook))   # callback handlers

# Check handler function names
for fn in app.core.cmd_hook:
    print(fn.__name__)
```

## Signature Inspection

```python
import inspect

# See method signatures
sig = inspect.signature(app.bot.send_msg)
print(sig)  # (chat_id, text, reply_to=None, kbd=None, ...)
```

## Event Bus Monitoring

The internal `asyncio.Queue` (`app.core.bus.q`) carries all events before they reach handlers. You can tap into it for debugging:

```python
# Monitor raw events flowing through the bus
async def monitor_bus(app, duration=10):
    start = asyncio.get_event_loop().time()
    counts = {"msg": 0, "cb": 0, "poll": 0, "member": 0, "err": 0}
    while asyncio.get_event_loop().time() - start < duration:
        try:
            pkt = await asyncio.wait_for(app.core.bus.fetch(), timeout=1.0)
            kind = pkt.get("data", {}).get("kind", "unknown")
            counts[kind] = counts.get(kind, 0) + 1
        except asyncio.TimeoutError:
            pass
    print(f"Events in {duration}s: {counts}")

# Run alongside your app:
# asyncio.create_task(monitor_bus(app))
```

## Handler Profiling

Wrap handlers to measure execution time:

```python
import time

original = app.core.hook.copy()
app.core.hook.clear()

for fn in original:
    async def profiled(msg, _fn=fn):
        t0 = time.monotonic()
        try:
            return await _fn(msg)
        finally:
            elapsed = time.monotonic() - t0
            if elapsed > 0.1:  # slow handler alert
                print(f"SLOW: {_fn.__name__} took {elapsed:.3f}s")
    app.core.hook.append(profiled)
```

## MTProto Connection State

Inspect the low-level MTProto connection:

```python
mt = app.core.mt
print(f"Connected: {mt.rd is not None and not mt.wr.is_closing()}")
print(f"Auth ready: {mt.auth_ready.is_set()}")
print(f"Auth key: {'present' if mt.auth_key else 'missing'} ({len(mt.auth_key) if mt.auth_key else 0} bytes)")
print(f"Server salt: {mt.server_salt.hex() if mt.server_salt else 'none'}")
print(f"Session ID: {mt.session_id.hex()}")
print(f"Pending RPC: {len(mt.pending)}")
print(f"Buffer size: {len(mt.buf)} bytes")
print(f"Init done: {mt._init_done}")

# List pending RPC calls
for msg_id, (fut, obj) in mt.pending.items():
    print(f"  msg_id={msg_id} act={obj.get('act')} done={fut.done()}")
```

## Type Checking with mypy

GoyGram event objects use `__slots__` with type annotations. Run mypy to catch handler errors:

```python
# typed_bot.py
from goygram import GoyGram
from goygram.types.msg import MsgObj

app = GoyGram(bot_token="...")

@app.on_msg()
async def handler(msg: MsgObj) -> None:
    text: str = msg.text  # mypy knows msg.text is str
    chat_id = msg.chat_id  # mypy knows this is int | str | None
    await msg.reply(text)
```

```bash
mypy typed_bot.py
```

## AST-Level Handler Inspection

```python
import ast, inspect

src = inspect.getsource(handler)
tree = ast.parse(src)

# Find all msg.reply() calls
for node in ast.walk(tree):
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        if node.func.attr == 'reply':
            print(f"Found reply() call at line {node.lineno}")
```
