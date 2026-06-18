---
---

# Система шины событий

Шина событий — самый простой компонент в GoyGram, и это сделано намеренно. Это тонкая оболочка вокруг `asyncio.Queue` только с одним ограничением: события должны быть диктовками `{"src": str, "data": dict}`.

## Реализация шины


```python
# goygram/core/bus.py
class Bus:
    def __init__(self, maxsize: int = 0) -> None:
        self.q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=maxsize)

    async def push(self, src: str, data: dict[str, Any]) -> None:
        await self.q.put({"src": src, "data": data})

    async def fetch(self) -> dict[str, Any]:
        return await self.q.get()
```


### Поле `src`

Источник определяет, какой транспорт вызвал событие:

| `src` Значение | Значение |
|-------------|---------|
| `"bot"` | Событие от транспорта API бота (`BotNet`) |
| `"mt"` | Событие от транспорта MTProto (`MTNet`) |
| `"sys"` | Внутреннее системное событие (ошибки и т.п.) |

Значение `src` распространяется на `MsgObj.src`, `CbObj.src` и т. д. и используется методом `via()` для определения того, какой транспорт обрабатывает ответы.

### Поле `data`

Дикт с как минимум ключом `"kind"`. Полная схема событий:


```python
# Message event
{"kind": "msg", "msg_id": int, "chat_id": int|str, "from_id": int,
 "text": str, "raw": {...}, "is_me": bool}

# Callback query event
{"kind": "cb", "query_id": str, "chat_id": int, "from_id": int,
 "msg_id": int, "data": str, "text": str, "raw": {...}}

# Poll event
{"kind": "poll", "poll_id": str, "question": str,
 "is_closed": bool, "raw": {...}, "upd_id": int}

# Member/Chat member event
{"kind": "member", "chat_id": int, "from_id": int, "user_id": int,
 "old_status": str, "new_status": str, "raw": {...}}
```


### Конфигурация максимального размера


```python
app = GoyGram(bot_token="...", bus_max=0)  # default: unlimited queue
app = GoyGram(bot_token="...", bus_max=100)  # bounded: backpressure on producers
```


При использовании `maxsize=0` очередь не ограничена. При положительном значении `bus.push()` будет блокироваться (ожидать), когда очередь заполнится, оказывая противодавление поставщикам транспорта. Это требуется редко, но существует для сред с ограниченной памятью.

## Поток событий


```
BotNet.spin() ──→ bus.push("bot", data)
                              │
MTNet.spin() ──→ bus.push("mt", data)   (via asyncio.ensure_future)
                              │
                              ▼
                      ┌─────────────┐
                      │  asyncio.Q  │
                      └──────┬──────┘
                             │
                    Disp.consume() ──→ bus.fetch()
                             │
                             ▼
                       Disp.one(pkt)
                             │
                    ┌────────┼────────┐
                    │        │        │
                   msg      cb      poll   member
```


## События ошибок

Диспетчер отправляет события об ошибках на шину, когда обработчики терпят неудачу:


```python
# disp.py — inside exception handler in one()
await self.bus.push("sys", {
    "kind": "err",
    "src": "disp",
    "text": repr(e)
})
```


Они имеют `kind: "err"` и `src: "sys"`. В `Disp.one()` события ошибок маршрутизируются явно:


```python
if kind == "err":
    self.log.warning("Disp error event: %s", data.get("text", ""))
    return
```


Они регистрируются на уровне ПРЕДУПРЕЖДЕНИЯ через систему журналирования Python, а затем удаляются — они не накапливаются в очереди и не запускают никаких обработчиков.

## Внутренний и внешний толчок

- **Внешне**: только `BotNet` и `MTNet` отправляют события. Они выдвигают нормализованные диктовки (а не необработанные ответы API).
- **Внутренне**: диспетчер отправляет события об ошибках. Транспорты отправляют события тактового сигнала/синхронизации (например, конфликты веб-перехватчиков).

## Потокобезопасность

Шина **не потокобезопасна** — она предназначена для asyncio. Все производители и потребители работают в одном и том же цикле событий. Если вам нужен многопоточный доступ, оберните его самостоятельно.