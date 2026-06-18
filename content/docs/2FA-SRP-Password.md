# 2FA / SRP Password

When an account has two-factor authentication enabled, GoyGram automatically handles the SRP (Secure Remote Password) challenge. This is a zero-knowledge password proof — your password never leaves the client in plaintext.

## Detection

2FA is detected in multiple response types:

```python
err = _extract_error(res) or ""
if "SESSION_PASSWORD_NEEDED" in err:
    # Trigger 2FA flow
```

This appears in:
- `auth.signIn` response
- `auth.exportLoginToken` response
- `auth.importLoginToken` response

## SRP Flow

### Step 1: Get Password Parameters

```python
state = await self._rpc_call('account_get_password', api_id=api_id)
```

This calls `account.getPassword` which returns:

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

If `has_password` is false → error (password not enabled, but Telegram said it was needed — shouldn't happen).

### Step 2: Compute Password Hash

```python
def _compute_password_hash(algo, password):
    salt1 = bytes(algo["salt1"])
    salt2 = bytes(algo["salt2"])
    h1 = sha256(salt1 + password.encode() + salt1).digest()
    h2 = sha256(salt2 + h1 + salt2).digest()
    h3 = hashlib.pbkdf2_hmac("sha512", h2, salt1, 100000)
    return sha256(salt2 + h3 + salt2).digest()
```

This is Telegram's SRP password hashing:
1. `hash1 = SHA256(salt1 || password || salt1)`
2. `hash2 = SHA256(salt2 || hash1 || salt2)`
3. `hash3 = PBKDF2-HMAC-SHA512(hash2, salt1, 100000)`
4. `x = SHA256(salt2 || hash3 || salt2)`

### Step 3: Compute SRP Proof

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

### Step 4: Send Proof

```python
check = await self._rpc_call('auth_check_password_srp',
    srp_id=srp_id, A=a_pub, M1=m1, api_id=api_id
)
```

The server verifies M1 and returns the final auth result (user data + session key). If M1 is wrong → password is incorrect → retry.

## Error Handling

- **Wrong password**: `check_err` is non-empty → reprompt for password
- **Unexpected response format**: skip and retry
- **Network errors during SRP**: caught by `try/except`, reprompt

## Integration with Auth Flows

The SRP flow is automatically triggered from both phone number and QR code login flows:

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

The `auth_check_password` entry in `_build_body` detects that `srp_id` is NOT in the kwargs and routes to `_auth_check_password_flow` which handles the full SRP dance:

```python
async def call(self, act, **kw):
    if act in {'auth.checkPassword', 'auth_check_password'} and 'srp_id' not in kw:
        return await self._auth_check_password_flow(
            str(kw.get('password') or ''), int(kw['api_id'])
        )
    return await self._rpc_call(act, **kw)
```

## Crypto Safety

- All random values use `secrets.token_bytes()` (os.urandom)
- `u > 0` check prevents degenerate case in SRP
- The SRP protocol ensures the server never sees the plaintext password — only the verifier
- M1 proof is computed deterministically — no random oracle
