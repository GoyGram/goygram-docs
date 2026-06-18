# Command System

GoyGram's command system uses the `command` filter class, which hooks into the regular `on_msg` handler pipeline. Commands are **not** a separate dispatch path — they are message handlers with a specialized filter.

## Registration

```python
@app.on_cmd("start", "help")
async def start_handler(msg):
    await msg.reply(f"Command: {msg.cmd}, args: {msg.args}")
```

`on_cmd(*names)` is a shortcut for:

```python
from goygram.filters import command as _cmd_filt
def on_cmd(self, *name: str):
    return self.on_msg(filt=_cmd_filt(*name))
```

This means command handlers are **regular message handlers** with a `command` filter applied. They fire in registration order alongside other `on_msg` handlers.

## The `command` Filter

```python
class command(Filter):
    def __init__(self, *cmds: str, prefixes=("/", "!"),
                 ignore_case=True, sep=" "):
```

- **`*cmds`** — Command names to match (case-insensitive by default)
- **`prefixes`** — Accepted command prefixes; default `("/", "!")`
- **`ignore_case`** — Normalize to lowercase before matching (default `True`)
- **`sep`** — Argument separator (default `" "`, space)

### How Matching Works

1. Strip whitespace from message text
2. Match the longest matching prefix from `prefixes`
3. Strip the prefix and `@username` suffix (so `/ping@MyBot` becomes `ping`)
4. Take the first word as the command name
5. Compare (case-insensitive by default) against registered names
6. On match: set `msg.cmd` (command name) and `msg.args` (remaining text)

```python
@app.on_cmd("ping")
async def ping(msg):
    assert msg.cmd == "ping"          # matched command name
    assert isinstance(msg.args, str)  # everything after the command
```

## Prefix Configuration

```python
# Default: / and ! prefixes
@app.on_cmd("ping")
# Matches: /ping, !ping

# Custom prefix
from goygram.filters import command
@app.on_msg(filt=command("ping", prefixes=(".",)))
# Matches: .ping

# Multiple custom prefixes
@app.on_msg(filt=command("ping", prefixes=("/", "!", ".", "#")))
# Matches: /ping, !ping, .ping, #ping
```

## Case Sensitivity

```python
# Default: case-insensitive
@app.on_cmd("start")
# Matches: /start, /START, /Start

# Case-sensitive
@app.on_msg(filt=command("start", ignore_case=False))
# Matches: /start only
```

## Argument Parsing

The `command` filter sets `msg.args` to everything after the command word and separator:

```
/ban 123456 reason spamming
→ cmd = "ban", args = "123456 reason spamming"

!echo hello world
→ cmd = "echo", args = "hello world"
```

Custom separator:

```python
@app.on_msg(filt=command("ban", sep=":"))
# /ban:123456 → cmd="ban", args="123456"
```

## @Username Suffix

The `@username` suffix is stripped before matching:

```
/ping@MyBot
→ base = "ping" (after stripping / and @MyBot)
→ matches "ping"
```

```
/start@AnotherBot
→ base = "start"
→ matches "start"
```

## Multiple Commands

```python
@app.on_cmd("start", "help", "info")
async def multi_cmd(msg):
    if msg.cmd == "start":
        await msg.reply("Welcome!")
    elif msg.cmd == "help":
        await msg.reply("Available commands: ...")
    elif msg.cmd == "info":
        await msg.reply("Bot info: ...")
```

All three commands fire the same handler. Check `msg.cmd` to distinguish.

## Dispatch Pipeline

Since commands are `on_msg` handlers with a filter, they run in the same pipeline:

```
Message arrives
    ↓
Disp.one() → kind="msg" → creates MsgObj
    ↓
hook (on_msg handlers) iterates in registration order
    ↓
├── text_handler (filters.text)
├── command_handler (filters.command("ping"))  ← matches here
├── catch_all (no filter)
    ↓
update_hook handlers fire
```

Key behavior:
- Command handlers are **not** separate from message handlers — they share the same hook list
- A single message can fire multiple command handlers if multiple match
- `StopPropagation` from any handler (message or command) stops the entire `hook` chain for that event

## Using `msg.cmd` and `msg.args`

After the `command` filter matches, the event object is mutated:

```python
@app.on_cmd("greet")
async def greet(msg):
    name = msg.args.strip() or "World"
    await msg.reply(f"Hello, {name}!")
```

```
/greet Sam
→ "Hello, Sam!"
```

## Custom Filters with Command

Combine `command` with any other filter:

```python
# Only respond to /ban in groups
@app.on_msg(filt=command("ban") & filters.group)
async def ban_group(msg): ...

# Rate-limit /start to once per minute
@app.on_msg(filt=command("start") & filters.cooldown(60))
async def throttled_start(msg): ...

# /admin only from specific users
@app.on_msg(filt=command("admin") & filters.from_any(OWNER_ID, ADMIN_ID))
async def admin_cmd(msg): ...
```

## No Bare Word Matching

The `command` filter requires a prefix (`/` or `!` by default). A bare word like `ping` will **not** match unless you configure `prefixes=("",)`:

```python
@app.on_msg(filt=command("ping", prefixes=("", "/", "!")))
async def ping(msg): ...
# Now matches: ping, /ping, !ping
```

## Error Isolation

Like all message handlers, command handler errors are caught per-handler and logged — a crashing command never kills the dispatcher or blocks other handlers.
