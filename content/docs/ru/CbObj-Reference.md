---
title: "Ссылка на CbObj"

---
# Ссылка на CbObj

`CbObj` переносит события запроса обратного вызова при нажатии встроенных кнопок клавиатуры. Только API ботов.

## Определение класса


```python
class CbObj:
    __slots__ = ("src", "raw", "app", "id", "chat_id", "from_id",
                 "msg_id", "data", "text", "match", "payload", "json_data")

    def __init__(self, src, raw, app):
        self.src = src                    # almost always "bot"
        self.raw = raw                    # original event dict
        self.app = app                    # AppCore reference
        self.id = raw.get("query_id") or raw.get("id")  # callback query ID
        self.chat_id = raw.get("chat_id") # source chat ID
        self.from_id = raw.get("from_id") # user who pressed the button
        self.msg_id = raw.get("msg_id")   # message ID with the keyboard
        self.data = raw.get("data", "")   # callback_data from button
        self.text = raw.get("text", "")   # source message text
        self.match = None                 # set by cb_regex filter
        self.payload = None               # set by cb_payload filter
        self.json_data = None             # set by cb_json filter
```


## Свойства

| Недвижимость | Тип | Описание |
|----------|------|-------------|
| `id` | `str\|None` | Идентификатор запроса обратного вызова (обязательно для `answer`) |
| `chat_id` | `int\|str\|None` | Чат, где живет сообщение с клавиатуры |
| `from_id` | `int\|None` | Пользователь, нажавший кнопку |
| `msg_id` | `int\|None` | Идентификатор сообщения клавиатуры |
| `data` | `str` | `callback_data` значение кнопки |
| `text` | `str` | Текст исходного сообщения или подписи |

## Поля, введенные фильтром

По умолчанию эти поля имеют вид `None` и заполняются фильтрами, специфичными для обратного вызова:

| Поле | Установить | Тип | Описание |
|-------|--------|------|-------------|
| `match` | `cb_regex` | `re.Match\|None` | Соответствие регулярному выражению на `callback_data` |
| `payload` | `cb_payload` | `tuple\|None` | Разобрана полезная нагрузка `action:id:extra` |
| `json_data` | `cb_json` | `Any\|None` | Разобранный JSON из `callback_data` |

### Формат cb_payload

Анализирует формат `action:id:extra`, разделенный двоеточиями:


```python
@app.on_cb(filt=filters.cb_payload("vote", "post_id"))
async def vote_cb(cb):
    # cb.payload == ("vote", "42", None) for callback_data "vote:42"
    action, post_id, extra = cb.payload
    await cb.answer(f"Voted on post {post_id}")
```


### cb_json

Анализирует `callback_data` как JSON:


```python
@app.on_cb(filt=filters.cb_json())
async def json_cb(cb):
    # cb.json_data == {"action": "delete", "id": 42}
    if cb.json_data["action"] == "delete":
        await cb.edit("Deleted")
```


## Методы

### `answer(text=None, alert=False, url=None, cache_time=0)`

Отправьте ответ на запрос обратного вызова. Telegram ожидает, что вы ответите на каждый запрос обратного вызова.


```python
await cb.answer("Got it!")                              # toast
await cb.answer("Error!", alert=True)                   # alert popup
await cb.answer("Open site", url="https://example.com") # open URL
```


### `edit(text, kbd=None, **kw)`

Отредактируйте сообщение, содержащее клавиатуру.


```python
await cb.edit("Updated text")
await cb.edit("New text", kbd=new_keyboard)
```


API бота только через `editMessageText`. Возвращает `None`, если `chat_id` или `msg_id` отсутствует.

## Фильтры обратного вызова

Полная система фильтрации обратных вызовов:


```python
# Exact match
@app.on_cb(filt=filters.cb_data("delete_confirm"))
async def delete_confirm(cb): ...

# Prefix match
@app.on_cb(filt=filters.cb_startswith("page_"))
async def pagination(cb): ...

# Regex
@app.on_cb(filt=filters.cb_regex(r"item_(\d+)"))
async def item_cb(cb):
    item_id = cb.match.group(1)

# Key-value pair format
@app.on_cb(filt=filters.cb_kvp("action", "delete"))
async def delete_action(cb): ...

# From specific user or chat
@app.on_cb(filt=filters.cb_from(OWNER_ID))
async def owner_cb(cb): ...

@app.on_cb(filt=filters.cb_chat(MY_GROUP))
async def group_cb(cb): ...
```


Несколько обработчиков `on_cb` срабатывают в порядке регистрации. Используйте `StopPropagation`, чтобы запретить нижестоящим обработчикам обрабатывать один и тот же обратный вызов.