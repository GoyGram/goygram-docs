# MTProto Encryption (AES-IGE)

AES-256-IGE (Infinite Garble Extension) is Telegram's custom block cipher mode used for all MTProto encrypted messages. GoyGram implements this in Rust for maximum performance.

## IGE Mode Overview

IGE is a block cipher mode that provides bi-directional error propagation — a single bit flip corrupts the rest of the message in both encryption and decryption directions. It's similar to CBC but uses the previous ciphertext AND plaintext blocks for XOR chaining.

### Encryption

```
x = iv[0:16]     # first half of IV
y = iv[16:32]    # second half of IV

for each 16-byte plaintext block P_i:
    T = P_i XOR x
    T = AES_encrypt(key, T)
    C_i = T XOR y
    x = C_i        # shift right
    y = P_i        # shift right
```

### Decryption

```
x = iv[0:16]
y = iv[16:32]

for each 16-byte ciphertext block C_i:
    T = C_i XOR y
    T = AES_decrypt(key, T)
    P_i = T XOR x
    x = C_i        # shift right
    y = P_i        # shift right
```

## Rust Implementation

```rust
fn enc_raw(key: &[u8], iv: &[u8], data: &[u8]) -> PyResult<Vec<u8>> {
    chk(key, iv, data)?;  // validates key=32, iv=32, data aligned to 16
    let aes = Aes256::new_from_slice(key)?;
    let mut x = iv[..16].to_vec();
    let mut y = iv[16..].to_vec();
    let mut out = Vec::with_capacity(data.len());

    for blk in data.chunks_exact(16) {
        let mut tmp = [0u8; 16];
        for i in 0..16 { tmp[i] = blk[i] ^ x[i]; }
        let mut ga = GenericArray::clone_from_slice(&tmp);
        aes.encrypt_block(&mut ga);
        let mut c = [0u8; 16];
        for i in 0..16 { c[i] = ga[i] ^ y[i]; }
        x.copy_from_slice(&c);
        y.copy_from_slice(blk);
        out.extend_from_slice(&c);
    }
    Ok(out)
}
```

### Constraints

- **key**: exactly 32 bytes (AES-256)
- **iv**: exactly 32 bytes (two 16-byte halves)
- **data**: must be a multiple of 16 bytes for raw variants
- **enc/dec** (with padding): auto-adds/removes PKCS7 padding

## Python API

```python
from goygram import ext as rx

# Raw (no padding) — used for MTProto messages
encrypted = rx.aes_ige_enc_raw(plaintext, aes_key, aes_iv)
decrypted = rx.aes_ige_dec_raw(ciphertext, aes_key, aes_iv)

# With PKCS7 padding — used for DH answer decryption
encrypted = rx.aes_ige_enc(plaintext, aes_key, aes_iv)
decrypted = rx.aes_ige_dec(ciphertext, aes_key, aes_iv)
```

## Key Derivation (for Message Encryption)

The AES key and IV for each MTProto message are derived from the `auth_key` and `msg_key`:

```python
def kdf_msg(auth_key, msg_key, to_server=True):
    x = 0 if to_server else 8
    a = sha256(msg_key + auth_key[x:x+36]).digest()
    b = sha256(auth_key[40+x:76+x] + msg_key).digest()
    aes_key = a[:8] + b[8:24] + a[24:32]   # 32 bytes
    aes_iv  = b[:8] + a[8:24] + b[24:32]   # 32 bytes
    return aes_key, aes_iv
```

The `msg_key` itself is computed from the message + auth_key:
```python
msg_key_large = sha256(auth_key[88:120] + plaintext + random_padding).digest()
msg_key = msg_key_large[8:24]  # middle 16 bytes
```

## Performance

With AES-NI hardware acceleration (universal on x86-64 since ~2010):
- Each 16-byte block encrypts in ~10-20 CPU cycles
- A 512-byte MTProto message (32 blocks) encrypts in ~320-640 cycles
- At 3 GHz, that's ~100-200 nanoseconds per message

The Python→Rust boundary crossing adds more latency than the actual encryption. For bulk operations, the cost is amortized across the entire message.
