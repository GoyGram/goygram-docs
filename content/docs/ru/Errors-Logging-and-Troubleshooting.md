---
title: "Errors Logging and Troubleshooting"
---

# Ошибки, ведение журнала и устранение неполадок

GoyGram предоставляет Telegram и транспортные исключения из `goygram.errors`, включая `GoyError`, `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `FloodWait`, `ServerError`, `NetworkError`, `MTProtoError`, `TLSerializationError` и `TLDeserializationError`.


```python
from goygram.errors import FloodWait

try:
    await app.send_message(chat_id=123, text="Hello")
except FloodWait as exc:
    await asyncio.sleep(exc.retry_after or 1)
```


## Общие проверки

- Подтвердите установленную версию пакета и путь импорта после обновления.
- Оставляйте активным только один опросчик Bot API; GoyGram очищает существующий веб-перехватчик перед опросом.
- Для MTProto убедитесь, что `api_id` и `api_hash` принадлежат учетной записи/приложению и что файл хранилища доступен для записи.
- Если пользовательский бот не получает команды, убедитесь, что процесс все еще выполняется, используйте исходящую команду с `filters.me`, когда это необходимо, и просмотрите полный журнал запуска.
- Не делитесь файлами хранилища, токенами, кодами входа, хэшами API или облачными паролями в журналах или задачах.

GoyGram использует ведение журнала Python. Настройте стандартный модуль `logging` в своем приложении, если вам нужны разные уровни или места назначения.