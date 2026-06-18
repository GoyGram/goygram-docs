---
title: "Клиент – Полная справка"

---
# Клиент – Полная справка

Класс `GoyGram` (и его внутренний `AppCore`) предоставляет полный общедоступный API. На этой странице документированы все доступные методы, свойства и ловушки.

## Конструктор


```python
GoyGram(
    bot_token: str | None = None,        # Bot API token
    mt_host: str | None = None,          # MTProto host override
    mt_port: int | None = None,          # MTProto port override
    mt_key: bytes | None = None,         # Pre-existing auth key
    mt_iv: bytes | None = None,          # Pre-existing IV
    bot_timeout: int = 25,               # getUpdates timeout
    bot_base: str = "https://api.telegram.org",
    bus_max: int = 0,                    # Event queue max size (0=unlimited)
    api_id: int | str | None = None,     # MTProto API ID
    api_hash: str | None = None,         # MTProto API hash
    session_name: str = "default",       # Vault file name
    proxy: str | None = None,            # SOCKS5/HTTP proxy URL
    app_name: str | None = None,         # App name for MTProto
    app_version: str | None = None,      # App version for MTProto
    device_model: str | None = None,     # Device model for MTProto
    system_version: str | None = None,   # OS version for MTProto
    system_lang_code: str = "en",
    lang_pack: str = "",
    lang_code: str = "en",
)
```


## Декораторы обработчиков

### `on_msg(fn=None, filt=None)`

Зарегистрируйте обработчик сообщений с дополнительным фильтром.


```python
@app.on_msg()
async def all_msgs(msg): ...

@app.on_msg(filt=filters.text)
async def text_only(msg): ...

@app.on_msg(filt=filters.text & ~filters.me)
async def text_not_me(msg): ...
```


### `on_cb(fn=None, *, filt=None)`

Зарегистрируйте обработчик запроса обратного вызова с дополнительным фильтром.


```python
@app.on_cb()
async def callback_handler(cb):
    await cb.answer("Got it!")
    await cb.edit("Updated text")

@app.on_cb(filt=filters.cb_startswith("page_"))
async def pagination(cb): ...
```


### `on_cmd(*names)`

Зарегистрируйте обработчик команд. Использует фильтр `command` под капотом.


```python
@app.on_cmd("ping")
async def ping(msg): ...

@app.on_cmd("start", "help", "info")
async def multi_cmd(msg): ...
```


### `on_poll(fn=None, *, filt=None)`

Зарегистрируйте обработчик событий опроса.


```python
@app.on_poll()
async def poll_handler(poll):
    print(f"Poll '{poll.question}' closed={poll.closed}")

@app.on_poll(filt=filters.poll_closed)
async def closed_only(poll): ...
```


### `on_member(fn=None, *, filt=None)`

Зарегистрируйте обработчик обновлений участников чата.


```python
@app.on_member()
async def member_handler(member):
    print(f"User {member.user_id} went from {member.old} to {member.new}")
```


### `on_update(fn=None, *, filt=None)`

Зарегистрируйте универсальный обработчик для **любого** типа событий (msg, cb, poll,member). Срабатывает после типизированных обработчиков.


```python
@app.on_update()
async def catch_all(event):
    print(f"Event type: {type(event).__name__}")

@app.on_update(filt=filters.update_type("msg"))
async def msg_catch_all(event): ...
```


## Отправка динамического метода

Каждый метод API бота доступен через `__getattr__`. Snake_case автоматически преобразуется в CamelCase:


```python
await app.send_message(chat_id=..., text=...)           # sendMessage
await app.send_document(chat_id=..., document=...)      # sendDocument
await app.get_chat_administrators(chat_id=...)          # getChatAdministrators
await app.answer_callback_query(callback_query_id=...)  # answerCallbackQuery
```


Методы MTProto через префикс `mt_` с полным пространством имен:


```python
await app.mt_messages_get_dialogs(limit=50)
await app.mt_messages_get_history(peer=..., limit=100)
await app.mt_messages_send_message(peer=..., message="Hello", random_id=...)

# Or use direct mt_req with dotted notation:
await app.mt_req("messages.getDialogs", limit=50)
```


## Основные методы обмена сообщениями

### `send_message(chat_id, text, ...)`

Отправьте сообщение через динамическую отправку Bot API. Преобразование Snake_case → CamelCase применяется автоматически.


```python
await app.send_message(chat_id=123, text="Hello")
await app.send_message(chat_id=123, text="Reply", reply_parameters={"message_id": msg_id})
```


Для MTProto используйте эквивалентный метод MTProto.

### `bot.send_msg(chat_id, text, ...)`

Отправка сообщений нижнего уровня по транспорту BotNet — обрабатывает форматирование `reply_to`, `kbd`, `topic_id` и `link_options`:


```python
await app.bot.send_msg(chat_id, "Hello")
await app.bot.send_msg(chat_id, "Reply", reply_to=msg_id)
await app.bot.send_msg(chat_id, "With keyboard", kbd=my_kbd)
await app.bot.send_msg(chat_id, "In topic", topic_id=thread_id)
await app.bot.send_msg(chat_id, "No preview", link_options={"is_disabled": True})
```


## Методы транспортировки

### `bot_req(method, **kw)`

Прямой вызов API бота. Имя метода CamelCase.


```python
await app.bot_req("sendMessage", chat_id=..., text=...)
await app.bot_req("getChat", chat_id=...)
```


### `mt_req(action, **kw)`

Прямой вызов MTProto. Название действия, выделенное точкой.


```python
await app.mt_req("messages.getDialogs", limit=50)
await app.mt_req("messages.sendMessage", peer=..., message="Hi")
```


### `raw_chat(chat_id)`

Удалить префикс `bot:`/`mt:`, вернуть обычный int или str.


```python
app.raw_chat("bot:123456")  # → 123456
app.raw_chat("mt:-100123")  # → -100123
```


### `via(chat_id, via=None)`

Решите, какой транспорт использовать для идентификатора чата.


```python
app.via("bot:123456")  # → "bot"
app.via(123456)        # → "bot" (if bot configured)
app.via(123456, via="mt")  # → "mt" (forced)
```


## Методы состояний автомата

### `set_state(chat_id, user_id, state, data=None, ttl=None)`

Установите состояние FSM для пары чат+пользователь. Существующие данные объединяются. Синхронный — `await` не требуется.


```python
app.set_state(chat_id, user_id, "waiting_name")
app.set_state(chat_id, user_id, "step2", {"name": "Sam"}, ttl=1800)
```


### `get_state(chat_id, user_id)`

Получить текущее название штата.


```python
state = app.get_state(chat_id, user_id)  # → "waiting_name" or None
```


### `get_state_data(chat_id, user_id)`

Получить данные о состоянии (неполная копия).


```python
data = app.get_state_data(chat_id, user_id)  # → {"name": "Sam"} or None
```


### `clear_state(chat_id, user_id)`

Удалить состояние FSM.


```python
app.clear_state(chat_id, user_id)
```


## Разработчики клавиатур


```python
# Inline keyboard
kbd = app.ikb().btn("Click", callback_data="act").btn("URL", url="https://...").build()

# Reply keyboard
kbd = app.rkb(resize_keyboard=True).btn("Option").build()

# Force reply
kbd = app.frk(selective=True, placeholder="Type...").build()

# Remove keyboard
kbd = app.rgk(selective=True).build()
```


Полную документацию см. в разделе [Система клавиатуры](Система клавиатуры).

## Помощники форматирования


```python
app.html("<b>bold</b> <i>italic</i>")  # → {"text": "...", "parse_mode": "HTML"}
app.md("**bold** *italic*")            # → {"text": "...", "parse_mode": "MarkdownV2"}
```


## Методы жизненного цикла

### `run()`

Запустите приложение. Блокирует до тех пор, пока не остановится.


```python
asyncio.run(app.run())
```


### `stop()`

Отключение сигнала. Устанавливает `stop_ev`.


```python
app.stop()
```


## Самоанализ


```python
app.help()             # pretty DX overview to console
print(dir(app))        # available attributes + dynamic entries
```


### Свойства

- `app.core` — базовый экземпляр `AppCore`.
- `app.core.self_id` — идентификатор пользователя текущей учетной записи.
- `app.core.api_id` / `app.core.api_hash` — учетные данные API
- `app.core.stop_ev` — `asyncio.Event` для сигнализации об отключении
- `app.core.fsm` — экземпляр `FSMEngine`
- `app.core.bus` — экземпляр `Bus`
- `app.core.disp` — экземпляр `Disp`