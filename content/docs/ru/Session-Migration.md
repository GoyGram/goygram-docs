---
---

# Миграция сеанса (.session → .vault)

GoyGram может перенести существующие файлы Telethon/Pyrogram `.session` в зашифрованный формат `.vault`. После миграции исходный файл `.session` **безопасно обнуляется и удаляется**.

## Триггер миграции

В `bootstrap_session()`, когда файл `.vault` не существует, платформа проверяет наличие файла `.session`:


```python
sess = Path(f"{session_name}.session")
if sess.exists():
    # Read SQLite session
    conn = sqlite3.connect(str(sess))
    cur = conn.cursor()
    row = cur.execute(
        "SELECT dc_id, auth_key, user_id, api_id, test_mode FROM sessions LIMIT 1"
    ).fetchone()
    # ... extract data ...
    conn.close()

    # Write encrypted vault
    _write_vault(vault, payload, session_name)

    # Destroy source
    _zeroize_and_remove(sess)
    return {"source": "session_migrated"}
```


## Чтение таблиц SQLite

Миграция считывает данные из таблицы `sessions`:


```sql
SELECT dc_id, auth_key, user_id, api_id, test_mode FROM sessions LIMIT 1
```


Если этот запрос не возвращает строк (некоторые форматы сеансов хранят auth_key по-другому), он пытается использовать более простой вариант:


```sql
SELECT dc_id, auth_key FROM sessions LIMIT 1
```


## Извлеченные данные

| Поле | Столбец SQLite | Ключ от хранилища |
|-------|--------------|-----------|
| Идентификатор постоянного тока | `dc_id` (целое) | `"dc"` (целое) |
| Ключ аутентификации | `auth_key` (блоб) | `"auth_key"` (шестнадцатеричная строка) |
| Идентификатор пользователя | `user_id` (целое) | В `"user"` dict |
| Идентификатор API | `api_id` (целое) | `"api_id"` (целое) |
| Тестовый режим | `test_mode` (логическое значение) | `"test_mode"` (логическое значение) |

## Обнуление

Исходный файл `.session` безопасно удален:


```python
def _zeroize_and_remove(path: Path) -> None:
    size = path.stat().st_size
    with path.open("r+b") as f:
        f.write(b"\x00" * size)  # overwrite with zeros
        f.flush()
        os.fsync(f.fileno())     # force to disk
    path.unlink(missing_ok=True) # delete
```


При этом каждый байт перезаписывается с помощью `\x00`, принудительно синхронизируется с диском, а затем отсоединяется файл. Хотя с криминалистической точки зрения он не идеален (выравнивание износа SSD может оставить следы), он предотвращает случайное восстановление.

## Результат миграции

После успешной миграции:
1. Существует файл `.vault` с зашифрованными данными сеанса.
2. Файл `.session` пропал (обнулился + удален)
3. `bootstrap_session()` возвращает `{"source": "session_migrated"}`.
4. При следующей загрузке хранилище обнаруживается, и сеанс восстанавливается в обычном режиме.

## Полезная нагрузка хранилища после миграции


```json
{
    "auth_key": "hex...",
    "dc": 2,
    "user_id": 123456789,
    "api_id": 123456,
    "test_mode": false,
    "source_session": "default.session"
}
```


Поле `source_session` сохраняется для отладки и аудита.

## Обработка ошибок

Если миграция не удалась по какой-либо причине:
- Файл `.session` **не** затронут.
- Записывается предупреждение
- Фреймворк не поддерживает интерактивную аутентификацию.

## Поддерживаемые форматы сеансов

Миграция работает с любой библиотекой Python Telegram, которая хранит сеансы в SQLite с совместимой схемой таблицы `sessions`:
- **Telethon** — полная совместимость (та же схема)
- **Пирограмма** — работает (совместимая схема)
- **Другие хранилища сеансов на основе SQLite** — работает, если существуют столбцы `auth_key`, `dc_id`.