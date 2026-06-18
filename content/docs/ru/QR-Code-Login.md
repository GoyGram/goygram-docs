---
---

# QR-код для входа

Для входа по QR-коду используется `auth.exportLoginToken` / `auth.importLoginToken` для авторизации без ввода номера телефона. Пользователь сканирует QR-код с помощью своего основного клиента Telegram.

## Обзор потока


```
1. Export login token via MTProto
2. Encode token as tg://login?token=... URL
3. Display QR code in terminal (ASCII art)
4. Poll auth.exportLoginToken until scanned or expired
5. On scan: receive loginTokenSuccess with user + auth key
6. Handle 2FA if needed (SESSION_PASSWORD_NEEDED)
7. Handle DC migration if needed (loginTokenMigrateTo)
8. Write vault
```


## Шаг 1: Экспорт токена


```python
res = await _mt_req_with_migrate(app, "auth_export_login_token",
    api_id=api_id, api_hash=api_hash, except_ids=[]
)
```


Ответ `loginToken` с:
- `token`: необработанные байты токена входа.
- `expires`: временная метка Unix, когда истекает срок действия токена.

## Шаг 2: Создайте QR-код


```python
token = res["token"]
b64_token = base64.urlsafe_b64encode(token).decode().rstrip("=")
url = f"tg://login?token={b64_token}"

import qrcode, io
qr = qrcode.QRCode()
qr.add_data(url)
f = io.StringIO()
qr.print_ascii(out=f)
qr_output = f.getvalue()
sys.stdout.write(qr_output)
```


Библиотека `qrcode` отображает ASCII-изображения непосредственно на терминале. Если это не удается (нет библиотеки `qrcode`), он возвращается к печати необработанного URL-адреса.

## Шаг 3: Опрос для сканирования


```python
while time.time() < expires:
    await asyncio.wait_for(app.mt.qr_update_ev.wait(),
                          timeout=expires - time.time())

    poll_res = await _mt_req_with_migrate(app, "auth_export_login_token",
        api_id=api_id, api_hash=api_hash, except_ids=[])
```


Событие `qr_update_ev` устанавливается, когда MTProto получает обновление с магическими байтами `0x91e64f56` в зашифрованном теле пакета — это сигнал о прибытии обновления, связанного со сканированием QR. Однако фактическая проверка ответа также опрашивает конечную точку экспорта.

### Типы ответов

| Тип | Значение | Действие |
|------|---------|--------|
| `loginToken` | Все еще жду | Продолжить голосование |
| `loginTokenSuccess` | Отсканировано + подтверждено | Извлечь пользователя + ключ авторизации |
| `loginTokenMigrateTo` | Неправильный округ Колумбия | Перенести соединение, импортировать туда токен |
| Срок действия токена истек | Тайм-аут | Восстановить новый QR-код |

## Шаг 4. Миграция DC во время входа в систему по QR

Если Telegram возвращает `loginTokenMigrateTo`:


```python
dc_id = poll_res["dc_id"]
token_m = poll_res["token"]

# Reconnect to target DC
endpoint = pick_dc_endpoint(dc_map, preferred_dc=dc_id)
await app.mt.close()
app.mt.host = endpoint.host
app.mt.port = endpoint.port
app.mt.auth_key = None
app.mt._init_done = False
app.mt.session_id = secrets.token_bytes(8)
await app.mt.boot()
await app.mt.ensure_auth_key()

# Import the login token on the new DC
mig_res = await _mt_req_with_migrate(app, "auth_import_login_token",
    token=token_m, api_id=api_id)
```


Затем продолжите поток 2FA/успеха из перенесенного ответа.

## Шаг 5: 2FA при входе в систему по QR

Если ответ содержит `SESSION_PASSWORD_NEEDED`:


```python
while True:
    pwd = await _ask_non_empty("2FA password: ", is_password=True)
    check = await _mt_req_with_migrate(app, "auth_check_password",
        password=pwd, api_id=api_id, api_hash=api_hash)

    if not isinstance(check, dict):
        continue  # unexpected response, retry

    check_err = _extract_error(check) or ""
    if check_err:
        continue  # wrong password, retry

    poll_res = check
    poll_res["type"] = "loginTokenSuccess"
    break
```


## Успех


```python
user = _extract_user(final)
auth_blob = _extract_auth_blob(final)

payload = {
    "phone": user.get("phone", ""),
    "user": user,
    "auth_key": auth_blob.hex(),
    "dc": _field(final, "dc_id", "dc") or app.mt.host,
    "api_id": api_id,
    "api_hash": api_hash,
}
_write_vault(vault, payload, session_name)
```


Если `auth_blob` не найден в ответе, он возвращается к `app.mt.auth_key` (который был установлен во время обмена DH).

## Срок действия и повторная попытка

Если срок действия токена истекает до сканирования:


```
Token expired. Regenerating...
```


Новый QR-код генерируется немедленно. Этот цикл продолжается бесконечно, пока пользователь не просканирует или не прервет.