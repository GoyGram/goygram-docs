---
---

# Система регистрации

GoyGram использует встроенный модуль Python `logging` с одной переменной среды для настройки.

## Конфигурация


```bash
# Set log level via environment variable
GOYGRAM_LOG=DEBUG python app.py    # verbose
GOYGRAM_LOG=INFO python app.py     # default
GOYGRAM_LOG=WARNING python app.py  # quiet  
GOYGRAM_LOG=ERROR python app.py    # errors only
```


## Иерархия регистраторов

| Имя регистратора | Компонент |
|-------------|-----------|
| `goygram.app` | `AppCore` — запуск, завершение работы, статус транспортировки |
| `goygram.botapi` | `BotNet` — HTTP-запросы, ошибки опроса |
| `goygram.mtproto` | `MTNet` — TCP-соединения, шифрование, отладка пакетов |
| `goygram.disp` | `Disp` — ошибки обработчика |
| `goygram.security` | Модуль `security` — операции с хранилищем, поток аутентификации |
| `goygram.dc` | `GoyGram.__init__` — решения о маршрутизации постоянного тока |

## Формат


```
2026-05-21 18:45:12,345 | INFO | goygram.app | Starting GoyGram core.
2026-05-21 18:45:12,456 | INFO | goygram.app | Bot transport is enabled.
2026-05-21 18:45:12,567 | INFO | goygram.app | MT transport is enabled.
2026-05-21 18:45:12,678 | INFO | goygram.security | Vault default.vault detected. Session restored.
```


Формат: `%(asctime)s | %(levelname)s | %(name)s | %(message)s`

## Реализация


```python
def get_logger(name="goygram"):
    level_name = os.getenv("GOYGRAM_LOG", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(level=level, format=...)
    logger = logging.getLogger(name)
    logger.setLevel(level)
    return logger
```


`basicConfig` вызывается каждый раз при вызове `get_logger`, но `logging.basicConfig` не работает после первого вызова — вступает в силу только конфигурация первого регистратора.

## Ведение журнала пакетов отладки

Когда `GOYGRAM_LOG=DEBUG`, MTProto регистрирует каждый пакет:


```
[TX] >>> 4500000014...  (hex dump of outgoing encrypted packet)
[RX] <<< 5000000020...  (hex dump of incoming encrypted packet)
```


Это очень многословно — один цикл `getUpdates` создает сотни строк. Используйте экономно.

## Регистрация ошибок

Диспетчер регистрирует сбои обработчика:


```python
for fn in list(self.app.hook):
    try:
        await fn(msg)
    except Exception as e:
        self.log.error("Handler failure: %r", e)
```


Также регистрируются транспортные ошибки:


```python
# BotNet
self.log.error("Polling error: %r", e)

# MTNet  
log.warning("bad_server_salt handler error: %r", exc)
log.warning("Vault %s decrypt failed (%r)", path.name, e)
```


## Программный доступ

Стандартное ведение журнала Python — вы можете добавлять обработчики, фильтры, форматтеры:


```python
import logging

# Add file handler
fh = logging.FileHandler("goygram.log")
fh.setLevel(logging.DEBUG)
logging.getLogger("goygram").addHandler(fh)

# Add custom handler
logging.getLogger("goygram.mtproto").addHandler(my_handler)
```