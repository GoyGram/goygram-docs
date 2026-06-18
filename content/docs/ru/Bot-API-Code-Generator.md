---
title: "Генератор кода API бота"

---
# Генератор кода API бота

Утилита `tools/gen_botapi.py` генерирует `goygram/api/types.py` и `goygram/api/methods.py` — типизированные классы Python для Bot API.

## Источники данных

1. **Онлайн**: анализ [core.telegram.org/bots/api](https://core.telegram.org/bots/api) через `HTMLParser`
2. **Локальный файл**: `--in schema.json` (JSON с ключами `types` и `methods`)
3. **Резервный**: встроенная схема `FALLBACK` с базовыми типами.

## Парсер: BotHtml

Класс `BotHtml(HTMLParser)` ищет разделы с заголовками `<h4>` (имена типов/методов), за которыми следуют элементы `<table>` (поля/параметры):


```python
class BotHtml(HTMLParser):
    def handle_starttag(self, tag, attrs):
        if tag == "h4":
            self.in_h4 = True       # start collecting name
        elif tag == "table":
            self.in_table = True    # start collecting table

    def flush(self):
        # Distinguish parameter tables from field tables by headers:
        if "parameter" in headers:
            # This is a method → self.methods.append(...)
        if "field" in headers:
            # This is a type → self.types.append(...)
```


## Преобразование типа

Функция `py_t()` преобразует нотацию Telegram в аннотации Python:


```python
def py_t(tp: str, opt: bool = False) -> str:
    raw = tp.replace("Integer", "int").replace("String", "str") \
            .replace("Boolean", "bool").replace("Float", "float") \
            .replace("Array of ", "list[")
    raw = raw.replace(" or ", "|").replace("InputFile", "bytes|str") \
             .replace("Object", "dict[str,Any]")
    if opt and "None" not in raw:
        raw = f"{raw}|None"
    return raw or "Any"
```


Имена полей преобразуются в Snake_case:


```python
def snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()
```


## типы.py Генерация


```python
def gen_types(spec) -> str:
    for tp in spec["types"]:
        name = tp["name"]
        fields = tp.get("fields", [])
        # Generates:
        # class {name}:
        #     __slots__ = (...)
        #     def __init__(self, ...): ...
        #     def to_dict(self) -> dict[str, Any]: ...
```


## методы.py Генерация


```python
def gen_methods(spec) -> str:
    out = [..., "class BotAPI:", ...]
    for m in spec["methods"]:
        py_name = snake(m["name"])
        # Generates:
        # async def send_message(self, chat_id, text, ...) -> Message:
        #     data = {}
        #     if chat_id is not None: data["chat_id"] = dump(chat_id)
        #     ...
        #     return await self.net.req("sendMessage", data)
```


Плюс динамический `__getattr__`:


```python
def __getattr__(self, name: str) -> Any:
    async def dyn(**kw: Any) -> Any:
        parts = name.split("_")
        meth = parts[0] + "".join(x[:1].upper() + x[1:] for x in parts[1:])
        return await self.call(meth, **kw)
    return dyn
```


## FALLBACK-схема

Используется, когда:
- Сеть недоступна
- Структура страницы изменилась, и парсер не смог извлечь данные.
- Произошла любая другая ошибка загрузки.

Содержит минимальный набор: `User`, `Chat`, `InlineKeyboardButton`, `InlineKeyboardMarkup`, `KeyboardButton`, `ReplyKeyboardMarkup`, `Message` + методы `getMe`, `sendMessage`, `editMessageText`, `deleteMessage`.

## Бег


```bash
python tools/gen_botapi.py                     # from core.telegram.org
python tools/gen_botapi.py --in schema.json    # from JSON
python tools/gen_botapi.py --out custom/api/   # custom output path
```