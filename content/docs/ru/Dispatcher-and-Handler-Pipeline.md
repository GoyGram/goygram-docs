---
title: "Конвейер диспетчера и обработчика"

---
# Конвейер диспетчера и обработчика

Диспетчер (`goygram/core/disp.py`) является маршрутизатором событий. Он получает необработанные данные из шины, оборачивает их в типизированные объекты событий и запускает зарегистрированные обработчики с управлением потоком `StopPropagation`.

## Реализация диспетчера


```python
class Disp:
    def __init__(self, app, bus):
        self.app = app       # AppCore reference
        self.bus = bus       # Bus reference
        self.stop_ev = asyncio.Event()
```


### Основной цикл: `consume()`


```python
async def consume(self):
    while not self.stop_ev.is_set():
        pkt = await self.bus.fetch()
        await self.one(pkt)
```


Бесконечный цикл: выборка из шины → отправка. Запускается как задача asyncio.

### Маршрутизатор: `one()`

Здесь тип события определяет путь обработчика:


```python
async def one(self, pkt):
    data = pkt.get("data")
    if not isinstance(data, dict):
        return

    kind = data.get("kind")

    if kind == "err":
        self.log.warning("Disp error event: %s", data.get("text", ""))
        return
```


События ошибок (`kind: "err"`) регистрируются и удаляются — они не запускают обработчики.

**События сообщений:**


```python
    if kind == "msg":
        msg = MsgObj(pkt.get("src", "sys"), data, self.app)
        for fn in list(self.app.hook):          # on_msg handlers
            try:
                await fn(msg)
            except StopPropagation:
                return
            except Exception as e:
                self.log.error("Handler failure: %r", e)

        for fn in list(getattr(self.app, "update_hook", [])):  # on_update handlers
            try:
                await fn(msg)
            except StopPropagation:
                return
            except Exception as e:
                self.log.error("Handler failure: %r", e)
```


**События обратного вызова, опроса и участника** следуют одному и тому же шаблону с соответствующими списками перехватчиков — сначала типизированные обработчики, затем `update_hook` сбор всех элементов.

## Группы обработчиков и порядок выполнения

| Вид события | Группа хэндлеров 1 | Группа хэндлеров 2 |
|-----------|----------------|-----------------|
| `"msg"` | `hook` (on_msg) | `update_hook` (при_обновлении) |
| `"cb"` | `cb_hook` (on_cb) | `update_hook` (при_обновлении) |
| `"poll"` | `poll_hook` (on_poll) | `update_hook` (при_обновлении) |
| `"member"` | `member_hook` (on_member) | `update_hook` (при_обновлении) |

**Основное поведение:**
1. Сначала срабатывают типизированные обработчики, затем `update_hook` всеобъемлющие обработчики.
2. Обработчики в каждой группе активируются в **порядке регистрации**.
3. `StopPropagation` останавливает **текущую группу** — он не останавливает следующую группу.
4. `StopPropagation` из обработчика `on_msg` останавливает остальную часть `hook`, но `update_hook` все равно срабатывает.
5. Неизвестные значения `kind` автоматически удаляются.

## Управление потоком StopPropagation


```python
from goygram import StopPropagation

@app.on_msg(filt=filters.text)
async def guard(msg):
    if msg.text == "stop":
        raise StopPropagation
    await msg.reply("Processing...")

@app.on_msg(filt=filters.text)
async def second(msg):
    # Won't fire if guard raised StopPropagation
    await msg.reply("Second handler")

@app.on_update(filt=filters.update_type("msg"))
async def catch_all(event):
    # STILL fires — StopPropagation only stops hook, not update_hook
    await msg.reply(event.chat_id, "Caught in update_hook")
```


`StopPropagation` перехватывается для каждого группового цикла обработчика. Он выходит из текущей группы, но следующая группа продолжается нормально.

## Создание объекта события

| Вид события | Класс объекта | Исходный файл |
|-----------|-------------|-------------|
| `"msg"` | `MsgObj` | `goygram/types/msg.py` |
| `"cb"` | `CbObj` | `goygram/types/cb.py` |
| `"poll"` | `PollObj` | `goygram/types/poll.py` |
| `"member"` | `MemberObj` | `goygram/types/member.py` |

Все объекты получают `(src, raw, app)` — исходную строку транспорта, нормализованный словарь и ссылку `AppCore`.

## Интеграция фильтров

Фильтры оборачивают обработчики во время регистрации (в `AppCore.on_msg`, `on_cb` и т. д.):


```python
def on_msg(self, fn=None, filt=None):
    def wrap(inner):
        if filt is None:
            self.hook.append(inner)
            return inner
        async def guarded(msg):
            if filt(msg):
                return await inner(msg)
            return None
        self.hook.append(guarded)
        return inner
```


Если фильтр возвращает `False`, обработчик возвращает `None` — он не вызывает `StopPropagation`, поэтому последующие обработчики все равно выполняются.

## Устойчивость к ошибкам

Каждый вызов обработчика упакован индивидуально:


```python
for fn in list(self.app.hook):
    try:
        await fn(msg)
    except StopPropagation:
        return
    except Exception as e:
        self.log.error("Handler failure: %r", e)
        await self.bus.push("sys", {
            "kind": "err", "src": "disp", "text": repr(e)
        })
```


Авария одного обработчика никогда не убивает диспетчера. Копия `list()` предотвращает проблемы, если обработчики изменяют списки ловушек во время итерации.

## Жизненный цикл


```python
# Startup (in AppCore.run())
tasks.append(asyncio.create_task(self.disp.consume(), name="disp"))

# Shutdown (in AppCore.close())
await self.disp.close()
```


`close()` устанавливает `stop_ev`, вызывая выход `consume()`. Затем задача отменяется и ожидается.