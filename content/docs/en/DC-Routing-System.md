---
title: DC Routing System
---

# DC Routing System

GoyGram's DC (Data Center) routing is **dynamic at startup** with a hardcoded fallback map. Telegram has 5 production DCs — the framework determines which one to connect to based on configuration and runtime conditions.

## DC Endpoint Map

Hardcoded in `goygram/dc_fetcher.py`:

```python
def get_dynamic_dc_config(timeout=6):
    by_dc = {
        1: [DcEndpoint(dc_id=1, host="149.154.175.53", port=443)],
        2: [DcEndpoint(dc_id=2, host="149.154.167.50", port=443)],
        3: [DcEndpoint(dc_id=3, host="149.154.175.100", port=443)],
        4: [DcEndpoint(dc_id=4, host="149.154.167.91", port=443)],
        5: [DcEndpoint(dc_id=5, host="91.108.56.130", port=443)],
    }
    by_dc[0] = by_dc[2]  # DC 0 is an alias for DC 2
    return by_dc
```

Despite the function name saying "dynamic," the current implementation uses hardcoded IPs. The `timeout` parameter is accepted but unused — the function signature exists for future dynamic fetching from `https://google.com` (a common Telegram DC discovery technique) or the Telegram DC config endpoint.

## DC Selection on Startup

In `GoyGram.__init__`:

```python
if bot is None and resolved_host is None:
    # No explicit MTProto host configured — auto-select
    dc_map = get_dynamic_dc_config()
    selected = pick_dc_endpoint(dc_map, preferred_dc=2)  # default to DC 2
    resolved_host = selected.host
    resolved_port = selected.port
```

**DC 2 is the default** because it's the entry point for most regions. You can override with `mt_host`:

```python
app = GoyGram(api_id=123, api_hash="abc", mt_host="149.154.167.91")
```

## DC Selection Algorithm

```python
def pick_dc_endpoint(dc_map, preferred_dc=None):
    # 1. Use preferred DC if available
    if preferred_dc is not None and preferred_dc in dc_map and dc_map[preferred_dc]:
        return dc_map[preferred_dc][0]

    # 2. Fallback: DC 0 (alias for DC 2)
    if 0 in dc_map and dc_map[0]:
        return dc_map[0][0]

    # 3. Iterate through DCs in priority order
    for dc_id in (2, 1, 4, 5, 3):
        if dc_id in dc_map and dc_map[dc_id]:
            return dc_map[dc_id][0]

    raise RuntimeError("No available endpoint in DC map")
```

## Runtime DC Migration

During MTProto operations, if the server responds with a `PHONE_MIGRATE_X` or `NETWORK_MIGRATE_X` error, GoyGram automatically reconnects to the correct DC:

```python
async def _mt_req_with_migrate(app, act, **kw):
    while True:
        res = await app.mt_req(act, **kw)
        err = _extract_error(res) or ""
        dc_id = _extract_migrate_dc(err)
        if dc_id is None:
            return res  # no migration needed

        # Look up the new DC endpoint
        dc_map = get_dynamic_dc_config()
        endpoint = pick_dc_endpoint(dc_map, preferred_dc=dc_id)

        # Close existing connection
        await app.mt.close()

        # Reset all MTProto state
        app.mt.host = endpoint.host
        app.mt.port = endpoint.port
        app.mt.auth_key = None
        app.mt.seq = 0
        app.mt._init_done = False
        app.mt.session_id = secrets.token_bytes(8)

        # Reconnect and re-authenticate
        await app.mt.boot()
        await app.mt.ensure_auth_key()

        # Loop: retry the request on the new DC
```

### Migration Triggers

The `_extract_migrate_dc` function looks for error patterns:

```python
def _extract_migrate_dc(err_text):
    m = re.search(r"(?:PHONE|NETWORK)_MIGRATE_(\d+)", err_text.upper())
    if m:
        return int(m.group(1))
    return None
```

This catches:
- `PHONE_MIGRATE_5` → migrate to DC 5
- `NETWORK_MIGRATE_1` → migrate to DC 1
- Any `*_MIGRATE_N` pattern

### What Resets on Migration

| State | Reset? | Reason |
|-------|--------|--------|
| `auth_key` | ✅ Set to `None` | Auth key is DC-specific |
| `_init_done` | ✅ Set to `False` | `initConnection` must be re-sent |
| `session_id` | ✅ New random bytes | Fresh session for new DC |
| `seq` | ✅ Reset to 0 | Sequence numbers restart |
| `host` / `port` | ✅ Updated | Point to new DC |
| `bus` | ❌ Kept | Same event bus |
| `pending` | ❌ Kept | Pending futures remain (but will fail if not re-sent) |
| `stop_ev` | ✅ Re-cleared | New connection needs fresh stop state |

## Vault DC Restoration

When restoring from a vault, the stored DC is used:

```python
dc = data.get("dc")
if dc is not None:
    if isinstance(dc, str) and "." in str(dc):
        app.mt.host = str(dc)  # direct IP override
    else:
        dc_map = get_dynamic_dc_config()
        endpoint = pick_dc_endpoint(dc_map, preferred_dc=int(dc))
        app.mt.host = endpoint.host
        app.mt.port = endpoint.port
```

This handles two cases:
- **String with dots**: Direct IP (backward compatible with old vaults)
- **Integer**: DC number, looked up in the dynamic config map

## Fallback Behavior

If dynamic DC resolution fails entirely (network error, DNS failure, etc.):

```python
try:
    dc_map = get_dynamic_dc_config()
    selected = pick_dc_endpoint(dc_map, preferred_dc=2)
    resolved_host, resolved_port = selected.host, selected.port
except Exception as e:
    log.error("Dynamic DC routing failed: %r", e)
    resolved_host, resolved_port = "149.154.167.50", 443  # DC 2 hardcoded
    log.warning("Using fallback MT endpoint %s:%s", resolved_host, resolved_port)
```

DC 2 (`149.154.167.50:443`) is the ultimate fallback. If even that fails, the TCP connection will time out.
