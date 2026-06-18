# Error Handling

GoyGram has a typed exception hierarchy for RPC errors, a `StopPropagation` mechanism for handler flow control, and per-handler error isolation in the dispatcher.

## Exception Hierarchy

```
GoyGramError
├── StopPropagation          ← handler flow control
├── TransportError
│   ├── ConnectionClosedError
│   └── ProxyError
├── RPCError(code, message)
│   ├── SeeOtherError (303)
│   │   ← PHONE_MIGRATE_X, NETWORK_MIGRATE_X, USER_MIGRATE_X, FILE_MIGRATE_X
│   ├── BadRequestError (400)
│   │   ├── FloodWaitError(code, message, seconds)
│   │   ├── UserRestrictedError
│   │   ├── UserBannedError
│   │   ├── PhoneCodeInvalidError
│   │   ├── PhoneCodeExpiredError
│   │   ├── MessageTooLongError
│   │   ├── MessageNotModifiedError
│   │   ├── MessageIdInvalidError
│   │   ├── PeerIdInvalidError
│   │   ├── UsernameInvalidError
│   │   ├── UsernameNotOccupiedError
│   │   ├── ChatAdminRequiredError
│   │   ├── ChatNotModifiedError
│   │   ├── EntityBoundsInvalidError
│   │   ├── ButtonDataInvalidError
│   │   ├── InputConstructorInvalidError
│   │   ├── InputMethodInvalidError
│   │   ├── FileReferenceExpiredError
│   │   ├── FilePartInvalidError
│   │   ├── PersistentTimestampOutdatedError
│   │   ├── UsersTooFewError
│   │   ├── UsersTooMuchError
│   │   ├── UserAlreadyParticipantError
│   │   ├── UserNotParticipantError
│   │   ├── PhotoSaveFileInvalidError
│   │   └── ImageProcessFailedError
│   ├── UnauthorizedError (401)
│   │   ├── AuthKeyUnregisteredError
│   │   ├── SessionPasswordNeededError
│   │   ├── AuthKeyInvalidError
│   │   ├── PhoneNumberUnoccupiedError
│   │   ├── PhoneNumberInvalidError
│   │   └── PhoneCodeHashEmptyError
│   ├── ForbiddenError (403)
│   │   ├── ChatWriteForbiddenError
│   │   ├── UserBannedInChannelError
│   │   ├── UserPrivacyRestrictedError
│   │   ├── UserChannelsTooMuchError
│   │   ├── UserKickedError
│   │   ├── MessageDeleteForbiddenError
│   │   ├── PollVoteRequiredError
│   │   ├── BroadcastForbiddenError
│   │   └── ChannelPrivateError
│   ├── NotFoundError (404)
│   │   ├── ChannelNotFoundError
│   │   ├── ChatNotFoundError
│   │   ├── UserNotFoundError
│   │   ├── MessageNotFoundError
│   │   └── FileNotFoundError
│   ├── NotAcceptableError (406)
│   │   ├── ChannelTooLargeError
│   │   ├── FreshChangeAdminsForbiddenError
│   │   ├── ChannelIdInvalidError
│   │   └── FilerefUpgradeNeededError
│   └── InternalServerError (500)
│       ├── RpcCallFailError
│       ├── RpcMcGetFailError
│       └── ApiCallError
├── TimeoutError
├── AuthError
├── CodecError
└── RustExtError
```

## RPC Error Factory

Errors are matched by pattern from Telegram's error message strings:

```python
def rpc_error(code: int, message: str) -> RPCError:
    # Special: FLOOD_WAIT_X → FloodWaitError with seconds extracted
    m = re.match(r"^FLOOD_WAIT_(\d+)$", message)
    if m:
        return FloodWaitError(code, message, int(m.group(1)))

    # ~80 string patterns → specific exception types
    for pattern, cls in _ERROR_PATTERNS:
        if pattern in message:
            return cls(code, message)

    # Code-based fallback
    return _CODE_FALLBACK.get(code, RPCError)(code, message)
```

### Using RPC Errors

```python
from goygram.errors import FloodWaitError, ChatAdminRequiredError

try:
    await app.ban_chat_member(chat_id, user_id)
except FloodWaitError as e:
    await asyncio.sleep(e.seconds)
    await app.ban_chat_member(chat_id, user_id)
except ChatAdminRequiredError:
    await app.bot.send_msg(chat_id, "I need admin rights to do that")
```

## StopPropagation

`StopPropagation` is a special exception that stops the handler chain for the current event type:

```python
from goygram import StopPropagation

@app.on_msg(filt=filters.text)
async def first(msg):
    if msg.text == "secret":
        raise StopPropagation  # stops message handler chain here
    await msg.reply("Processed")

@app.on_msg(filt=filters.text)
async def second(msg):
    # Won't fire if first handler raised StopPropagation
    await msg.reply("Second handler")
```

### How StopPropagation Works

In `Disp.one()`, each handler group has a `try/except StopPropagation`:

```python
for fn in list(self.app.hook):
    try:
        await fn(msg)
    except StopPropagation:
        return  # exits the entire handler group immediately
    except Exception as e:
        self.log.error("Handler failure: %r", e)
```

Key behavior:
- `StopPropagation` **only stops the current handler group** (`hook`, `cb_hook`, `poll_hook`, or `member_hook`)
- It does **not** stop `update_hook` handlers — those run in a separate loop
- It does **not** affect other event types — a `StopPropagation` in a message handler won't prevent callback handlers from firing
- It is **not an error** — it's a flow control mechanism

## Transport Errors

### Bot API

```python
async def req(self, m, data=None):
    async with self.sess.post(f"{self.base}/{m}", **body) as r:
        raw = await r.json(content_type=None)

    if r.status >= 400:
        raise RuntimeError(f"botapi {m} http {r.status}: {raw}")

    if not raw.get("ok"):
        raise RuntimeError(f"botapi {m} fail: {raw}")

    return raw["result"]
```

All Bot API errors raise `RuntimeError`. Special case: HTTP 409 on `getUpdates` auto-clears webhooks and retries silently.

### MTProto

MTProto errors are returned as `{"ok": False, "error_code": ..., "error": ...}` dicts rather than raised. The `_parse_rpc_result` function in `mtproto.py` converts them using `rpc_error_from_dict()`. MTProto connection errors raise `ConnectionClosedError`.

## Handler Error Isolation

Every handler call is individually wrapped in try/except:

```python
for fn in list(self.app.hook):
    try:
        await fn(msg)
    except StopPropagation:
        return
    except Exception as e:
        self.log.error("Handler failure: %r", e)
        await self.bus.push("sys", {
            "kind": "err", "src": "disp", "text": repr(e)
        })
```

One handler's failure never kills the dispatcher or blocks other handlers. Error events are pushed to the bus as `kind: "err"` for observability.

## Auth Errors

During interactive login, errors are handled inline — the flow retries or escalates rather than crashing:

- `PHONE_CODE_INVALID` → reprompt for code
- `SESSION_PASSWORD_NEEDED` → trigger 2FA/SRP flow
- `PHONE_MIGRATE_X` → auto-DC migration via `_mt_req_with_migrate()`

## Startup Error Fallbacks

```python
# DC resolution failure → hardcoded fallback
try:
    dc_map = get_dynamic_dc_config()
    selected = pick_dc_endpoint(dc_map, preferred_dc=2)
except Exception:
    resolved_host, resolved_port = "149.154.167.50", 443

# Vault decryption failure → interactive auth
try:
    data = _read_vault(vault, session_name)
except Exception:
    return await _mt_auth_flow(...)
```

Startup errors resolve through fallback paths — static DC IPs, interactive login.

## Signal Handling

```python
signal.signal(signal.SIGINT, _instant_exit)
signal.signal(signal.SIGTERM, _instant_exit)
```

`os._exit(0)` for immediate process exit. The `finally` block in `run()` handles graceful shutdown via `stop_ev`, but SIGINT/SIGTERM bypass it for responsiveness.
