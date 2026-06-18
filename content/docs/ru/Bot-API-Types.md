---
---

# Типы API ботов

GoyGram включает набор облегченных типизированных оболочек для основных структур данных Bot API в `goygram/api/types.py`. Эти типы используют `__slots__` и предоставляют `to_dict()` для чистой сериализации. Типы клавиатуры обрабатываются динамическим `KbdBuilder` (см. [Keyboard System](Keyboard-System)) — нет жестко запрограммированных классов кнопок.

## Инструмент генерации

`tools/gen_botapi.py` анализирует [core.telegram.org/bots/api](https://core.telegram.org/bots/api) с использованием `HTMLParser` (класс `BotHtml`), извлекая таблицы типов и методов из официальной документации для создания классов Python с `__slots__` и `to_dict()`.


```bash
# Generate from live website
python tools/gen_botapi.py

# Generate from a local JSON schema
python tools/gen_botapi.py --in schema.json
```


## Доступные типы

Текущий набор (из резервной схемы, используемой, когда веб-сайт недоступен):

| Тип | Поля |
|------|--------|
| **Пользователь** | `id`, `is_bot`, `first_name`, `username` |
| **Чат** | `id`, `type`, `title`, `username` |
| **Сообщение** | `message_id`, `date`, `chat`, `text` |

Типы клавиатуры (`InlineKeyboardMarkup`, `ReplyKeyboardMarkup`, `InlineKeyboardButton`, `KeyboardButton`) больше не запрограммированы жестко — вместо этого используйте динамический `KbdBuilder` через `app.ikb()` / `app.rkb()`.

## Структура класса

Каждый тип следует единому шаблону — инициализация, подобная классу данных, с помощью `__slots__`:


```python
class User:
    __slots__ = ('id', 'is_bot', 'first_name', 'username')

    def __init__(self, id: int, is_bot: bool, first_name: str,
                 username: str | None = None) -> None:
        self.id = id
        self.is_bot = is_bot
        self.first_name = first_name
        self.username = username

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": dump(self.id),
            "is_bot": dump(self.is_bot),
            "first_name": dump(self.first_name),
            "username": dump(self.username),
        }
```


## Использование типов


```python
from goygram.api.types import Chat

chat = Chat(id=123456, type="private", username="example")
await app.send_message(chat_id=chat.id, text=f"Hello {chat.username}!")
```


Функция `dump()` рекурсивно преобразует типизированные объекты в простые словари перед сериализацией JSON.

## Резервная схема

Когда парсер не может получить живые типы с веб-сайта (сеть недоступна, структура HTML изменена), встроенная схема `FALLBACK` в `tools/gen_botapi.py` предоставляет минимальный набор типов и методов для основных операций.

## Интеграция с классом BotAPI

Класс `BotAPI` в `api/methods.py` использует динамическую отправку — каждый метод разрешается через `__getattr__` с автоматическим преобразованием Snake_case → CamelCase. Сигнатуры типизированных методов не запрограммированы жестко:


```python
class BotAPI:
    def __getattr__(self, name: str) -> Any:
        async def dyn(**kw: Any) -> Any:
            parts = name.split("_")
            meth = parts[0] + "".join(x[:1].upper() + x[1:] for x in parts[1:])
            return await self.call(meth, **kw)
        return dyn
```


Все параметры проходят через `dump()` перед отправкой в формате JSON в Bot API — это удаляет значения `None` и рекурсивно преобразует типизированные объекты в их словарные представления. Слова клавиатуры из `KbdBuilder.build()` передаются как есть.