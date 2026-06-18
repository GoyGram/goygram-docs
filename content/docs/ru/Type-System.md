---
title: "Тип системы"
---

# Тип системы

GoyGram использует Python `__slots__` для хранения полей с нулевыми издержками во всех основных объектах событий. Это исключает `__dict__`, экономя память при высокопроизводительной обработке событий.

## Основные объекты событий

### MsgObj

Представляет входящее сообщение от любого транспорта.


```python
class MsgObj:
    __slots__ = ("src", "raw", "app", "id", "chat_id", "from_id",
                 "text", "is_me", "cmd", "args", "match", "finds", "parts")
```


| Поле | Тип | Описание |
|-------|------|-------------|
| `src` | `str` | `"bot"` или `"mt"` |
| `raw` | `dict` | Исходное нормализованное описание событий |
| `app` | `AppCore` | Справочник по времени выполнения |
| `id` / `msg_id` | `int\|None` | Идентификатор сообщения |
| `chat_id` | `int\|str\|None` | Идентификатор чата/точки |
| `from_id` | `int\|None` | Идентификатор пользователя отправителя |
| `text` | `str` | Текст сообщения (всегда строка) |
| `is_me` | `bool` | С текущего счета? |
| `cmd` | `str\|None` | Соответствующее имя команды (устанавливается фильтром `command`) |
| `args` | `str\|None` | Аргументы команды (задаются фильтром `command`) |
| `match` | `re.Match\|None` | Объект соответствия регулярному выражению (устанавливается `regex`, `fullmatch`) |
| `finds` | `list\|None` | Результаты поиска регулярных выражений (устанавливаются `findall`, `finditer`) |
| `parts` | `list[str]\|None` | Разделить результаты (устанавливается фильтром `split`) |

`cmd`, `args`, `match`, `finds` и `parts` устанавливаются классами фильтров через `object.__setattr__` во время оценки фильтра — они переносят результаты фильтра в код обработчика.

Методы: `reply()`, `delete()`, `net()`, `_resolve_peer()`.

### CbObj

События запроса обратного вызова с помощью встроенных кнопок клавиатуры.


```python
class CbObj:
    __slots__ = ("src", "raw", "app", "id", "chat_id", "from_id",
                 "msg_id", "data", "text", "match", "payload", "json_data")
```


| Поле | Тип | Описание |
|-------|------|-------------|
| `id` | `str\|None` | Идентификатор запроса обратного вызова (из `query_id` или `id`) |
| `chat_id` | `int\|str\|None` | Идентификатор исходного чата |
| `from_id` | `int\|None` | Пользователь, нажавший кнопку |
| `msg_id` | `int\|None` | Идентификатор сообщения с помощью клавиатуры |
| `data` | `str` | `callback_data` с кнопки |
| `text` | `str` | Текст или подпись исходного сообщения |
| `match` | `re.Match\|None` | Соответствие регулярному выражению (устанавливается фильтром `cb_regex`) |
| `payload` | `tuple\|None` | Разобранная полезная нагрузка (устанавливается фильтром `cb_payload`) |
| `json_data` | `Any\|None` | Разобранный JSON (устанавливается фильтром `cb_json`) |

Методы: `answer()`, `edit()`.

### Объект опроса

События обновления опроса.


```python
class PollObj:
    __slots__ = ("src", "raw", "app", "id", "question", "closed", "kind")
```


| Поле | Тип | Описание |
|-------|------|-------------|
| `id` | `str\|int\|None` | Идентификатор опроса |
| `question` | `str` | Текст вопроса опроса |
| `closed` | `bool` | Закрыто ли голосование |
| `kind` | `str` | Всегда `"poll"` |

### Объект-член

События изменения статуса участника чата.


```python
class MemberObj:
    __slots__ = ("src", "raw", "app", "chat_id", "from_id",
                 "user_id", "old", "new", "kind")
```


| Поле | Тип | Описание |
|-------|------|-------------|
| `chat_id` | `int\|None` | Чат, где произошло изменение |
| `from_id` | `int\|None` | Пользователь, инициировавший изменение |
| `user_id` | `int\|None` | Затронутый идентификатор пользователя |
| `old` | `str\|None` | Предыдущий статус |
| `new` | `str\|None` | Новый статус |
| `kind` | `str` | Всегда `"member"` |

Значения статуса: `"creator"`, `"administrator"`, `"member"`, `"restricted"`, `"left"`, `"kicked"`.

## Создатель клавиатуры

Все клавиатуры созданы с помощью одного динамического класса `KbdBuilder` без жестко запрограммированных полей кнопок. Доступ осуществляется через фабричные методы `app`:


```python
# Inline keyboard — any button field passes through as-is
kbd = app.ikb().btn("Click", callback_data="act").btn("URL", url="https://...").build()

# Reply keyboard with options
kbd = app.rkb(resize_keyboard=True).btn("Option").build()

# Force reply / remove keyboard
kbd = app.frk(selective=True).build()
kbd = app.rgk(selective=True).build()
```


`.btn(text, **kw)` передает `**kw` непосредственно в кнопку dict — ни одно поле не закодировано жестко. `.row()` запускает новый ряд кнопок. `.build()` (псевдоним `.to_dict()`) возвращает окончательный результат.

Для параметров предварительного просмотра ссылки передайте простой текст:


```python
await msg.reply("text", link_options={"is_disabled": True})
```


Полная ссылка: [Система клавиатуры] (Keyboard-System).

## Типы API ботов

Создано `tools/gen_botapi.py` в `goygram/api/types.py`. Все используют `__slots__` и `to_dict()`:

- `User` — `id`, `is_bot`, `first_name`, `username`
- `Chat` — `id`, `type`, `title`, `username`
- `Message` — `message_id`, `date`, `chat`, `text`

Типы клавиатуры используют `KbdBuilder` вместо жестко запрограммированных классов.

## Помощник `dump()`

Универсальная рекурсивная сериализация, используемая перед кодированием JSON:


```python
def dump(v: Any) -> Any:
    if hasattr(v, "to_dict"):
        return v.to_dict()
    if isinstance(v, list):
        return [dump(x) for x in v]
    if isinstance(v, dict):
        return {k: dump(x) for k, x in v.items() if x is not None}
    return v
```


В словарях со значениями `None` эти ключи удалены, чтобы избежать отправки `null` в API.

## Типы схем TL

Типы MTProto в `goygram/tl/schema.py` расширяют `TlObj`:


```python
class TlObj:
    __slots__ = ()
    cid = 0
    res = ""
    def to_dict(self) -> dict: ...
    def to_bytes(self) -> bytes: ...
```


Рукописные объекты TL: `ResPQ`, `PQInnerData`, `Ping`, `MsgsAck`, `InvokeWithLayer`. Каждый из них имеет жестко запрограммированную сериализацию `cid` и ручную сериализацию `to_bytes()`. Дикт `REG` сопоставляет идентификаторы конструктора с классами для десериализации.

Для динамической сериализации TL во время выполнения расширение `serialize_method()` Rust обрабатывает любой метод, определенный в загруженной схеме `.tl` — для стандартных вызовов MTProto не требуются определения типов на стороне Python.