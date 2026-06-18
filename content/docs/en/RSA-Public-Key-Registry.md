---
title: RSA Public Key Registry
---

# RSA Public Key Registry

GoyGram hardcodes all 8 Telegram production RSA public keys used for the DH key exchange. These are the keys that sign the `p_q_inner_data` during auth key generation.

## Key Map

```python
TELEGRAM_RSA_KEYS: dict[int, int] = {
    # Fingerprint → 2048-bit RSA modulus
    847625836280919973:  int("2208194653103..."),
    1562291298945373506: int("2397875855310..."),
    -5859577972006586033: int("2271864697902..."),
    6491968696586960280: int("2403776680080..."),
    -4344800451088585951: int("2440344664914..."),
    -7306692244673891685: int("2508140781041..."),
    -5738946642031285640: int("2234733764462..."),
    8205599988028290019: int("2457345520795..."),
}
```

Each key is a 2048-bit RSA modulus (617 decimal digits). The public exponent is always 65537.

## Key Selection

During the DH exchange, the server returns a list of fingerprints in `resPQ`. GoyGram picks the first one that matches:

```python
fp = next((x for x in fps if x in TELEGRAM_RSA_KEYS), None)
if fp is None:
    raise RuntimeError(f"no known Telegram RSA key fingerprint in resPQ: {fps!r}")
```

If none match (e.g., Telegram rotated all keys), auth fails. This has never happened in production — Telegram's RSA keys are extremely long-lived.

## RSA Padding Scheme (`rsa_pad_encrypt`)

The exact algorithm from `tl_core.py`:

```python
def rsa_pad_encrypt(data: bytes, n: int, e: int) -> bytes:
    d = sha1(data).digest() + data           # SHA-1 hash (20 bytes) + raw data
    d += secrets.token_bytes(255 - len(d))    # random padding to exactly 255 bytes
    return pow(int.from_bytes(d, 'big'), e, n).to_bytes(256, 'big')
```

**Step by step:**

1. **Hash prepend**: `SHA-1(data)` (20 bytes) is prepended to the data. The server verifies this hash to detect tampering.
2. **Random padding**: The combined bytes are padded with cryptographically random bytes to exactly 255 bytes total. A 2048-bit RSA modulus can encrypt at most 255 bytes.
3. **RSA encryption**: `m^65537 mod n` — standard RSA with public exponent 65537. The result is exactly 256 bytes (2048 bits).

**Why 65537?** It's the standard RSA public exponent — large enough to avoid small-exponent attacks, small enough for fast encryption (17 multiplications via square-and-multiply).

## How `p_q_inner_data` Is Built

Before RSA encryption, the TL-encoded inner data is constructed:

```python
def p_q_inner_data(self, *, pq, p, q, nonce, server_nonce, new_nonce):
    return (
        u32(0x83c95aec)           # constructor ID: p_q_inner_data
        + tl_bytes(pq)            # PQ product
        + tl_bytes(p)             # factor P (4 bytes)
        + tl_bytes(q)             # factor Q (4 bytes)
        + nonce                   # client nonce (16 bytes)
        + server_nonce            # server nonce (16 bytes)
        + new_nonce               # client new nonce (32 bytes)
    )
```

Total: ~100-110 bytes of TL-encoded data → padded with SHA-1 (20B) + random (~125B) → 255 bytes → RSA encrypt → 256 bytes.

## RSA Encryption (continued)

The selected key is then used:

```python
n_mod = TELEGRAM_RSA_KEYS[fp]
e = 65537
inner = self.codec.p_q_inner_data(pq=pq, p=p.to_bytes(4,'big'), q=q.to_bytes(4,'big'),
                                   nonce=nonce, server_nonce=server_nonce,
                                   new_nonce=new_nonce)
enc = rsa_pad_encrypt(inner, n_mod, e)
```

## Why 8 Keys?

Telegram maintains 8 production RSA key pairs. This provides:

1. **Gradual rotation**: Keys can be rotated one at a time without breaking all clients simultaneously.
2. **Geographic distribution**: Different DCs may present different key fingerprints in `resPQ`.
3. **Redundancy**: If one key is compromised, the other 7 still protect sessions.

## Security Model

The RSA keys provide **authentication of the DH handshake**, not encryption of traffic itself. The security model:

```
RSA (2048-bit, hardcoded) → protects p_q_inner_data
  │
  └→ DH (2048-bit, ephemeral) → generates auth_key (256 bytes)
        │
        └→ AES-256-IGE (with msg_key derivation) → encrypts all subsequent traffic
```

Even if all RSA keys were compromised, the **DH exchange provides forward secrecy**: the RSA keys only encrypt the `p_q_inner_data` during initial auth. After the DH completes, the session's `auth_key` is independent of the RSA keys. Compromising the RSA keys does NOT retroactively decrypt recorded MTProto traffic.

The `auth_key` (256 bytes) is the result of `g^ab mod p` — a standard Diffie-Hellman shared secret. Knowledge of RSA private keys would let you MITM a NEW auth key generation, but can't recover PAST auth keys.

## Rationale for Hardcoding

The keys are hardcoded rather than fetched because:
1. They change extremely rarely (Telegram has never rotated them in production)
2. Fetching them dynamically would require trusting a network source during the auth bootstrap
3. The DH exchange itself provides forward secrecy — the RSA keys only protect the initial handshake
4. Hardcoding eliminates a network round-trip and failure mode during the most critical phase of connection setup

## Updating Keys

If Telegram ever rotates keys:
1. Add new key entries to `TELEGRAM_RSA_KEYS`
2. The fingerprint format is a signed 64-bit integer (some are negative because they're interpreted as signed in the TL schema)
3. No other code changes needed — the lookup is automatic via fingerprint matching
