---
title: "Keyboard System"
---

# Keyboard System

GoyGram provides inline keyboards, reply keyboards, force-reply, and keyboard removal through a single dynamic builder — `KbdBuilder`. No hardcoded button classes. Every field passes through as-is to the Telegram API.

## The Builder

`KbdBuilder` is a universal keyboard builder with no hardcoded fields. It's never imported directly — access it through the `app` instance:

- `app.ikb()` — inline keyboard
- `app.rkb(**opts)` — reply keyboard with options
- `app.frk(**opts)` — force reply
- `app.rgk(**opts)` — remove keyboard

## Inline Keyboard (`ikb`)

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

### Duck Typing — Skip `.build()`

`KbdBuilder` has a `to_dict()` method (alias for `build()`), so you can pass the builder directly to `reply()` without calling `.build()`:

```python
await msg.reply("Choose:", kbd=app.ikb().btn("Yes", callback_data="yes").btn("No", callback_data="no"))
```

The transport layer calls `to_dict()` automatically when it detects the method.

### Button Fields

`.btn(text, **kw)` — `**kw` goes directly into the button dict. Any Telegram button field works:

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

No field is hardcoded — if Telegram adds `new_field` tomorrow, `.btn("Label", new_field=value)` just works.

### `.row()`

Starts a new row of buttons. Empty rows are automatically filtered out on `build()`.

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

## Reply Keyboard (`rkb`)

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

`rkb(**opts)` accepts any reply keyboard option Telegram supports:

```python
app.rkb(
    resize_keyboard=True,       # shrink to fit buttons
    one_time_keyboard=True,     # hide after first use
    selective=True,             # only for mentioned users
    input_field_placeholder="Type here...",
    is_persistent=True,         # Telegram Stars persistent keyboard
)
```

## Force Reply (`frk`)

Forces the user to reply. No buttons — just the flag:

```python
await msg.reply("Enter your name:", kbd=app.frk(selective=True, placeholder="Your name...").build())
```

`frk(**opts)` accepts `selective`, `input_field_placeholder`, and any future force-reply options.

## Remove Keyboard (`rgk`)

Removes the current custom keyboard:

```python
await msg.reply("Keyboard removed.", kbd=app.rgk(selective=True).build())
```

`rgk(**opts)` accepts `selective` and any future remove-keyboard options.

## Link Preview Options

Pass a plain dict — no builder class needed:

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

The transport layer accepts any dict with `to_dict()` or a raw dict.

## Transport Handling

The `to_dict()` serialization is transport-aware at the call site. In `BotNet.send_msg()` and `MsgObj.reply()`:

```python
if kbd is not None:
    data["reply_markup"] = kbd.to_dict() if hasattr(kbd, "to_dict") else kbd
```

For Bot API, keyboards are always converted to dict (JSON). For MTProto, they're passed through to the TL serializer. The `to_dict()` convention bridges both worlds.

## Memory

`KbdBuilder` uses `__slots__` — no `__dict__` overhead. Keyboards are typically short-lived (created, sent, discarded), so this is a micro-optimization that adds up at scale when sending thousands of messages.
