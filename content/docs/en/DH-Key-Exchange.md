---
title: DH Key Exchange
---

# DH Key Exchange

The Diffie-Hellman key exchange is the three-step handshake that establishes the shared 256-byte `auth_key` between client and Telegram server. GoyGram implements this entirely in Python, with Rust doing only the AES-IGE decryption of the DH answer.

## Overview

```
Client                                            Server
  │                                                  │
  │──── req_pq_multi(nonce) ────────────────────────→│
  │                                                  │
  │←─── resPQ(nonce, server_nonce, pq, fingerprints)─│
  │                                                  │
  │──── req_DH_params(encrypted p_q_inner_data) ────→│
  │                                                  │
  │←─── server_DH_params_ok(encrypted DH answer) ────│
  │                                                  │
  │──── set_client_DH_params(encrypted confirmation)─→│
  │                                                  │
  │←─── dh_gen_ok ───────────────────────────────────│
  │                                                  │
  auth_key ← pow(g_a, b, dh_prime)                   │
```

## Step 1: Request PQ Factorization

```python
nonce = secrets.token_bytes(16)
res = await self.invoke_unencrypted(self.codec.req_pq_multi(nonce))
```

**Request**: `req_pq_multi#be7e8ef1 nonce:int128`

**Response**: `resPQ#05162463 nonce:int128 server_nonce:int128 pq:bytes server_public_key_fingerprints:Vector<long>`

On receipt, GoyGram:
1. Verifies `nonce` matches (prevents replay)
2. Extracts `server_nonce` (save for later)
3. Extracts `pq` (product of two primes, factorized with Pollard's Rho)
4. Extracts `fingerprints` (list of known RSA public key IDs)

## Pollard's Rho Factorization

```python
def factorize(pq: int) -> tuple[int, int]:
    if pq % 2 == 0:
        return 2, pq // 2
    for c in range(1, 100):
        x = y = secrets.randbelow(pq - 2) + 2
        d = 1
        while d == 1:
            x = (x * x + c) % pq
            y = (y * y + c) % pq
            y = (y * y + c) % pq
            d = gcd(abs(x - y), pq)
        if d != pq:
            return (min(d, pq // d), max(d, pq // d))
    raise ValueError('cant factorize pq')
```

Standard Pollard's Rho algorithm with Floyd's cycle detection (tortoise and hare). The `pq` number is typically ~512 bits — Pollard's Rho handles this in microseconds.

## Step 2: RSA Key Selection

GoyGram checks `fingerprints` against its hardcoded Telegram RSA key registry:

```python
fp = next((x for x in fps if x in TELEGRAM_RSA_KEYS), None)
if fp is None:
    raise RuntimeError(f"no known Telegram RSA key fingerprint in resPQ: {fps!r}")
```

There are 8 hardcoded 2048-bit RSA public keys in `vendor/tl_core.py` under `TELEGRAM_RSA_KEYS`. Each maps a 64-bit fingerprint to a 2048-bit modulus. See [RSA Public Key Registry](RSA-Public-Key-Registry) for the full list.

## Step 3: Encrypt p_q_inner_data

```python
p, q = sorted(factorize(int.from_bytes(pq, 'big')))
new_nonce = secrets.token_bytes(32)

inner = self.codec.p_q_inner_data(
    pq=pq, p=p.to_bytes(4, 'big'), q=q.to_bytes(4, 'big'),
    nonce=nonce, server_nonce=server_nonce, new_nonce=new_nonce
)

enc = rsa_pad_encrypt(inner, n_mod, e=65537)
```

**RSA padding** (`rsa_pad_encrypt`):
```python
def rsa_pad_encrypt(data, n, e):
    d = sha1(data).digest() + data           # SHA1 hash + data
    d += secrets.token_bytes(255 - len(d))    # random padding to 255 bytes
    return pow(int.from_bytes(d, 'big'), e, n).to_bytes(256, 'big')
```

The 256-byte result is sent in `req_DH_params`:

```python
await self.invoke_unencrypted(self.codec.req_dh_params(
    nonce=nonce, server_nonce=server_nonce,
    p=p.to_bytes(4, 'big'), q=q.to_bytes(4, 'big'),
    fp=fp, encrypted_data=enc
))
```

## Step 4: Decrypt DH Answer

The server responds with `server_DH_params_ok#d0e8075c` containing `encrypted_answer`. This is decrypted with AES-256-IGE using a **temporary key** derived from `new_nonce` and `server_nonce`:

```python
tmp_key, tmp_iv = kdf(new_nonce, server_nonce)
# kdf: SHA1-based key derivation
# key = SHA1(new_nonce + server_nonce) + SHA1(server_nonce + new_nonce)[:12]
# iv  = SHA1(server_nonce + new_nonce)[12:20] + SHA1(new_nonce + new_nonce) + new_nonce[:4]

dec = bytes(rx.aes_ige_dec_raw(encrypted_answer, tmp_key, tmp_iv))
answer = dec[20:]  # strip 20-byte padding prefix (SHA1 hash)
```

The answer contains `server_DH_inner_data#b5890dba`:
```
nonce: int128
server_nonce: int128
g: int32                  # generator (typically 3)
dh_prime: bytes           # Diffie-Hellman prime
g_a: bytes                # g^a mod dh_prime (server's public key)
server_time: int32
```

## Step 5: Compute Shared Key

```python
b = int.from_bytes(secrets.token_bytes(256), 'big')  # random 2048-bit value
g_b = pow(g, b, dh_prime).to_bytes(256, 'big')       # client's public key

self.auth_key = pow(g_a, b, dh_prime).to_bytes(256, 'big')  # shared secret

self.server_salt = bytes(a ^ b for a, b in zip(new_nonce[:8], server_nonce[:8]))
```

## Step 6: Confirm

Send `set_client_DH_params` with the client's `g_b` encrypted under the same temp key:

```python
cli = self.codec.client_dh_inner(nonce=nonce, server_nonce=server_nonce, retry_id=0, g_b=g_b)
# SHA1 padding
payload = sha1(cli).digest() + cli
payload += b'\x00' * ((16 - len(payload) % 16) % 16)

enc2 = bytes(rx.aes_ige_enc_raw(payload, tmp_key, tmp_iv))

ans = await self.invoke_unencrypted(self.codec.set_client_dh_params(
    nonce=nonce, server_nonce=server_nonce, encrypted_data=enc2
))
```

Server responds with `dh_gen_ok#3bcbf734`, `dh_gen_retry`, or `dh_gen_fail`. On success, `auth_ready` event is set and encrypted communication begins.

## Rand vs Secrets

All random values use `secrets.token_bytes()` (os.urandom) — the cryptographically secure random source. No `random` module usage in the DH code path. This is critical: a weak random `b` would compromise the session key.
