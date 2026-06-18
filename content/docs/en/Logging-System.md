# Logging System

GoyGram uses Python's built-in `logging` module with a single environment variable for configuration.

## Configuration

```bash
# Set log level via environment variable
GOYGRAM_LOG=DEBUG python app.py    # verbose
GOYGRAM_LOG=INFO python app.py     # default
GOYGRAM_LOG=WARNING python app.py  # quiet  
GOYGRAM_LOG=ERROR python app.py    # errors only
```

## Logger Hierarchy

| Logger Name | Component |
|-------------|-----------|
| `goygram.app` | `AppCore` — startup, shutdown, transport status |
| `goygram.botapi` | `BotNet` — HTTP requests, polling errors |
| `goygram.mtproto` | `MTNet` — TCP connections, crypto, packet debug |
| `goygram.disp` | `Disp` — handler errors |
| `goygram.security` | `security` module — vault operations, auth flow |
| `goygram.dc` | `GoyGram.__init__` — DC routing decisions |

## Format

```
2026-05-21 18:45:12,345 | INFO | goygram.app | Starting GoyGram core.
2026-05-21 18:45:12,456 | INFO | goygram.app | Bot transport is enabled.
2026-05-21 18:45:12,567 | INFO | goygram.app | MT transport is enabled.
2026-05-21 18:45:12,678 | INFO | goygram.security | Vault default.vault detected. Session restored.
```

Format: `%(asctime)s | %(levelname)s | %(name)s | %(message)s`

## Implementation

```python
def get_logger(name="goygram"):
    level_name = os.getenv("GOYGRAM_LOG", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(level=level, format=...)
    logger = logging.getLogger(name)
    logger.setLevel(level)
    return logger
```

`basicConfig` is called every time `get_logger` is called, but `logging.basicConfig` is a no-op after the first call — only the first logger's configuration takes effect.

## Debug Packet Logging

When `GOYGRAM_LOG=DEBUG`, MTProto logs every packet:

```
[TX] >>> 4500000014...  (hex dump of outgoing encrypted packet)
[RX] <<< 5000000020...  (hex dump of incoming encrypted packet)
```

This is extremely verbose — a single `getUpdates` cycle produces hundreds of lines. Use sparingly.

## Error Logging

The dispatcher logs handler failures:

```python
for fn in list(self.app.hook):
    try:
        await fn(msg)
    except Exception as e:
        self.log.error("Handler failure: %r", e)
```

Transport errors are also logged:

```python
# BotNet
self.log.error("Polling error: %r", e)

# MTNet  
log.warning("bad_server_salt handler error: %r", exc)
log.warning("Vault %s decrypt failed (%r)", path.name, e)
```

## Programmatic Access

Standard Python logging — you can add handlers, filters, formatters:

```python
import logging

# Add file handler
fh = logging.FileHandler("goygram.log")
fh.setLevel(logging.DEBUG)
logging.getLogger("goygram").addHandler(fh)

# Add custom handler
logging.getLogger("goygram.mtproto").addHandler(my_handler)
```
