---
title: "Система команд"

---
# Система команд

Система команд GoyGram использует класс фильтра `command`, который подключается к обычному конвейеру обработчика `on_msg`. Команды **не** являются отдельным путем отправки — это обработчики сообщений со специализированным фильтром.

## Регистрация


```python
@app.on_cmd("start", "help")
async def start_handler(msg):
    await msg.reply(f"Command: {msg.cmd}, args: {msg.args}")
```


`on_cmd(*names)` — это ярлык для:


```python
from goygram.filters import command as _cmd_filt
def on_cmd(self, *name: str):
    return self.on_msg(filt=_cmd_filt(*name))
```


Это означает, что обработчики команд являются **обычными обработчиками сообщений** с примененным фильтром `command`. Они срабатывают в порядке регистрации вместе с другими обработчиками `on_msg`.

## Фильтр `command`


```python
class command(Filter):
    def __init__(self, *cmds: str, prefixes=("/", "!"),
                 ignore_case=True, sep=" "):
```


- **`*cmds`** — имена соответствующих команд (по умолчанию без учета регистра)
- **`prefixes`** — Допустимые префиксы команд; по умолчанию `("/", "!")`
- **`ignore_case`** — перед сопоставлением нормализовать до нижнего регистра (по умолчанию `True`)
- **`sep`** — разделитель аргументов (по умолчанию `" "`, пробел)

### Как работает сопоставление

1. Удалите пробелы из текста сообщения.
2. Сопоставьте самый длинный соответствующий префикс из `prefixes`.
3. Удалите префикс и суффикс `@username` (так `/ping@MyBot` станет `ping`).
4. Возьмите первое слово в качестве имени команды
5. Сравнить (по умолчанию без учета регистра) с зарегистрированными именами.
6. При совпадении: установите `msg.cmd` (имя команды) и `msg.args` (оставшийся текст)


```python
@app.on_cmd("ping")
async def ping(msg):
    assert msg.cmd == "ping"          # matched command name
    assert isinstance(msg.args, str)  # everything after the command
```


## Конфигурация префикса


```python
# Default: / and ! prefixes
@app.on_cmd("ping")
# Matches: /ping, !ping

# Custom prefix
from goygram.filters import command
@app.on_msg(filt=command("ping", prefixes=(".",)))
# Matches: .ping

# Multiple custom prefixes
@app.on_msg(filt=command("ping", prefixes=("/", "!", ".", "#")))
# Matches: /ping, !ping, .ping, #ping
```


## Чувствительность к регистру


```python
# Default: case-insensitive
@app.on_cmd("start")
# Matches: /start, /START, /Start

# Case-sensitive
@app.on_msg(filt=command("start", ignore_case=False))
# Matches: /start only
```


## Анализ аргументов

Фильтр `command` устанавливает `msg.args` для всего, что следует после командного слова и разделителя:


```
/ban 123456 reason spamming
→ cmd = "ban", args = "123456 reason spamming"

!echo hello world
→ cmd = "echo", args = "hello world"
```


Пользовательский разделитель:


```python
@app.on_msg(filt=command("ban", sep=":"))
# /ban:123456 → cmd="ban", args="123456"
```


## @Суффикс имени пользователя

Суффикс `@username` удаляется перед сопоставлением:


```
/ping@MyBot
→ base = "ping" (after stripping / and @MyBot)
→ matches "ping"
```



```
/start@AnotherBot
→ base = "start"
→ matches "start"
```


## Несколько команд


```python
@app.on_cmd("start", "help", "info")
async def multi_cmd(msg):
    if msg.cmd == "start":
        await msg.reply("Welcome!")
    elif msg.cmd == "help":
        await msg.reply("Available commands: ...")
    elif msg.cmd == "info":
        await msg.reply("Bot info: ...")
```


Все три команды запускают один и тот же обработчик. Проверьте `msg.cmd`, чтобы отличить.

## Диспетчерский конвейер

Поскольку команды являются обработчиками `on_msg` с фильтром, они выполняются в одном конвейере:


```
Message arrives
    ↓
Disp.one() → kind="msg" → creates MsgObj
    ↓
hook (on_msg handlers) iterates in registration order
    ↓
├── text_handler (filters.text)
├── command_handler (filters.command("ping"))  ← matches here
├── catch_all (no filter)
    ↓
update_hook handlers fire
```


Ключевое поведение:
- Обработчики команд **не** отделены от обработчиков сообщений — они используют один и тот же список перехватчиков.
- Одно сообщение может запускать несколько обработчиков команд, если несколько совпадают.
- `StopPropagation` из любого обработчика (сообщения или команды) останавливает всю цепочку `hook` для этого события.

## Использование `msg.cmd` и `msg.args`

После совпадения фильтра `command` объект события изменяется:


```python
@app.on_cmd("greet")
async def greet(msg):
    name = msg.args.strip() or "World"
    await msg.reply(f"Hello, {name}!")
```



```
/greet Sam
→ "Hello, Sam!"
```


## Пользовательские фильтры с помощью команды

Объедините `command` с любым другим фильтром:


```python
# Only respond to /ban in groups
@app.on_msg(filt=command("ban") & filters.group)
async def ban_group(msg): ...

# Rate-limit /start to once per minute
@app.on_msg(filt=command("start") & filters.cooldown(60))
async def throttled_start(msg): ...

# /admin only from specific users
@app.on_msg(filt=command("admin") & filters.from_any(OWNER_ID, ADMIN_ID))
async def admin_cmd(msg): ...
```


## Нет совпадений по пустым словам

Фильтр `command` требует префикса (`/` или `!` по умолчанию). Простое слово, такое как `ping`, **не** будет соответствовать, если вы не настроите `prefixes=("",)`:


```python
@app.on_msg(filt=command("ping", prefixes=("", "/", "!")))
async def ping(msg): ...
# Now matches: ping, /ping, !ping
```


## Изоляция ошибок

Как и во всех обработчиках сообщений, ошибки обработчика команд фиксируются и протоколируются для каждого обработчика — команда, вызывающая сбой, никогда не убивает диспетчер и не блокирует другие обработчики.