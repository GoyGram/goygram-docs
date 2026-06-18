---
---

# Ссылка на MsgObj

`MsgObj` оборачивает входящие сообщения как от Bot API, так и от транспорта MTProto. Каждый обработчик `on_msg` получает его.

## Определение класса


```python
class MsgObj:
    __slots__ = ("src", "raw", "app", "id", "chat_id", "from_id",
                 "text", "is_me", "cmd", "args", "match", "finds", "parts")

    def __init__(self, src, raw, app):
        self.src = src                     # "bot" or "mt"
        self.raw = raw                     # original normalized event dict
        self.app = app                     # AppCore reference
        self.id = raw.get("msg_id")        # message ID
        self.chat_id = raw.get("chat_id")  # chat/channel/user ID
        self.from_id = raw.get("from_id")  # sender user ID
        self.text = str(raw.get("text", "")) # message text (always string)
        self.is_me = bool(raw.get("is_me", False))  # from current account?
        self.cmd = None                    # set by command filter
        self.args = None                   # set by command filter
        self.match = None                  # set by regex/fullmatch
        self.finds = None                  # set by findall/finditer
        self.parts = None                  # set by split filter
```


## Свойства

| Недвижимость | Тип | Описание |
|----------|------|-------------|
| `msg_id` | `int\|None` | Псевдоним для `id` |
| `src` | `str` | `"bot"` или `"mt"` — источник транспорта |
| `chat_id` | `int\|str\|None` | Идентификатор целевого чата |
| `from_id` | `int\|None` | Идентификатор пользователя отправителя |
| `text` | `str` | Текст сообщения (пустая строка, если нет текста) |
| `is_me` | `bool` | True, если сообщение отправлено с текущего аккаунта |
| `raw` | `dict` | Необработанный нормализованный словарь событий |
| `app` | `AppCore` | Внутренняя ссылка на приложение |

## Поля, введенные фильтром

Эти поля начинаются с `None` и заполняются определенными классами фильтров во время отправки обработчика:

| Поле | Установить | Тип | Описание |
|-------|--------|------|-------------|
| `cmd` | `command` фильтр | `str\|None` | Соответствующее имя команды |
| `args` | `command` фильтр | `str\|None` | Все после команды |
| `match` | `regex`, `fullmatch` | `re.Match\|None` | Объект соответствия регулярному выражению |
| `finds` | `findall`, `finditer` | `list\|None` | Все результаты совпадений регулярных выражений |
| `parts` | `split` | `list[str]\|None` | Разбиение текста по регулярному выражению |


```python
@app.on_cmd("greet")
async def greet(msg):
    # msg.cmd == "greet"
    # msg.args == "extra text here"
    name = msg.args.strip() or "World"
    await msg.reply(f"Hello, {name}!")

@app.on_msg(filt=filters.regex(r"bug #(\d+)"))
async def bug_ref(msg):
    # msg.match.group(1) == "42" for "bug #42"
    bug_id = msg.match.group(1)
    await msg.reply(f"Bug #{bug_id} referenced")
```


## Методы

### `reply(text, kbd=None, topic_id=None, link_options=None, **kw)`

Ответ на сообщение. Автоматически использует тот же транспорт, из которого пришло сообщение.


```python
await msg.reply("Hello back")
await msg.reply("With keyboard", kbd=my_kbd)
await msg.reply("Click here", link_options={"is_disabled": True})
```


Для Bot API: обертывается в `reply_parameters`. Для MTProto: строит `inputReplyToMessage`. Возвращает результат вызова транспорта.

### `delete()`

Удалите это сообщение.


```python
await msg.delete()
```


Возвращает `None`, если `chat_id` или `msg_id` отсутствует. Использует API бота `deleteMessage` или MTProto `messages.deleteMessages`.

### `net()`

Возвращает экземпляр транспорта для источника этого сообщения.

### `_resolve_peer(chat_id)`

Внутренний. Разрешает идентификатор чата одноранговому конструктору MTProto: положительный → `inputPeerUser`, отрицательный выше -1T → `inputPeerChat`, отрицательный ниже -1T → `inputPeerChannel`.

## Источник событий

Поле `src` следует за сообщением по конвейеру:


```
BotNet.spin() → bus.push("bot", data) → MsgObj(src="bot")
MTNet.spin() → bus.push("mt", data)  → MsgObj(src="mt")
```


## Примечания к памяти

`__slots__` — нет `__dict__`. Дикт `raw` хранится по ссылке, предоставляя доступ к полным исходным данным событий для полей, специфичных для транспорта.