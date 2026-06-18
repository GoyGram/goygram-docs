---
---

# Разрешение динамического метода

GoyGram позволяет вызывать **любой метод Telegram** без его явного написания кода. `app.send_document(...)`, `app.get_chat(...)`, `app.mt_messages_get_dialogs(...)` — все разрешается с помощью магии `__getattr__` и динамической отправки.

## Как это работает

### Цепочка `__getattr__`

Когда вы пишете `app.send_document(...)`, Python не может найти `send_document` в объекте `GoyGram`. Резервный вариант `__getattr__` называется:


```python
class GoyGram:
    def __getattr__(self, name: str) -> Any:
        return getattr(self.core, name)
```


Какие делегируют `AppCore.__getattr__`:


```python
class AppCore:
    def __getattr__(self, name: str) -> Any:
        # Priority 1: BotAPI dynamic dispatch
        if self.api is not None and hasattr(self.api, name):
            return getattr(self.api, name)

        # Priority 2: mt_ prefix → MTProto
        if name.startswith("mt_") and self.mt is not None:
            return self._dynamic_method(name)

        # Priority 3: Everything else → Bot API
        if not name.startswith("mt_") and not name.startswith("_") \
           and self.bot is not None:
            return self._dynamic_method(name)

        raise AttributeError(name)
```


### Преобразование имени

**Snake_case → CamelCase** (API бота):


```python
def _bot_method_name(self, name: str) -> str:
    if "_" in name:
        parts = name.split("_")
        return parts[0] + "".join(x[:1].upper() + x[1:] for x in parts[1:])
    return name
```


| Вызов Python | Метод API бота |
|-------------|---------------|
| `send_document` | `sendDocument` |
| `get_chat_administrators` | `getChatAdministrators` |
| `sendDocument` (без подчеркивания) | `sendDocument` (сквозной) |

**Snake_case → MTProto namespace.methodName**:


```python
def _mt_method_name(self, name: str) -> str:
    name = name[3:]  # strip "mt_"
    if "." in name:
        return name  # already dotted
    parts = name.split("_")
    if len(parts) < 2:
        return name
    ns = parts[0]
    rest = parts[1:]
    return ns + "." + rest[0] + "".join(
        p[:1].upper() + p[1:] for p in rest[1:]
    )
```


Первый сегмент после `mt_` становится пространством имен, остальные образуют имя метода CamelCase:

| Вызов Python | Действие МТПрото |
|-------------|---------------|
| `mt_messages_get_dialogs` | `messages.getDialogs` |
| `mt_messages_get_history` | `messages.getHistory` |
| `mt_messages_send_message` | `messages.sendMessage` |
| `mt_channels_get_participants` | `channels.getParticipants` |
| `mt_account_update_profile` | `account.updateProfile` |
| `mt_messages.sendMessage` | `messages.sendMessage` (пунктирный переход) |

### Фабрика динамических методов


```python
def _dynamic_method(self, name: str):
    async def call(**kw: Any) -> Any:
        if name.startswith("mt_"):
            return await self.mt_req(self._mt_method_name(name), **kw)
        return await self.bot_req(self._bot_method_name(name), **kw)
    return call
```


Для каждого доступа к атрибуту создается новое асинхронное замыкание — намеренно простое, а не кэшированное.

### Слой BotAPI

`BotAPI` (`api/methods.py`) предоставляет другой уровень разрешения со своим собственным `__getattr__`:


```python
class BotAPI:
    def __getattr__(self, name: str) -> Any:
        async def dyn(**kw: Any) -> Any:
            parts = name.split("_")
            meth = parts[0] + "".join(
                x[:1].upper() + x[1:] for x in parts[1:]
            )
            return await self.call(meth, **kw)
        return dyn
```


Это проверяется только в том случае, если `self.api` не имеет значения None, т. е. когда был предоставлен токен бота и создан `BotAPI(self.bot)`. BotAPI не имеет жестко запрограммированных типизированных методов — каждый вызов проходит через `__getattr__`.

## Трехуровневое разрешение

| Уровень | Механизм | Примеры |
|------|-----------|----------|
| 1. Динамический BotAPI | `BotAPI.__getattr__` | `send_message`, `get_chat`, `edit_message_text` |
| 2. Динамика AppCore (Бот) | `_dynamic_method` → `bot_req` | `sendDocument`, `getChat`, `banChatMember` |
| 3. Динамика AppCore (MT) | `_dynamic_method` → `mt_req` с префиксом `mt_` | `mt_messages_get_dialogs`, `mt_messages_send_message` |

Сначала проверяется уровень 1, затем уровень 2, затем уровень 3. Если ничего не соответствует, выдается `AttributeError`.

## Удобные методы

Определено явно в `AppCore` — всегда доступно через прямой доступ к атрибутам:

| Метод | Описание |
|--------|-------------|
| `help()` | Распечатать обзор разработчиков |
| `stop()` | Отключение сигнала |
| `run()` | Запустить приложение |
| `bot_req(method, **kw)` | Прямой вызов API бота |
| `mt_req(action, **kw)` | Прямой вызов MTProto |
| `raw_chat(chat_id)` | Удалить префикс `bot:`/`mt:` |
| `via(chat_id, via=None)` | Разрешение транспорта для идентификатора чата |
| `ikb()` | Создать встроенный конструктор клавиатуры |
| `rkb(**opts)` | Создать ответ Конструктор клавиатуры |
| `frk(**opts)` | Создание разметки принудительного ответа |
| `rgk(**opts)` | Создать разметку для удаления клавиатуры |
| `html(text)` | Режим анализа HTML dict |
| `md(text)` | Режим анализа MarkdownV2 dict |

### Удобные методы FSM (синхронизация)

| Метод | Описание |
|--------|-------------|
| `set_state(chat_id, user_id, state, data=None, ttl=None)` | Установить состояние FSM |
| `get_state(chat_id, user_id)` → `str\|None` | Получить текущее название штата |
| `get_state_data(chat_id, user_id)` → `dict\|None` | Получить копию государственных данных |
| `clear_state(chat_id, user_id)` | Удалить состояние FSM |

## Сериализация параметров

### API бота (`bot_req`)

Аргументы ключевого слова со значениями `None` удаляются. Объекты с `to_dict()` сериализуются.

### MTProto (`mt_req`)

Аргументы ключевого слова со значениями `None` удаляются. Объекты с `to_dict()` сериализуются. `api_id` и `api_hash` из конфигурации клиента добавляются автоматически, если они не указаны.

## `__dir__` Дополнение


```python
class GoyGram:
    def __dir__(self) -> list[str]:
        return sorted(set(super().__dir__()) | set(dir(self.core)))
```


`dir(app)` показывает объединенный набор атрибутов `GoyGram` и `AppCore`.

## Самоанализ


```python
app.help()                        # pretty DX overview
print(dir(app))                   # all available attributes
from goygram.utils import print_methods
print_methods(app)               # filter catalog + shortcuts
```