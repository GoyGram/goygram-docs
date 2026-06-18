---
title: AES IGE
---

# AES-IGE Encryption

AES-256-IGE (Infinite Garble Extension) — the block cipher mode used in MTProto for message encryption. Implemented in the Rust extension `goygram.ext` (`ext_rust/src/lib.rs`).

## Mathematics

For each block (16 bytes):

```
C_i = E_k(P_i ⊕ X_i) ⊕ Y_i
```

Where:
- `E_k` — AES-256 encryption with key `k`
- `P_i` — i-th plaintext block
- `C_i` — i-th ciphertext block
- `X_0, Y_0` — first and second halves of IV (16 bytes each)
- `X_i = C_{i-1}`, `Y_i = P_{i-1}` for i > 0

## Rust Implementation

```rust
fn enc_raw(key: &[u8], iv: &[u8], data: &[u8]) -> PyResult<Vec<u8>> {
    chk(key, iv, data)?;  // validates: key=32, iv=32, data % 16 == 0
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
        x.copy_from_slice(&c);   // x = C_{i-1}
        y.copy_from_slice(blk);  // y = P_{i-1}
        out.extend_from_slice(&c);
    }
    Ok(out)
}
```

## PKCS7 Padding

Data is padded to a multiple of 16 bytes before encryption:

```rust
fn pad(src: &[u8]) -> Vec<u8> {
    let n = 16 - (src.len() % 16);
    let p = if n == 0 { 16 } else { n };
    let mut out = Vec::with_capacity(src.len() + p);
    out.extend_from_slice(src);
    out.resize(src.len() + p, p as u8);
    out
}
```

After decryption, padding is validated and stripped:

```rust
fn unpad(src: &[u8]) -> PyResult<Vec<u8>> {
    let p = *src.last().unwrap() as usize;
    if p == 0 || p > 16 || src.len() < p {
        return Err(PyValueError::new_err("bad pad"));
    }
    // validate all padding bytes
    Ok(src[..src.len() - p].to_vec())
}
```

## Python API

Four functions are exposed:

```python
from goygram import ext as rx

# With PKCS7 padding:
rx.aes_ige_enc(data, key, iv)     # pad → encrypt
rx.aes_ige_dec(data, key, iv)     # decrypt → unpad

# Raw (no padding, data must be multiple of 16):
rx.aes_ige_enc_raw(data, key, iv)
rx.aes_ige_dec_raw(data, key, iv)
```

## Usage in MTProto

1. **DH key exchange**: decryption of `server_DH_inner_data` with a temporary key (`tmp_key`, `tmp_iv`) derived from `kdf(new_nonce, server_nonce)`.

2. **Message encryption**: after establishing `auth_key`, every message is encrypted via `kdf_msg(auth_key, msg_key, to_server=True)` → `aes_ige_enc_raw`.

3. **Response decryption**: via `kdf_msg(auth_key, msg_key, to_server=False)` → `aes_ige_dec_raw`.

## See Also

- [MTProto Message Format](MTProto-Message-Format) — encrypted message structure
- [MTProto Raw Calls](MTProto-Raw-Calls) — `send()` and `_handle_encrypted_packet()`
