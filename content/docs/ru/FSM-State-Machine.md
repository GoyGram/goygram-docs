---
title: "Конечный автомат FSM"

---
# Конечный автомат FSM

GoyGram включает в себя встроенный конечный автомат для отслеживания состояний разговора каждого чата и пользователя. Он идеально подходит для многоэтапных потоков, таких как мастера регистрации, боты-опросы или любое последовательное взаимодействие.

## Обзор

FSM управляется кортежами `(chat_id, user_id)` — каждый пользователь в каждом чате имеет независимое состояние. Состояния имеют срок жизни (по умолчанию 1 час) и автоматически очищаются.

## Архитектура


```python
class StateItem:
    __slots__ = ('state', 'data', 'expiry')

class FSMEngine:
    def __init__(self, ttl: float = 3600.0) -> None:
        self._states: dict[tuple[int, int], StateItem] = {}
        self._ttl = ttl
```


- **`_states`**: код с ключом `(int(chat_id), int(user_id))`.
- **`ttl`**: время жизни по умолчанию в секундах (3600 = 1 час).
- **Фоновая очистка**: запускается каждые 600 секунд, удаляет просроченные состояния партиями по 1000 штук.

## Настройка состояния


```python
app.set_state(chat_id, user_id, "waiting_name")
```


Или с данными:


```python
app.set_state(
    chat_id, user_id,
    state="waiting_age",
    data={"name": "Sam", "step": 2},
    ttl=1800  # optional per-state TTL override
)
```


**Поведение при слиянии данных**: если состояние для этого ключа `(chat_id, user_id)` уже существует, вызов `set_state` с новым `data` **объединяет** его с существующими данными (dict.update). Имя `state` перезаписывается, а `ttl` сбрасывается.


```python
app.set_state(chat, user, "step1", {"a": 1})
app.set_state(chat, user, "step2", {"b": 2})
data = app.get_state_data(chat, user)
# data == {"a": 1, "b": 2}
```


## Получение состояния


```python
state_name = app.get_state(chat_id, user_id)
# Returns str | None

data = app.get_state_data(chat_id, user_id)
# Returns dict | None (a copy, safe to mutate)
```


`get_state_data()` возвращает **неполную копию** словаря данных, поэтому его изменение не влияет на сохраненное состояние.

Срок действия обоих методов истекает автоматически: если срок жизни состояния истек, они возвращают `None`, и состояние удаляется.

## Состояние очистки


```python
app.clear_state(chat_id, user_id)
```


Молчаливо добивается успеха, если никакого государства не существует.

## Фильтры с поддержкой FSM

Система фильтров интегрируется непосредственно с FSM:


```python
from goygram.filters import state, state_any

@app.on_msg(filt=filters.text & state("waiting_name"))
async def get_name(msg):
    name = msg.text.strip()
    app.set_state(msg.chat_id, msg.from_id,
        "waiting_age", {"name": name})
    await msg.reply(f"Got it, {name}. How old are you?")

@app.on_msg(filt=filters.text & state("waiting_age"))
async def get_age(msg):
    if not msg.text.isdigit():
        await msg.reply("Please enter a number.")
        return
    data = app.get_state_data(msg.chat_id, msg.from_id) or {}
    name = data.get("name", "User")
    app.clear_state(msg.chat_id, msg.from_id)
    await msg.reply(f"{name}, age {msg.text} — registered!")
```


- `state("name")` — срабатывает только тогда, когда `get_state(chat_id, user_id) == "name"`
- `state_any("a", "b", "c")` — срабатывает, если состояние является любым из заданных имен.

Оба фильтра возвращают `False` (обработчик пропуска), если состояние отсутствует или срок его действия истек.

## Полный пример: процесс регистрации


```python
from goygram import GoyGram, filters
from goygram.filters import state

app = GoyGram(bot_token="...")

@app.on_cmd("register")
async def start_register(msg):
    app.set_state(msg.chat_id, msg.from_id, "reg_name")
    await msg.reply("What's your name?")

@app.on_msg(filt=filters.text & state("reg_name"))
async def reg_name(msg):
    app.set_state(msg.chat_id, msg.from_id,
        "reg_email", {"name": msg.text})
    await msg.reply("What's your email?")

@app.on_msg(filt=filters.text & state("reg_email"))
async def reg_email(msg):
    data = app.get_state_data(msg.chat_id, msg.from_id) or {}
    name = data.get("name", "User")
    app.clear_state(msg.chat_id, msg.from_id)
    await msg.reply(f"Registered: {name} <{msg.text}>")
```


## Жизненный цикл


```python
# Started automatically in AppCore.run()
tasks.append(asyncio.create_task(self.fsm.start(), name="fsm_cleanup"))

# Stopped in AppCore.close()
await self.fsm.stop()
```


`start()` запускает задачу фоновой очистки. `stop()` отменяет его и очищает все состояния.

## Вопросы памяти

- Состояния хранятся только в памяти — без сохранения после перезапуска.
- Ключи `(chat_id, user_id)` преобразуются в `int` — строковые идентификаторы чата (например, имена пользователей) не будут работать.
- Цикл очистки обрабатывает не более 1000 устаревших записей за цикл — для очень больших наборов состояний (> 100 тыс.) устаревшие записи могут задерживаться на короткое время.
— Нет ограничений на размер словаря `_states` — он увеличивается до очистки или явного `clear()`.
- `get_state_data()` возвращает неполную копию, чтобы предотвратить случайное изменение сохраненного состояния.