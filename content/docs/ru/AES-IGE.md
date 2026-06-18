---
title: "АЕС ИГЭ"
---

# Шифрование AES-IGE

AES-256-IGE (Infinite Garble Extension) — режим блочного шифрования, используемый в MTProto для шифрования сообщений. Реализовано в расширении Rust `goygram.ext` (`ext_rust/src/lib.rs`).

## Математика

Для каждого блока (16 байт):


```
C_i = E_k(P_i ⊕ X_i) ⊕ Y_i
```


Где:
- `E_k` — шифрование AES-256 с ключом `k`.
- `P_i` — i-й блок открытого текста
- `C_i` — i-й блок зашифрованного текста
- `X_0, Y_0` — первая и вторая половины IV (по 16 байт каждая)
- `X_i = C_{i-1}`, `Y_i = P_{i-1}` для i > 0

## Реализация Rust


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


## PKCS7 Заполнение

Перед шифрованием данные дополняются до размера, кратного 16 байтам:


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


После расшифровки заполнение проверяется и удаляется:


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


## API Python

Представлены четыре функции:


```python
from goygram import ext as rx

# With PKCS7 padding:
rx.aes_ige_enc(data, key, iv)     # pad → encrypt
rx.aes_ige_dec(data, key, iv)     # decrypt → unpad

# Raw (no padding, data must be multiple of 16):
rx.aes_ige_enc_raw(data, key, iv)
rx.aes_ige_dec_raw(data, key, iv)
```


## Использование в MTProto

1. **Обмен ключами DH**: расшифровка `server_DH_inner_data` с помощью временного ключа (`tmp_key`, `tmp_iv`), полученного из `kdf(new_nonce, server_nonce)`.

2. **Шифрование сообщений**: после установки `auth_key` каждое сообщение шифруется с помощью `kdf_msg(auth_key, msg_key, to_server=True)` → `aes_ige_enc_raw`.

3. **Расшифровка ответа**: через `kdf_msg(auth_key, msg_key, to_server=False)` → `aes_ige_dec_raw`.

## См. также

- [MTProto Message Format](MTProto-Message-Format) — зашифрованная структура сообщения
- [MTProto Raw Calls](MTProto-Raw-Calls) — `send()` и `_handle_encrypted_packet()`