---
title: AppCfg BotCfg MtCfg
---

# AppCfg / BotCfg / MtCfg

The configuration model classes that wire GoyGram's split-brain transports together.

## AppCfg

```python
class AppCfg(BaseModel):
    model_config = ConfigDict(frozen=True)
    bot: BotCfg | None = None     # Bot API config (optional)
    mt: MtCfg | None = None       # MTProto config (optional)
    bus_max: int = 0              # Event queue max size (0=unlimited)
```

- **`frozen=True`**: Immutable after creation. No runtime config changes.
- **`bot=None`** + **`mt=None`**: At least one must be set. Both `None` means no transport — the app will fail at startup.
- **`bus_max=0`**: Default unlimited queue. Positive values apply backpressure.

## BotCfg

```python
class BotCfg(BaseModel):
    model_config = ConfigDict(frozen=True)
    token: str                    # Bot API token (required)
    timeout: int = 25             # getUpdates long-poll timeout
    base: str = "https://api.telegram.org"  # API base URL
```

- **`token`**: From @BotFather. Required — no default.
- **`timeout=25`**: The `getUpdates` timeout in seconds. Also used for HTTP request timeout (+10s buffer).
- **`base`**: Override for self-hosted Bot API servers or testing.

## MtCfg

```python
class MtCfg(BaseModel):
    model_config = ConfigDict(frozen=True)
    host: str                     # MTProto server hostname/IP
    port: int                     # MTProto port (typically 443)
    key: bytes | None = None      # Pre-existing auth key (rare)
    iv: bytes | None = None       # Pre-existing IV (rare)
```

- **`host`**: Resolved from `mt_host` parameter, auto-detected from DC map, or default `"149.154.167.50"`.
- **`port`**: Defaults to 443 when not specified.
- **`key`/`iv`**: For restoring existing sessions without going through full DH exchange. Rarely used directly.

## Construction Flow

In `GoyGram.__init__`:

```python
# 1. Bot config (simple)
bot = BotCfg(token=bot_token, timeout=bot_timeout, base=bot_base) \
      if bot_token is not None else None

# 2. MTProto config (DC resolution)
if bot is None and resolved_host is None:
    # Auto-detect DC
    dc_map = get_dynamic_dc_config()
    selected = pick_dc_endpoint(dc_map, preferred_dc=2)
    resolved_host, resolved_port = selected.host, selected.port

mt = MtCfg(host=resolved_host, port=resolved_port, key=mt_key, iv=mt_iv) \
     if resolved_host and resolved_port else None

# 3. Assemble
self.core = AppCore(AppCfg(bot=bot, mt=mt, bus_max=bus_max), ...)
```

## Dual-Transport Config

```python
# Both transports — the "split-brain" full config
app = GoyGram(
    bot_token="123:ABC",           # → BotCfg(token="123:ABC")
    api_id=123, api_hash="abc",    # → MtCfg(host=auto, port=443)
)
# Result: AppCfg(bot=BotCfg(...), mt=MtCfg(...))
```

## Config Immutability

The `frozen=True` config prevents accidental mutation:

```python
app.core.cfg.bot.timeout = 10  # ❌ raises ValidationError (frozen)
```

If you need to change config, create a new `GoyGram` instance.
