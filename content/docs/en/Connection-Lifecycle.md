---
title: Connection Lifecycle
---

# Connection Lifecycle

How GoyGram establishes, maintains, and tears down network connections for both transports.

## Bot API Lifecycle

```
app.run()
  │
  ├─ create_task(bot.spin())
  │     │
  │     ├─ bot.boot()
  │     │    └─ aiohttp.ClientSession(timeout=35s, trust_env=True)
  │     │
  │     ├─ delete_webhook(drop_pending_updates=False)  # clear conflicts
  │     │
  │     └─ while not stop_ev:
  │           └─ getUpdates(offset=off, timeout=25s)
  │                └─ for each update: norm() → bus.push("bot", data)
  │
  └─ await stop_ev.wait()  # blocks until stop() called
       │
       └─ close()
            ├─ bot.close() → sess.close()
            └─ disp.close() → stop_ev.set()
```

### Connection Reuse

The `aiohttp.ClientSession` is created once in `boot()` and reused. `trust_env=True` means `HTTP_PROXY`/`HTTPS_PROXY` env vars are respected for HTTP connections.

### Timeout

- HTTP request timeout: `self.timeout + 10` (default 35s)
- `getUpdates` long-poll timeout: `self.timeout` (default 25s)

### Reconnection

If the HTTP connection drops, `aiohttp` transparently creates a new TCP connection on the next request. The session object handles connection pooling.

## MTProto Lifecycle

```
app.run()
  │
  ├─ create_task(mt.spin())
  │     │
  │     ├─ await auth_ready.wait()  # block until DH completes
  │     │
  │     └─ while not stop_ev:
  │           ├─ read_packet()      # TCP read (blocks)
  │           └─ _handle_encrypted_packet()
  │
  └─ bootstrap_session()
       │
       ├─ if vault exists:
       │    ├─ decrypt vault → restore auth_key, DC
       │    ├─ mt.boot()           # TCP connect
       │    ├─ mt.ensure_auth_key() # if no key, DH exchange
       │    └─ auth_ready.set()
       │
       └─ if no vault:
            └─ interactive auth → save vault → auth_ready.set()
```

### TCP Connection

```python
async def boot(self):
    if self.rd and self.wr and not self.wr.is_closing():
        return  # already connected

    px = self.proxy_cfg()
    if px is not None:
        self.rd, self.wr = await self.open_via_proxy(px)
    else:
        self.rd, self.wr = await asyncio.open_connection(self.host, self.port)

    # Send transport tag
    self.wr.write(b"\xee\xee\xee\xee")
    await self.wr.drain()
```

The connection is persistent — one TCP socket for the entire session lifetime. If the connection drops:

1. `read_packet()` detects empty read → `ConnectionError('mt socket closed')`
2. All pending futures are failed with the exception
3. `spin()` exits with the exception
4. The asyncio task terminates
5. **No automatic reconnection** — the app must be restarted

### DC Migration

During auth, DC migration triggers a full reconnect to a different IP. See [DC Routing System](DC-Routing-System).

### Shutdown

```python
async def close(self):
    if self.wr:
        self.wr.close()
        await self.wr.wait_closed()
        self.wr = None
        self.rd = None
```

## Graceful Shutdown

```
stop() called (or KeyboardInterrupt)
  │
  ├─ stop_ev.set()
  │
  ├─ disp.consume() exits while loop
  ├─ bot.spin() exits while loop
  ├─ mt.spin() exits while loop (if not already dead)
  │
  └─ close()
       ├─ bot.close() → close HTTP session
       ├─ mt.close() → close TCP socket
       └─ cancel all tasks → gather with return_exceptions=True
```

## Signal Handling (Fast Exit)

```python
signal.signal(signal.SIGINT, _instant_exit)
signal.signal(signal.SIGTERM, _instant_exit)

def _instant_exit(signum, frame):
    os._exit(0)  # immediate process death
```

This bypasses the graceful shutdown entirely. The `finally` block in `run()` still executes for `stop_ev`-based shutdown, but Ctrl+C goes straight to `_exit`.
