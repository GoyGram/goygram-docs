---
title: "Инструменты генерации кода"
---

# Инструменты генерации кода

GoyGram включает в себя два инструмента генерации кода в каталоге `tools/`:

## 1. Генератор API ботов (`tools/gen_botapi.py`)

Собирает [документацию по API Telegram Bot](https://core.telegram.org/bots/api) и генерирует `goygram/api/types.py` и `goygram/api/methods.py`.

### Как это работает

**Источник**: `https://core.telegram.org/bots/api` (страница HTML)

1. Получает HTML-страницу (или читает локальный файл, если указан `--in`).
2. Анализирует заголовки `<h4>` (имена методов/типов).
3. Парсит элементы `<table>` (параметры/поля)
4. Преобразует типы параметров (например, `Integer` → `int`, `String` → `str`, `Boolean` → `bool`).
5. Генерирует классы Python с сериализацией `to_dict()` и `__slots__`.

### Сопоставление типов


```
"Integer" → "int"
"String" → "str"  
"Boolean" → "bool"
"Float" → "float"
"True" → "bool"
"Array of X" → "list[X]"
"X or Y" → "X|Y"
"InputFile|String" → "bytes|str"
```


### Резервная схема

Если веб-сайт не может быть получен, используется жестко закодированная минимальная схема (охватывает пользователя, чат, сообщение, клавиатуру и несколько основных методов).

### Использование


```bash
# Fetch from live docs
python tools/gen_botapi.py

# From local file
python tools/gen_botapi.py --in bot_api.html

# Custom output directory
python tools/gen_botapi.py --out /path/to/output
```


## 2. Генератор схемы MTProto TL (`tools/gen_mtproto.py`)

Генерирует `goygram/tl/schema.py` из схемы TL Telegram.

### Как это работает

Анализирует формат схемы TL:


```
resPQ#05162463 nonce:int128 server_nonce:int128 pq:bytes = ResPQ;
invokeWithLayer#da9b0d0d layer:int query:bytes = X;
---functions---
ping#7abe77ec ping_id:long = Pong;
```


Генерирует:
— Классы Python для каждого конструктора TL (с сериализатором `to_bytes()`)
- Идентификаторы конструктора сопоставления реестра `REG` → классы
- Вспомогательные функции: `enc_val()`, `enc_vec()`, `enc_bytes()`, `enc_str()`.

### Классы конструктора

Каждый конструктор TL становится классом:


```python
class ResPQ(TlObj):
    __slots__ = ('nonce', 'server_nonce', 'pq', 'server_public_key_fingerprints')
    cid = 0x05162463
    res = 'ResPQ'
    
    def to_bytes(self):
        raw = struct.pack("<I", self.cid)
        raw += enc_val("int128", self.nonce)
        raw += enc_val("int128", self.server_nonce)
        raw += enc_val("bytes", self.pq)
        raw += enc_val("Vector<long>", self.server_public_key_fingerprints)
        return raw
```


### Использование


```bash
# From built-in fallback
python tools/gen_mtproto.py

# From local TL schema file
python tools/gen_mtproto.py --in schema.tl

# Custom output directory
python tools/gen_mtproto.py --out /custom/path
```


## Зачем нужна генерация кода?

1. **API ботов развивается**: регулярно добавляются новые методы и типы. Восстановление из действующих документов поддерживает актуальность платформы без обновлений вручную.
2. **Правильно по конструкции**: генератор последовательно обрабатывает преобразование Snake_case, необязательную маркировку и сопоставление типов — без человеческих опечаток.
3. **Типовая безопасность**: созданные классы имеют соответствующие аннотации типов для поддержки IDE.

Сгенерированные файлы сохраняются в репозитории — генераторы являются инструментами обслуживания, а не частью среды выполнения.