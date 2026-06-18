---
title: "Шифрование MTProto AES IGE"
---

# Шифрование MTProto (AES-IGE)

AES-256-IGE (Infinite Garble Extension) — это собственный режим блочного шифрования Telegram, используемый для всех зашифрованных сообщений MTProto. GoyGram реализует это в Rust для максимальной производительности.

## Обзор режима IGE

IGE — это режим блочного шифрования, который обеспечивает двунаправленное распространение ошибок — переворот одного бита искажает остальную часть сообщения как в направлении шифрования, так и в направлении дешифрования. Он похож на CBC, но использует предыдущие блоки зашифрованного текста и открытого текста для цепочки XOR.

### Шифрование


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


### Расшифровка


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


## Реализация Rust


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


### Ограничения

- **ключ**: ровно 32 байта (AES-256).
- **iv**: ровно 32 байта (две половины по 16 байт).
- **данные**: для необработанных вариантов должны быть кратны 16 байтам.
- **enc/dec** (с отступами): автоматически добавляет/удаляет отступы PKCS7.

## API Python


```python
from goygram import ext as rx

# Raw (no padding) — used for MTProto messages
encrypted = rx.aes_ige_enc_raw(plaintext, aes_key, aes_iv)
decrypted = rx.aes_ige_dec_raw(ciphertext, aes_key, aes_iv)

# With PKCS7 padding — used for DH answer decryption
encrypted = rx.aes_ige_enc(plaintext, aes_key, aes_iv)
decrypted = rx.aes_ige_dec(ciphertext, aes_key, aes_iv)
```


## Получение ключа (для шифрования сообщений)

Ключ AES и IV для каждого сообщения MTProto извлекаются из `auth_key` и `msg_key`:


```python
def kdf_msg(auth_key, msg_key, to_server=True):
    x = 0 if to_server else 8
    a = sha256(msg_key + auth_key[x:x+36]).digest()
    b = sha256(auth_key[40+x:76+x] + msg_key).digest()
    aes_key = a[:8] + b[8:24] + a[24:32]   # 32 bytes
    aes_iv  = b[:8] + a[8:24] + b[24:32]   # 32 bytes
    return aes_key, aes_iv
```


Сам `msg_key` вычисляется из сообщения + auth_key:

```python
msg_key_large = sha256(auth_key[88:120] + plaintext + random_padding).digest()
msg_key = msg_key_large[8:24]  # middle 16 bytes
```


## Производительность

С аппаратным ускорением AES-NI (универсально для x86-64 с ~2010 г.):
- Каждый 16-байтовый блок шифруется примерно за 10-20 циклов процессора.
- Сообщение MTProto размером 512 байт (32 блока) шифруется за ~320–640 циклов.
- На частоте 3 ГГц это ~100-200 наносекунд на сообщение.

Пересечение границы Python→Rust увеличивает задержку, чем фактическое шифрование. Для массовых операций стоимость амортизируется по всему сообщению.