---
title: "Обработка ошибок"

---
# Обработка ошибок

GoyGram имеет типизированную иерархию исключений для ошибок RPC, механизм `StopPropagation` для управления потоком обработчиков и изоляцию ошибок для каждого обработчика в диспетчере.

## Иерархия исключений


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


## Фабрика ошибок RPC

Ошибки сопоставляются по шаблону из строк сообщений об ошибках Telegram:


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


### Использование ошибок RPC


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


## Остановить распространение

`StopPropagation` — это особое исключение, которое останавливает цепочку обработчиков текущего типа события:


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


### Как работает StopPropagation

В `Disp.one()` каждая группа обработчиков имеет `try/except StopPropagation`:


```python
for fn in list(self.app.hook):
    try:
        await fn(msg)
    except StopPropagation:
        return  # exits the entire handler group immediately
    except Exception as e:
        self.log.error("Handler failure: %r", e)
```


Ключевое поведение:
- `StopPropagation` **останавливает только текущую группу обработчиков** (`hook`, `cb_hook`, `poll_hook` или `member_hook`)
- Он **не** останавливает обработчики `update_hook` — они выполняются в отдельном цикле.
- Это **не** влияет на другие типы событий — `StopPropagation` в обработчике сообщения не помешает срабатыванию обработчиков обратного вызова.
- Это **не ошибка** — это механизм управления потоком данных.

## Ошибки транспорта

### API бота


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


Все ошибки API бота вызывают `RuntimeError`. Особый случай: HTTP 409 на `getUpdates` автоматически очищает веб-перехватчики и автоматически повторяет попытку.

### МТПрото

Ошибки MTProto возвращаются как `{"ok": False, "error_code": ..., "error": ...}`, а не возникают. Функция `_parse_rpc_result` в `mtproto.py` преобразует их с помощью `rpc_error_from_dict()`. Ошибки подключения MTProto вызывают `ConnectionClosedError`.

## Изоляция ошибок обработчика

Каждый вызов обработчика индивидуально обернут в try/Exception:


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


Сбой одного обработчика никогда не убивает диспетчер и не блокирует другие обработчики. События ошибок передаются на шину как `kind: "err"` для удобства наблюдения.

## Ошибки аутентификации

Во время интерактивного входа ошибки обрабатываются в реальном времени — поток повторяется или расширяется, а не завершается сбоем:

- `PHONE_CODE_INVALID` → повторный запрос кода
- `SESSION_PASSWORD_NEEDED` → запускать поток 2FA/SRP
- `PHONE_MIGRATE_X` → автоматическая миграция DC через `_mt_req_with_migrate()`

## Резервные варианты ошибок при запуске


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


Ошибки запуска устраняются с помощью резервных путей — статических IP-адресов контроллера домена, интерактивного входа в систему.

## Обработка сигналов


```python
signal.signal(signal.SIGINT, _instant_exit)
signal.signal(signal.SIGTERM, _instant_exit)
```


`os._exit(0)` для немедленного выхода из процесса. Блок `finally` в `run()` обеспечивает корректное завершение работы через `stop_ev`, но SIGINT/SIGTERM обходит его для обеспечения оперативности.