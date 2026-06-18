---
title: "Необработанные вызовы MTProto"
---

# Необработанные вызовы MTProto

Вызовы MTProto используют префикс `mt_` и проходят через `MTNet._rpc_call()`. Система следует шаблону запрос-ответ с корреляцией на основе `asyncio.Future`.

## Префикс mt_

Любой метод, доступный через `app.mt_*`, направляется в транспорт MTProto через `AppCore.__getattr__`. Префикс `mt_` удаляется, а имя преобразуется в пунктирный CamelCase с помощью `_mt_method_name()`:


```python
# Examples of working MTProto calls:
await app.mt_messages_get_dialogs(limit=50)
await app.mt_messages_get_history(chat_id=123, limit=100)
await app.mt_messages_send_reaction(chat_id=456, msg_id=789, reaction="👍")
await app.mt_channels_join_channel(chat_id=-1001234567890)
```


Никаких готовых оболочек методов нет — каждый вызов MTProto проходит через `__getattr__` → `_dynamic_method` → `_mt_method_name` → `mt_req`.

Использование:


```python
await app.mt_messages_get_dialogs(limit=50)
await app.mt_messages_get_history(chat_id=123, limit=100)
await app.mt_messages_send_reaction(chat_id=456, msg_id=789, reaction="👍")
await app.mt_channels_join_channel(chat_id=-1001234567890)
```


## _rpc_call() — Ядро

Сердце связи MTProto:


```python
async def _rpc_call(self, act: str, **kw: Any) -> dict[str, Any]:
    loop = asyncio.get_running_loop()
    fut: asyncio.Future[dict[str, Any]] = loop.create_future()
    req_msg_id = self.msg_ids.next()
    obj = {'act': act}
    obj.update({k: v for k, v in kw.items() if v is not None})
    self.pending[req_msg_id] = (fut, obj)
    await self.send(obj, req_msg_id=req_msg_id)
    return await asyncio.wait_for(fut, timeout=30.0)
```


Механизм:

1. Создается `asyncio.Future` для ожидания ответа.
2. Монотонный `msg_id` генерируется через `MsgIdGen`.
3. Запрос `(future, raw_object)` сохраняется в `self.pending`.
4. `self.send()` шифрует с помощью AES-IGE и передает через TCP.
5. Вызывающий абонент ожидает `asyncio.wait_for(fut, timeout=30.0)` — 30-секундный таймаут.

## Ожидаемый запрос и корреляция ответов


```python
self.pending: dict[int, tuple[asyncio.Future[dict[str, Any]], dict[str, Any]]] = {}
```


Ответы поступают асинхронно в `_handle_encrypted_packet()`. При получении `rpc_result` (идентификатор конструктора `0xf35c6d01`) извлекается `req_msg_id` и разрешается соответствующий `Future` в `pending`:


```python
if cid == 0xf35c6d01:
    req_msg_id = rm.i64()
    result = inner[12:]
    entry = self.pending.pop(req_msg_id, None)
    fut = entry[0] if isinstance(entry, tuple) else entry
    if fut and not fut.done():
        parsed = self._parse_rpc_result(result)
        fut.set_result(parsed)
```


## 30-секундный тайм-аут

Если ответ не поступает в течение 30 секунд, `asyncio.wait_for` вызывает `TimeoutError`, и ожидающая запись очищается:


```python
except asyncio.TimeoutError:
    self.pending.pop(req_msg_id, None)
    raise TimeoutError(
        f'no response for act={act} msg_id={req_msg_id}'
    )
```


## Обработка соли сервера

Когда получен `bad_server_salt` (конструктор `0xedab447b`), сеанс автоматически повторно отправляет запрос с обновленной солью:


```python
if cid == 0xedab447b:
    bad_msg_id = rm.i64()
    new_salt = int.from_bytes(rm.take(8), 'little', signed=False)
    self.server_salt = new_salt.to_bytes(8, 'little')
    self._init_done = False
    entry = self.pending.pop(bad_msg_id, None)
    if entry is not None:
        fut, saved_obj = entry
        if not fut.done():
            new_msg_id = self.msg_ids.next()
            self.pending[new_msg_id] = (fut, saved_obj)
            asyncio.create_task(self._resend(new_msg_id, saved_obj))
```


## Поток пароля 2FA

GoyGram поддерживает аутентификацию 2FA на основе SRP. `_auth_check_password_flow` в `security.py` организует трехэтапный процесс:


```python
async def _auth_check_password_flow(self, password: str, api_id: int) -> dict[str, Any]:
    # Step 1: Get password parameters
    state = await self._rpc_call('account_get_password', api_id=api_id)
    # Step 2: Compute SRP challenge
    srp_id, a_pub, m1 = _compute_password_check(state, password)
    # Step 3: Submit challenge
    return await self._rpc_call(
        'auth_check_password_srp',
        srp_id=srp_id, A=a_pub, M1=m1, api_id=api_id
    )
```


Вычисление SRP (`_compute_password_check`) реализует полный протокол Telegram SRP с SHA-256, PBKDF2-HMAC-SHA-512 (100 000 итераций) и 2048-битной модульной арифметикой.

## Повторная попытка миграции DC

`_mt_req_with_migrate` в `security.py` обрабатывает ошибки `PHONE_MIGRATE_X` и `NETWORK_MIGRATE_X`, автоматически переподключаясь к нужному центру обработки данных:


```python
async def _mt_req_with_migrate(app, act, **kw):
    while True:
        res = await app.mt_req(act, **kw)
        err = _extract_error(res) or ""
        dc_id = _extract_migrate_dc(err)
        if dc_id is None:
            return res
        # Switch to the new DC
        endpoint = pick_dc_endpoint(dc_map, preferred_dc=dc_id)
        await app.mt.close()
        app.mt.host = endpoint.host
        app.mt.port = endpoint.port
        app.mt.auth_key = None
        app.mt._init_done = False
        app.mt.session_id = secrets.token_bytes(8)
        await app.mt.boot()
        await app.mt.ensure_auth_key()
```


## Построение тела сообщения

`_build_body` нормализует имя действия через `_norm_act()` (snake_case → пунктирный CamelCase) и делегирует расширение Rust для сериализации TL:


```python
def _build_body(self, act: str, obj: dict[str, Any]) -> bytes:
    data = {}
    for k, v in obj.items():
        if k == 'act' or v is None:
            continue
        if isinstance(v, (bytes, bytearray)):
            data[k] = v.hex()
        elif isinstance(v, memoryview):
            data[k] = bytes(v).hex()
        else:
            data[k] = v
    tl_name = self._norm_act(act)
    return bytes(_ext.serialize_method(tl_name, json.dumps(data)))
```


Расширение Rust сопоставляет имя метода TL с загруженной схемой и сериализует аргументы в двоичный формат TL. `_norm_act()` преобразует имена типа `messages_send_message` → `messages.sendMessage`.

Разрешение одноранговых узлов (`_resolve_peer`) преобразует идентификаторы чата/пользователя/канала в их представления TL `InputPeer*`.