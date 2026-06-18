---
title: "Интерактивный процесс аутентификации"

---
# Интерактивный процесс аутентификации

Когда `bootstrap_session()` не может найти действительный файл `.vault` и не существует файла `.session` для миграции, GoyGram запускает интерактивный поток авторизации на терминале. Это полный опыт входа в систему — ввод номера телефона, проверка кода, дополнительный 2FA и сканирование QR-кода.

## Точка входа: `bootstrap_session()`


```python
async def bootstrap_session(app, api_id, api_hash, session_name="default"):
    vault = Path(f"{session_name}.vault")

    # Step 1: Check for existing vault
    if vault.exists() and vault.stat().st_size > 0:
        data = _read_vault(vault, session_name)
        # Restore auth_key and DC into MTNet
        app.mt.auth_key = _extract_auth_blob({"auth_key": data["auth_key"]})
        # ... restore dc, user, etc.
        return {"source": "vault"}

    # Step 2: Check for legacy .session file
    sess = Path(f"{session_name}.session")
    if sess.exists():
        # Migrate from SQLite .session → .vault
        return {"source": "session_migrated"}

    # Step 3: No stored session — launch interactive auth
    return await _mt_auth_flow(app, vault, session_name, api_id, api_hash)
```


## Пользовательский интерфейс процесса входа в систему

GoyGram использует **Rich** для улучшенного пользовательского интерфейса в интерактивном режиме (обнаружен TTY), а для неинтерактивных сред возвращается к простому `input()`/`getpass()`.

### Интерактивное обнаружение


```python
def _is_interactive() -> bool:
    return sys.stdout.isatty() and sys.stdin.isatty()
```


### Богатое меню

В интерактивном режиме используется пользовательское меню терминала Rich:


```python
def _rich_menu_sync(title, options):
    console = Console()
    console.print(f"\n[bold cyan]? {title}[/bold cyan]")
    # Arrow-key navigation with termios raw mode
    # Visual selection with green highlight
    # Returns selected index
```


Меню использует **режим терминала** через `termios.tcgetattr`/`tcsetattr`:
- Клавиши со стрелками перемещаются (↑↓ или ←→).
- Enter подтверждает выбор
- Визуальная подсветка с помощью escape-кодов ANSI (`\033[32m\033[1m`).

### Ввод пароля


```python
def _rich_password_input_sync(prompt_text):
    # Raw terminal mode
    # Echo '*' characters as user types
    # Backspace handling
    # Returns plaintext password string
```


## Этапы аутентификации

### 1. Выберите метод


```
? Choose login method:
  > QR Code Login
    Phone Number Login
```


Пользователь выбирает QR-скан или номер телефона. По умолчанию в TTY: сначала QR.

###2А. Ввод номера телефона


```
Phone number (e.g. +1234567890): +79001234567
```


**Нормализация телефона** (`_normalize_phone`):
- Удаляет все нецифровые символы, кроме `+`.
- Обеспечивает только один `+` в начале.
- Проверка длины: 8–15 цифр (международные) или определенные местные форматы.
- Русский 11-значный код, начинающийся с `8` → автоматически конвертируется в `+7`

###2Б. Вход по QR-коду

Поток QR использует методы `auth.exportLoginToken`/`auth.importLoginToken` MTProto:

1. Экспортируйте токен входа из соединения MTProto.
2. Отобразите QR-код в терминале (ASCII-изображение через библиотеку `qrcode`).
3. Опрос в цикле до тех пор, пока не будет проверен или истечет срок действия.
4. При сканировании: получите `loginTokenSuccess` с данными пользователя и ключом авторизации.
5. Обработка 2FA, если возвращается `SESSION_PASSWORD_NEEDED`.
6. Обработка миграции DC, если возвращается `loginTokenMigrateTo`.

### 3. Ввод кода


```
Code sent. Enter the code from Telegram/SMS.
Code: 12345
```


Код проверяется через `auth.signIn`. Если неверно, пользователю будет предложено еще раз.

### 4. 2FA (если включена)

Если в учетной записи есть 2FA, платформа обнаруживает `SESSION_PASSWORD_NEEDED` в ответе:


```python
if "SESSION_PASSWORD_NEEDED" in sign_err:
    pwd = await _ask_non_empty("2FA password: ", is_password=True)
    check = await _mt_req_with_migrate(app, "auth_check_password", password=pwd, ...)
```


Поток SRP (безопасный удаленный пароль) обрабатывается автоматически — см. [Пароль 2FA / SRP](2FA-SRP-Пароль).

### 5. Успех


```
Success! Session saved to default.vault
```


В хранилище написано:
- Номер телефона
- Информация о пользователе
- Ключ аутентификации (256 байт в шестнадцатеричном формате)
- номер постоянного тока
- Идентификатор API и хеш API

`self_id` устанавливается как для `AppCore`, так и для `MTNet` из идентификатора пользователя в ответе.

## Восстановление ошибок

- **`PHONE_CODE_INVALID`**: запрос кода еще раз.
- **`SESSION_PASSWORD_NEEDED`**: запрос пароля 2FA.
- **`*_MIGRATE_*`**: автоматически выполните миграцию на правильный контроллер домена и повторите попытку.
- **5 последовательных неудачных попыток повтора звонка** → выйти из потока телефонных номеров, вернуть `None` (вызывающий абонент может перезапустить)
- **Срок действия QR-токена** → повторно создать новый QR-код (бесконечный цикл до успеха)

## Неинтерактивный режим

Если стандартный ввод не является TTY (конвейерный ввод, автономный сервер), поток возвращается к:


```python
input(prompt)       # plain input()
getpass.getpass()   # password input (no echo)
print(text)         # plain text output
```


Нет расширенного форматирования, нет меню со стрелками. Функционально, но менее красиво.

## Миграция DC во время аутентификации

В потоке аутентификации используется `_mt_req_with_migrate()`, который автоматически обрабатывает ошибки `PHONE_MIGRATE_X` / `NETWORK_MIGRATE_X`:


```python
async def _mt_req_with_migrate(app, act, **kw):
    while True:
        res = await app.mt_req(act, **kw)
        err = _extract_error(res) or ""
        dc_id = _extract_migrate_dc(err)
        if dc_id is None:
            return res
        # Close current connection
        await app.mt.close()
        # Reconnect to the correct DC
        endpoint = pick_dc_endpoint(dc_map, preferred_dc=dc_id)
        app.mt.host = endpoint.host
        app.mt.port = endpoint.port
        # Reset auth state
        app.mt.auth_key = None
        app.mt._init_done = False
        app.mt.session_id = secrets.token_bytes(8)
        # Reboot and retry
        await app.mt.boot()
        await app.mt.ensure_auth_key()
```


Это означает, что если вы регистрируетесь с DC, который не обслуживает ваш номер телефона, GoyGram автоматически повторно подключается к нужному DC и повторяет запрос — совершенно незаметно для пользователя.