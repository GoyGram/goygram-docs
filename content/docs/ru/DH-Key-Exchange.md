---
title: "Обмен ключами DH"

---
# Обмен ключами DH

Обмен ключами Диффи-Хеллмана — это трехэтапное рукопожатие, которое устанавливает общий 256-байтовый `auth_key` между клиентом и сервером Telegram. GoyGram полностью реализует это на Python, а Rust выполняет только расшифровку AES-IGE ответа DH.

## Обзор


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


## Шаг 1. Запросить факторизацию PQ


```python
nonce = secrets.token_bytes(16)
res = await self.invoke_unencrypted(self.codec.req_pq_multi(nonce))
```


**Запрос**: `req_pq_multi#be7e8ef1 nonce:int128`

**Ответ**: `resPQ#05162463 nonce:int128 server_nonce:int128 pq:bytes server_public_key_fingerprints:Vector<long>`

При получении GoyGram:
1. Проверяет совпадения `nonce` (предотвращает повторное воспроизведение)
2. Извлекает `server_nonce` (сохраните на будущее)
3. Извлекает `pq` (произведение двух простых чисел, факторизованное с помощью Ро Полларда)
4. Извлекает `fingerprints` (список известных идентификаторов открытых ключей RSA).

## Факторизация Ро Полларда


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


Стандартный алгоритм Ро Полларда с обнаружением цикла Флойда (черепаха и заяц). Число `pq` обычно составляет ~512 бит — Rho Полларда обрабатывает это за микросекунды.

## Шаг 2: Выбор ключа RSA

GoyGram сверяет `fingerprints` со своим жестко запрограммированным реестром ключей Telegram RSA:


```python
fp = next((x for x in fps if x in TELEGRAM_RSA_KEYS), None)
if fp is None:
    raise RuntimeError(f"no known Telegram RSA key fingerprint in resPQ: {fps!r}")
```


В `vendor/tl_core.py` под `TELEGRAM_RSA_KEYS` имеется 8 жестко запрограммированных 2048-битных открытых ключей RSA. Каждый из них отображает 64-битный отпечаток пальца в 2048-битный модуль. Полный список см. в [Реестр открытых ключей RSA](RSA-Public-Key-Registry).

## Шаг 3. Зашифруйте p_q_inner_data


```python
p, q = sorted(factorize(int.from_bytes(pq, 'big')))
new_nonce = secrets.token_bytes(32)

inner = self.codec.p_q_inner_data(
    pq=pq, p=p.to_bytes(4, 'big'), q=q.to_bytes(4, 'big'),
    nonce=nonce, server_nonce=server_nonce, new_nonce=new_nonce
)

enc = rsa_pad_encrypt(inner, n_mod, e=65537)
```


**Заполнение RSA** (`rsa_pad_encrypt`):

```python
def rsa_pad_encrypt(data, n, e):
    d = sha1(data).digest() + data           # SHA1 hash + data
    d += secrets.token_bytes(255 - len(d))    # random padding to 255 bytes
    return pow(int.from_bytes(d, 'big'), e, n).to_bytes(256, 'big')
```


Результат размером 256 байт отправляется в `req_DH_params`:


```python
await self.invoke_unencrypted(self.codec.req_dh_params(
    nonce=nonce, server_nonce=server_nonce,
    p=p.to_bytes(4, 'big'), q=q.to_bytes(4, 'big'),
    fp=fp, encrypted_data=enc
))
```


## Шаг 4: Расшифруйте ответ DH

Сервер отвечает `server_DH_params_ok#d0e8075c`, содержащим `encrypted_answer`. Он расшифровывается с помощью AES-256-IGE с использованием **временного ключа**, полученного из `new_nonce` и `server_nonce`:


```python
tmp_key, tmp_iv = kdf(new_nonce, server_nonce)
# kdf: SHA1-based key derivation
# key = SHA1(new_nonce + server_nonce) + SHA1(server_nonce + new_nonce)[:12]
# iv  = SHA1(server_nonce + new_nonce)[12:20] + SHA1(new_nonce + new_nonce) + new_nonce[:4]

dec = bytes(rx.aes_ige_dec_raw(encrypted_answer, tmp_key, tmp_iv))
answer = dec[20:]  # strip 20-byte padding prefix (SHA1 hash)
```


Ответ содержит `server_DH_inner_data#b5890dba`:

```
nonce: int128
server_nonce: int128
g: int32                  # generator (typically 3)
dh_prime: bytes           # Diffie-Hellman prime
g_a: bytes                # g^a mod dh_prime (server's public key)
server_time: int32
```


## Шаг 5: Вычисление общего ключа


```python
b = int.from_bytes(secrets.token_bytes(256), 'big')  # random 2048-bit value
g_b = pow(g, b, dh_prime).to_bytes(256, 'big')       # client's public key

self.auth_key = pow(g_a, b, dh_prime).to_bytes(256, 'big')  # shared secret

self.server_salt = bytes(a ^ b for a, b in zip(new_nonce[:8], server_nonce[:8]))
```


## Шаг 6: Подтвердите

Отправьте `set_client_DH_params` с клиентским `g_b`, зашифрованным тем же временным ключом:


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


Сервер отвечает `dh_gen_ok#3bcbf734`, `dh_gen_retry` или `dh_gen_fail`. В случае успеха устанавливается событие `auth_ready` и начинается зашифрованная связь.

## Рэнд против секретов

Все случайные значения используют `secrets.token_bytes()` (os.urandom) — криптографически безопасный источник случайных чисел. В пути кода DH не используется модуль `random`. Это очень важно: слабый случайный `b` может поставить под угрозу сеансовый ключ.