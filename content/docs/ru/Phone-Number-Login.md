---
title: "Номер телефона Войти"

---
# Номер телефона Войти

Процесс входа в систему по номеру телефона представляет собой традиционную аутентификацию MTProto на основе SMS/кода. Используется, когда вход по QR-коду не выбран или не удается.

## Обзор потока


```
1. User enters API ID + API Hash
2. User enters phone number
3. GoyGram sends auth.sendCode
4. Telegram delivers code via Telegram app/SMS
5. User enters code
6. GoyGram sends auth.signIn
7. On success: session saved to vault
8. If 2FA: prompted for password → auth.checkPassword
9. Auto-handle DC migration at any step
```


## Ввод номера телефона


```python
while True:
    raw_phone = await _ask_non_empty("Phone number (e.g. +1234567890): ")
    try:
        phone = _normalize_phone(raw_phone)
    except ValueError as e:
        # Show error, retry
        continue
```


### Нормализация телефона


```python
def _normalize_phone(raw):
    val = raw.strip()
    compact = re.sub(r"[^\d+]", "", val)

    # Only one '+' allowed
    if compact.count("+") > 1:
        raise ValueError("phone must contain only one '+' prefix")

    # '+' only at the beginning
    if "+" in compact and not compact.startswith("+"):
        raise ValueError("phone '+' is only allowed at the beginning")

    digits = "".join(ch for ch in compact if ch.isdigit())

    # Rules for different formats:
    if compact.startswith("+"):
        # International format: +XXXX...
        return f"+{digits}"

    if len(digits) == 11 and digits.startswith("8"):
        # Russian format: 8XXXXXXXXXX → +7XXXXXXXXXX
        return f"+7{digits[1:]}"

    if len(digits) == 10:
        # 10 digits → +1XXXXXXXXXX (US)
        return f"+1{digits}"

    if len(digits) == 11 and digits.startswith("1"):
        # US format without +: 1XXXXXXXXXX → +1XXXXXXXXXX
        return f"+{digits}"

    # Bare digits → prefix with +
    return f"+{digits}"
```


Проверка длины: 8–15 цифр для международных номеров.

## Отправка кода


```python
sent = await _mt_req_with_migrate(app, "auth_send_code",
    phone=phone, api_id=api_id, api_hash=api_hash
)
```


Это вызывает `auth.sendCode` через MTProto. Ответ включает `phone_code_hash`, необходимый для входа в систему.

## Проверка кода


```python
sign = await _mt_req_with_migrate(app, "auth_sign_in",
    phone=phone, code=code,
    phone_code_hash=phone_code_hash,
    api_id=api_id, api_hash=api_hash
)
```


Обработка ошибок:
- `PHONE_CODE_INVALID` / `CODE_INVALID` → Повторный запрос кода
- `SESSION_PASSWORD_NEEDED` → Запустить поток 2FA (см. [Пароль 2FA / SRP](2FA-SRP-Пароль))

## Успех

При успешной аутентификации ответ анализируется на предмет:


```python
user = _extract_user(final)        # User dict with id, first_name, etc.
auth_blob = _extract_auth_blob(final)  # 256-byte auth key

payload = {
    "phone": phone,
    "user": user,
    "auth_key": auth_blob.hex(),
    "dc": _field(final, "dc_id", "dc"),
    "api_id": api_id,
    "api_hash": api_hash,
}
_write_vault(vault, payload, session_name)
```


В хранилище пишется сразу. `self_id` установлен как для `AppCore`, так и для `MTNet`.

## Извлечение пользователя


```python
def _extract_user(obj):
    user = _field(obj, "user", "me")  # check "user" or "me" keys
    if isinstance(user, dict):
        uid = user.get("id") or user.get("user_id", 0)
        if uid and uid != 0:
            return user
        if user.get("first_name") and user.get("first_name") not in ("Parse Error", "Unknown"):
            return user
    # Check if the object itself is a User constructor
    if str(_field(obj, "kind", "type", "_", "constructor") or "").lower() == "user":
        return obj
    return None
```


Обрабатывает как вложенные пользовательские объекты (`auth.authorization` внедряет пользователя), так и автономные конструкторы User TL.

## Повторить логику

До 5 повторов номера телефона. Если все не удается, цикл телефонного номера завершается и возвращает `None` — вызывающий абонент может перезапустить весь процесс аутентификации или вернуться к входу в систему по QR.