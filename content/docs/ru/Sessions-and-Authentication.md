---
title: "Сессии и аутентификация"
---

# Сессии и аутентификация

MTProto-сессия хранится в файле `<session_name>.vault`. Если имя не указано, используется `default.vault`.

```python
app = GoyGram(api_id=123456, api_hash="...", session_name="work")
```

При первом запуске GoyGram попросит:

1. номер телефона;
2. код входа из Telegram;
3. пароль облачной двухфакторной защиты, если он включён.

После успешного входа приложение сохраняет сессию и использует её при следующих запусках. Также можно выбрать вход по QR-коду.

## Вход бота (auth.importBotAuthorization)

Бот авторизуется по MTProto, если `bot_token` передан вместе с `api_id`/`api_hash`. Вместо интерактивного входа по телефону или QR-коду GoyGram вызывает `auth.importBotAuthorization`, сохраняет результат в vault и помечает сессию как бота:

```python
app = GoyGram(
    bot_token="123456:ABC_TOKEN",
    api_id=123456,
    api_hash="...",
    session_name="my_bot",
)
```

ID бота становится `app.self_id`, а оба транспорта (Bot API и MTProto) остаются доступны для маршрутизации через `via=`. Если аккаунт бота живёт в другом дата-центре, GoyGram мигрирует автоматически (`USER_MIGRATE_N`).

## Объект Session

У каждого приложения есть `app.session` — один объект `Session`, который одновременно является сессией в памяти, в файле и переносимой зашифрованной строкой:

```python
from goygram import GoyGram, Session

app = GoyGram(api_id=123456, api_hash="...")

# прочитать ID аккаунта и назвать файл по нему (переименование безопасно):
await app.session.save(f"{app.session.self_id}.vault")

# или хранить как зашифрованную переносимую строку:
token = app.session.export_string()   # шифрование AES-256-GCM, привязка к машине
sess = Session.from_string(token)     # восстановление одним вызовом
```

- Свойства: `session.self_id`, `session.is_bot`, `session.auth_key`, `session.server_salt`, `session.dc`.
- Методы: `session.save(path)`, `Session.load(path)`, `session.export_string()`, `Session.from_string(s)`, `session.to_dict()`, `Session.from_dict(...)`.
- `session.suggest_name()` вернёт `f"{self_id}.vault"`, когда ID аккаунта уже известен.

Явно передать существующую сессию можно через `session=`:

```python
app = GoyGram(api_id=..., api_hash=..., session=Session.from_string(token))
app = GoyGram(api_id=..., api_hash=..., session=Session(name="worker_1"))
```

`session_name="..."` остаётся обычной короткой записью для файлового хранилища.

## Защита vault

Vault-файл шифруется алгоритмом AES-256-GCM. Новые хранилища **безопасны к переименованию**: ключ шифрования выводится из идентификатора машины (а не из имени файла), поэтому файл сессии можно назвать или переименовать после входа, не ломая расшифровку. Хранилище записывается с заголовком `GGV2`; старые vault (и миграции `.session`) распознаются и читаются прозрачно.

Vault-файл является секретом. Не отправляйте его в Git, issues или логи. `GOYGRAM_VAULT_KEY` позволяет явно задать ключ vault.

Параметр `proxy` задаёт прокси MTProto. `device_model`, `system_version`, `app_version` и языковые параметры меняют данные устройства, передаваемые Telegram.
