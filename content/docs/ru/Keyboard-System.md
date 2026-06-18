---
title: "Клавиатура"
---

# Система клавиатуры

GoyGram предоставляет встроенные клавиатуры, клавиатуры ответа, принудительный ответ и удаление клавиатуры с помощью одного динамического конструктора — `KbdBuilder`. Нет жестко запрограммированных классов кнопок. Каждое поле передается в API Telegram «как есть».

## Строитель

`KbdBuilder` — универсальный конструктор клавиатуры без жестко запрограммированных полей. Он никогда не импортируется напрямую — доступ к нему осуществляется через экземпляр `app`:

- `app.ikb()` — встроенная клавиатура
- `app.rkb(**opts)` — клавиатура ответа с опциями
- `app.frk(**opts)` — принудительный ответ
- `app.rgk(**opts)` — удалить клавиатуру

## Встроенная клавиатура (`ikb`)


```python
@app.on_cmd("/menu")
async def menu(msg):
    kbd = (
        app.ikb()
        .btn("Click Me", callback_data="btn_click")
        .btn("Google", url="https://google.com")
        .row()
        .btn("Row 2", callback_data="row2")
        .build()
    )
    await msg.reply("Choose:", kbd=kbd)
```


### Утиный ввод — пропустить `.build()`

`KbdBuilder` имеет метод `to_dict()` (псевдоним `build()`), поэтому вы можете передать построитель непосредственно `reply()` без вызова `.build()`:


```python
await msg.reply("Choose:", kbd=app.ikb().btn("Yes", callback_data="yes").btn("No", callback_data="no"))
```


Транспортный уровень автоматически вызывает `to_dict()` при обнаружении метода.

### Поля кнопок

`.btn(text, **kw)` — `**kw` переходит непосредственно в кнопку. Любое поле кнопки Telegram работает:


```python
app.ikb()
    .btn("Click", callback_data="action")       # callback button
    .btn("URL", url="https://example.com")       # URL button
    .btn("Pay", pay=True)                        # payment button
    .btn("Login", login_url={"url": "..."})      # login button
    .btn("Share", switch_inline_query="query")   # inline query switch
    .btn("Contact", request_contact=True)        # request contact
    .btn("Location", request_location=True)      # request location
```


Ни одно поле не закодировано жестко — если Telegram добавит `new_field` завтра, `.btn("Label", new_field=value)` просто будет работать.

### `.row()`

Начинает новый ряд кнопок. Пустые строки автоматически отфильтровываются в `build()`.


```python
kbd = (
    app.ikb()
    .btn("1", callback_data="1")
    .btn("2", callback_data="2")    # both on row 0
    .row()
    .btn("3", callback_data="3")    # row 1
    .build()
)
# → {"inline_keyboard": [[{"text":"1","callback_data":"1"},{"text":"2","callback_data":"2"}],
#                         [{"text":"3","callback_data":"3"}]]}
```


## Клавиатура ответа (`rkb`)


```python
@app.on_cmd("/keyboard")
async def show_keyboard(msg):
    kbd = (
        app.rkb(resize_keyboard=True, one_time_keyboard=True)
        .btn("Option A")
        .btn("Option B")
        .row()
        .btn("More Options")
        .build()
    )
    await msg.reply("Pick one:", kbd=kbd)
```


`rkb(**opts)` принимает любой вариант клавиатуры ответа, который поддерживает Telegram:


```python
app.rkb(
    resize_keyboard=True,       # shrink to fit buttons
    one_time_keyboard=True,     # hide after first use
    selective=True,             # only for mentioned users
    input_field_placeholder="Type here...",
    is_persistent=True,         # Telegram Stars persistent keyboard
)
```


## Принудительный ответ (`frk`)

Заставляет пользователя ответить. Никаких кнопок — только флажок:


```python
await msg.reply("Enter your name:", kbd=app.frk(selective=True, placeholder="Your name...").build())
```


`frk(**opts)` принимает `selective`, `input_field_placeholder` и любые будущие варианты принудительного ответа.

## Удалить клавиатуру (`rgk`)

Удаляет текущую пользовательскую клавиатуру:


```python
await msg.reply("Keyboard removed.", kbd=app.rgk(selective=True).build())
```


`rgk(**opts)` принимает `selective` и любые будущие варианты удаления клавиатуры.

## Параметры предварительного просмотра ссылки

Передайте простой запрос — класс строителя не требуется:


```python
# Disable preview
await msg.reply("https://example.com", link_options={"is_disabled": True})

# Custom preview
await msg.reply("Check this out", link_options={
    "url": "https://example.com",
    "prefer_small_media": True,
    "prefer_large_media": False,
    "show_above_text": False,
})
```


Транспортный уровень принимает любой диктовку с `to_dict()` или необработанный диктовку.

## Транспортная обработка

Сериализация `to_dict()` учитывает транспортировку на сайте вызова. В `BotNet.send_msg()` и `MsgObj.reply()`:


```python
if kbd is not None:
    data["reply_markup"] = kbd.to_dict() if hasattr(kbd, "to_dict") else kbd
```


Для Bot API клавиатуры всегда преобразуются в dict (JSON). Для MTProto они передаются в сериализатор TL. Соглашение `to_dict()` объединяет оба мира.

## Память

`KbdBuilder` использует `__slots__` — без накладных расходов `__dict__`. Клавиатуры обычно недолговечны (создаются, отправляются, выбрасываются), поэтому это микрооптимизация, которая увеличивается при отправке тысяч сообщений.