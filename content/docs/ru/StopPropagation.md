---
title: "Остановить распространение"

---
# Остановить распространение

`StopPropagation` — это исключение управления потоком, которое останавливает цепочку обработчиков текущего события. Это механизм, позволяющий сказать: «Я справился с этим, никому больше это не нужно».

## Базовое использование


```python
from goygram import StopPropagation

@app.on_msg(filt=filters.text)
async def guard(msg):
    if msg.text == "secret":
        raise StopPropagation  # no more message handlers for this event
    await msg.reply("Processing...")

@app.on_msg(filt=filters.text)
async def fallback(msg):
    # Won't fire if guard raised StopPropagation
    await msg.reply("Fallback handler")
```


## Область применения

`StopPropagation` влияет только на **текущую группу обработчиков** внутри `Disp.one()`:


```python
# In disp.py:
if kind == "msg":
    msg = MsgObj(...)
    for fn in list(self.app.hook):          # Group 1: on_msg handlers
        try:
            await fn(msg)
        except StopPropagation:
            return   # ← exits Group 1, but Group 2 still runs
        except Exception as e:
            ...

    for fn in list(self.app.update_hook):   # Group 2: on_update handlers
        try:
            await fn(msg)
        except StopPropagation:
            return   # ← exits Group 2
        except Exception as e:
            ...
```


### Что останавливает StopPropagation

| Вырос в | Остановки | НЕ останавливается |
|-----------|-------|---------------|
| обработчик `on_msg` | Другие обработчики `on_msg` | `on_update` обработчики |
| обработчик `on_cb` | Другие обработчики `on_cb` | `on_update` обработчики |
| обработчик `on_poll` | Другие обработчики `on_poll` | `on_update` обработчики |
| `on_member` обработчик | Другие обработчики `on_member` | `on_update` обработчики |
| обработчик `on_update` | Другие обработчики `on_update` | — |

Основная идея: `update_hook` всегда срабатывает после типизированных обработчиков. `StopPropagation` из обработчика `on_msg` только останавливает цепочку обработчиков сообщений — всеобработчики `on_update` продолжают работать.

## Варианты использования

### Командирский страж

Предотвратите перекрытие обработчиков команд:


```python
@app.on_cmd("admin")
async def admin_guard(msg):
    if msg.from_id not in ADMINS:
        raise StopPropagation
    await msg.reply("Welcome, admin")

@app.on_cmd("admin")
async def admin_actual(msg):
    # Only reaches here for actual admins
    await msg.reply("Admin panel: ...")
```


### Фильтрованная маршрутизация


```python
@app.on_msg(filt=filters.photo)
async def photo_handler(msg):
    raise StopPropagation  # handled by photo system, stop here

@app.on_msg(filt=filters.text)
async def text_handler(msg):
    await msg.reply("Text message received")
```


### Маршрутизация обратного вызова


```python
@app.on_cb(filt=filters.cb_data("confirm_delete"))
async def confirm_delete(cb):
    await delete_something(cb.msg_id)
    await cb.edit("Deleted")
    raise StopPropagation

@app.on_cb(filt=filters.cb_startswith("confirm_"))
async def generic_confirm(cb):
    await cb.answer("Unknown confirmation")
```


## Сравнение с результатами фильтра

| Механизм | Эффект |
|-----------|--------|
| Фильтр возвращает `False` | Пропускает только ЭТОТ обработчик; следующие обработчики все еще выполняются |
| `raise StopPropagation` | Останавливает ВСЕ обработчики в текущей группе |

Фильтры доступны для каждого обработчика. `StopPropagation` — это прерывание для всей группы.

## Наследование

`StopPropagation` наследуется от `GoyGramError`, который наследуется от `Exception`. Вы можете поймать это:


```python
@app.on_msg()
async def wrapper(msg):
    try:
        await inner_handler(msg)
    except StopPropagation:
        # Don't re-raise — this stops propagation at the wrapper level
        pass
```


Но обычно ловить не стоит — пусть этим занимается диспетчер.

## Это не ошибка

`StopPropagation` **не регистрируется как ошибка** — он явно перехватывается перед общим блоком `except Exception` в диспетчере. Это преднамеренный механизм управления потоком, а не сбой.