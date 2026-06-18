---
---

# Получение ключа хранилища

Ключ шифрования хранилища извлекается из данных, специфичных для машины, с использованием PBKDF2 с 600 000 итераций. На этой странице описан полный конвейер деривации.

## Конвейер деривации


```python
def _derive_vault_key(session_name, salt=None):
    # 1. Check for explicit key override
    env_key = os.getenv("GOYGRAM_VAULT_KEY", "").strip()
    if env_key:
        key = base64.b64decode(env_key)
        if len(key) == 32:
            return key, salt or b"\x00" * 16

    # 2. Generate salt if not provided
    if salt is None:
        salt = secrets.token_bytes(16)

    # 3. Build key material
    material = f"{_get_machine_id()}:{session_name}".encode()

    # 4. Derive key via PBKDF2
    key = hashlib.pbkdf2_hmac("sha256", material, salt, 600000, dklen=32)

    return key, salt
```


## Разрешение идентификатора машины


```python
def _get_machine_id():
    # Priority 1: systemd machine-id
    for p in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
        try:
            return Path(p).read_text().strip()
        except Exception:
            continue

    # Priority 2: hostname
    try:
        return platform.node() or "unknown"
    except Exception:
        return "unknown"
```


Идентификатор машины привязывает хранилище к конкретной машине. Копирование файла `.vault` на другой хост не сработает, поскольку идентификатор машины отличается → ключ отличается → расшифровка не удалась.

## Параметры шифрования

| Параметр | Значение | Обоснование |
|-----------|-------|-----------|
| Хэш-функция | ША-256 | Стандарт для PBKDF2 |
| Итерации | 600 000 | ~0,5 с на современном оборудовании, что обходится слишком дорого |
| Длина ключа | 32 байта | АЭС-256 |
| Длина соли | 16 байт | 128 бит случайности |
| Ключевой материал | `f"{machine_id}:{session_name}"` | Привязывается к машине + сеанс |

## Почему 600 000 итераций?

Рекомендация OWASP для PBKDF2-SHA256 — 600 000 итераций (по состоянию на 2023 год). Это делает атаки грубой силы дорогостоящими, сохраняя при этом приемлемое время расшифровки (~ 0,5 секунды). Поскольку расшифровка хранилища происходит один раз при запуске, это хороший компромисс.

## GOYGRAM_VAULT_KEY Переопределить

Для сред без стабильного идентификатора машины (контейнеры, CI, автономные серверы):


```bash
# Generate a random key
python3 -c "import base64,os; print(base64.b64encode(os.urandom(32)).decode())"

# Set it
export GOYGRAM_VAULT_KEY="base64_encoded_32_bytes_here"
```


Когда эта переменная окружения установлена:
- Производная PBKDF2 **полностью обходится**
- Ключ используется напрямую (должен быть ровно 32 байта после декодирования base64)
- По умолчанию соль имеет значение `b"\x00" * 16` (рандомизация не требуется — ключ ЯВЛЯЕТСЯ секретом)

## Поворот клавиш

Чтобы повторно зашифровать хранилище с помощью нового ключа:
1. Прочитайте старым ключом
2. Удалить старое хранилище.
3. Установите новый `GOYGRAM_VAULT_KEY` (или разрешите изменение идентификатора машины)
4. Запустите приложение → новое хранилище записывается с новым ключом.

Здесь нет явного API ротации ключей — только естественный цикл чтения/записи.

## Модель безопасности


```
Threat: Attacker with filesystem access to the vault file
         but not the machine-id

Protection: PBKDF2 with 600K iterations → ~0.5s per attempt
           → brute-force infeasible without the machine-id

Threat: Attacker with both vault file AND machine-id
         (e.g., full disk image of the host)

Protection: None. The key material is known.
           → Use full disk encryption (LUKS) as defense-in-depth
```