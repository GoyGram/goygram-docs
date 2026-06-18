---
---

# 2FA/SRP-пароль

Если в учетной записи включена двухфакторная аутентификация, GoyGram автоматически обрабатывает запрос SRP (безопасный удаленный пароль). Это доказательство пароля с нулевым разглашением — ваш пароль никогда не покидает клиента в виде открытого текста.

## Обнаружение

2FA обнаруживается в нескольких типах ответов:


```python
err = _extract_error(res) or ""
if "SESSION_PASSWORD_NEEDED" in err:
    # Trigger 2FA flow
```


Это появляется в:
- Ответ `auth.signIn`
- Ответ `auth.exportLoginToken`
- Ответ `auth.importLoginToken`

## Поток рекомендованной розничной цены

### Шаг 1. Получите параметры пароля


```python
state = await self._rpc_call('account_get_password', api_id=api_id)
```


Это вызывает `account.getPassword`, который возвращает:


```python
{
    "ok": True,
    "has_password": True,
    "has_recovery": bool,
    "has_secure_values": bool,
    "current_algo": {
        "salt1": bytes,   # first salt
        "salt2": bytes,   # second salt
        "g": int,         # generator
        "p": bytes,       # 2048-bit prime
    },
    "srp_B": bytes,       # server's public value
    "srp_id": int,        # SRP session ID
    "hint": str | None,   # password hint (optional)
}
```


Если `has_password` имеет значение false → ошибка (пароль не активирован, но Telegram сказал, что он нужен — этого не должно произойти).

### Шаг 2. Вычисление хеша пароля


```python
def _compute_password_hash(algo, password):
    salt1 = bytes(algo["salt1"])
    salt2 = bytes(algo["salt2"])
    h1 = sha256(salt1 + password.encode() + salt1).digest()
    h2 = sha256(salt2 + h1 + salt2).digest()
    h3 = hashlib.pbkdf2_hmac("sha512", h2, salt1, 100000)
    return sha256(salt2 + h3 + salt2).digest()
```


Это хеширование пароля SRP Telegram:
1. `hash1 = SHA256(salt1 || password || salt1)`
2. `hash2 = SHA256(salt2 || hash1 || salt2)`
3. `hash3 = PBKDF2-HMAC-SHA512(hash2, salt1, 100000)`
4. `x = SHA256(salt2 || hash3 || salt2)`

### Шаг 3: Вычислите доказательство SRP


```python
def _compute_password_check(state, password):
    algo = dict(state["current_algo"])
    p = _btoi(bytes(algo["p"]))     # 2048-bit prime
    g = int(algo["g"])               # generator
    b_bytes = bytes(state["srp_B"])  # server's public key
    srp_id = int(state["srp_id"])

    x_bytes = _compute_password_hash(algo, password)
    x = _btoi(x_bytes)

    g_x = pow(g, x, p)               # verifier
    k = _btoi(sha256(p_bytes + g_bytes).digest())
    kg_x = (k * g_x) % p

    # Generate client key pair
    while True:
        a_bytes = secrets.token_bytes(256)  # random 2048-bit value
        a = _btoi(a_bytes)
        a_pub = pow(g, a, p)               # A = g^a mod p
        u = _btoi(sha256(a_pub_bytes + b_bytes).digest())
        if u > 0:
            break

    # Compute shared secret
    g_b = (b - kg_x) % p
    s = pow(g_b, a + (u * x), p)

    # Derive session key
    k_bytes = sha256(_itob(s)).digest()

    # Compute M1 proof
    m1_bytes = sha256(
        _xor(sha256(p_bytes).digest(), sha256(g_bytes).digest())
        + sha256(bytes(algo["salt1"])).digest()
        + sha256(bytes(algo["salt2"])).digest()
        + a_pub_bytes
        + b_bytes
        + k_bytes
    ).digest()

    return srp_id, a_pub_bytes, m1_bytes
```


### Шаг 4. Отправьте подтверждение


```python
check = await self._rpc_call('auth_check_password_srp',
    srp_id=srp_id, A=a_pub, M1=m1, api_id=api_id
)
```


Сервер проверяет M1 и возвращает окончательный результат аутентификации (пользовательские данные + сеансовый ключ). Если M1 неверен → пароль неверен → повторите попытку.

## Обработка ошибок

- **Неверный пароль**: `check_err` не пусто → запросите пароль повторно.
- **Неожиданный формат ответа**: пропустите и повторите попытку.
- **Ошибки сети во время SRP**: обнаружены `try/except`, повторный запрос

## Интеграция с потоками аутентификации

Поток SRP автоматически запускается из потоков входа в систему как по номеру телефона, так и по QR-коду:


```python
# In _mt_auth_flow (phone login):
if "SESSION_PASSWORD_NEEDED" in sign_err:
    while True:
        pwd = await _ask_non_empty("2FA password: ", is_password=True)
        check = await _mt_req_with_migrate(app, "auth_check_password",
            password=pwd, api_id=api_id, api_hash=api_hash)
        # ... validate, retry or break
        final = check
        break

# In _mt_qr_auth_flow (QR login):
if "SESSION_PASSWORD_NEEDED" in err:
    while True:
        pwd = await _ask_non_empty("2FA password: ", is_password=True)
        check = await _mt_req_with_migrate(app, "auth_check_password", ...)
        # ... same pattern
```


Запись `auth_check_password` в `_build_body` определяет, что `srp_id` НЕ находится в kwargs, и направляет к `_auth_check_password_flow`, который обрабатывает полный танец SRP:


```python
async def call(self, act, **kw):
    if act in {'auth.checkPassword', 'auth_check_password'} and 'srp_id' not in kw:
        return await self._auth_check_password_flow(
            str(kw.get('password') or ''), int(kw['api_id'])
        )
    return await self._rpc_call(act, **kw)
```


## Криптобезопасность

- Все случайные значения используют `secrets.token_bytes()` (os.urandom)
- Проверка `u > 0` предотвращает вырожденный регистр в SRP.
- Протокол SRP гарантирует, что сервер никогда не увидит пароль в виде открытого текста — только верификатор.
- Доказательство M1 вычисляется детерминировано — без случайного оракула