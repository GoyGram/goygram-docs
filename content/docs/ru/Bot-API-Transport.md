---
---

# API транспорта ботов

Транспорт API бота (`goygram/vendor/botapi.py`) реализует API бота HTTPS Telegram с использованием `aiohttp` с длинным опросом `getUpdates`.

## Архитектура


```python
class BotNet:
    def __init__(self, token, bus, timeout=25, base="https://api.telegram.org"):
        self.token = token
        self.bus = bus                 # shared event bus
        self.timeout = timeout         # getUpdates timeout (seconds)
        self.base = f"{base}/bot{token}"  # API base URL
        self.sess = None               # aiohttp.ClientSession (lazy)
        self.off = 0                   # update_id offset
        self.stop_ev = asyncio.Event()
```


## Жизненный цикл соединения

### Ботинок


```python
async def boot(self):
    if self.sess and not self.sess.closed:
        return  # already connected
    mod = self.mod()
    self.sess = mod.ClientSession(
        timeout=mod.ClientTimeout(total=self.timeout + 10),
        trust_env=True,
    )
```


Создает `aiohttp.ClientSession` с:
– Общий тайм-аут: `self.timeout + 10` (по умолчанию 35 секунд).
- `trust_env=True`: учитывает переменные среды HTTP_PROXY/HTTPS_PROXY.

### Повторное использование соединения

Сеанс создается один раз и используется повторно. Все вызовы API используют один и тот же пул TCP-соединений (поддержание активности HTTP).

### Выключение


```python
async def close(self):
    self.stop_ev.set()
    if self.sess and not self.sess.closed:
        await self.sess.close()
```


## Длинный цикл опроса


```python
async def spin(self):
    await self.boot()
    while not self.stop_ev.is_set():
        res = await self.req("getUpdates", {
            "offset": self.off,
            "timeout": self.timeout,  # 25s long-poll
            "allowed_updates": [
                "message", "edited_message", "callback_query",
                "poll", "chat_member", "my_chat_member"
            ],
        })
        for upd in res:
            uid = int(upd.get("update_id", 0))
            if uid >= self.off:
                self.off = uid + 1   # advance offset
            pkt = self.norm(upd)     # normalize to event dict
            if pkt:
                await self.bus.push("bot", pkt)
```


### Обработка конфликтов вебхуков

Если сервер возвращает HTTP 409 на `getUpdates` (вебхук активен):


```python
if r.status == 409 and m == "getUpdates":
    await self.req("deleteWebhook", {"drop_pending_updates": False})
    self.log.error("Webhook conflict detected. Webhook deleted and polling will retry.")
    return []
```


GoyGram **автоматически удаляет** любой конфликтующий вебхук и возобновляет опрос. Это агрессивный подход — он уничтожит любую существующую настройку веб-перехватчика без запроса.

## Обработка запроса

### JSON-запросы (без файлов)


```python
def body(self, data):
    if not self.has_file(data):
        return {"json": data}  # application/json
    # ... multipart form data for files
```


### Загрузка файла (multipart/form-data)

Файлы обнаруживаются рекурсивно через словарь полезной нагрузки. Любой кортеж `bytes`, `bytearray`, `memoryview` или `(filename, data, content_type)` запускает многочастное кодирование:


```python
def has_file(self, v):
    if isinstance(v, (bytes, bytearray, memoryview)):
        return True
    if isinstance(v, tuple) and len(v) >= 2 and isinstance(v[1], (bytes, bytearray, memoryview)):
        return True
    if isinstance(v, list):
        return any(self.has_file(x) for x in v)
    if isinstance(v, dict):
        return any(self.has_file(x) for x in v.values())
    return False
```


В `aiohttp.FormData` добавлены поля файла:


```python
def add_form(self, form, k, v):
    if isinstance(v, tuple) and len(v) >= 2:
        # (filename, data, content_type) or (filename, data)
        form.add_field(k, bytes(v[1]), filename=str(v[0]),
                       content_type=v[2] if len(v) > 2 else "application/octet-stream")
    elif isinstance(v, (bytes, bytearray, memoryview)):
        form.add_field(k, bytes(v), filename=f"{k}.bin",
                       content_type="application/octet-stream")
    elif isinstance(v, (dict, list)):
        form.add_field(k, json.dumps(v, ensure_ascii=False))
    elif isinstance(v, bool):
        form.add_field(k, "true" if v else "false")
    else:
        form.add_field(k, str(v))
```


## Нормализация событий

Метод `norm()` преобразует необработанные данные обновления Bot API в нормализованные записи событий:

### Сообщения

```python
msg = upd.get("message") or upd.get("edited_message")
# → {"kind": "msg", "src": "bot", "msg_id": ..., "chat_id": ..., ...}
```


### Запросы обратного вызова

```python
cb = upd.get("callback_query")
# → {"kind": "cb", "src": "bot", "query_id": ..., "data": ..., ...}
```


### Опросы

```python
poll = upd.get("poll")
# → {"kind": "poll", "src": "bot", "poll_id": ..., "question": ..., ...}
```


### Обновления участников чата

```python
mem = upd.get("chat_member") or upd.get("my_chat_member")
# → {"kind": "member", "src": "bot", "chat_id": ..., "old_status": ..., "new_status": ...}
```


## Обработка ошибок


```python
async def req(self, m, data=None):
    async with self.sess.post(f"{self.base}/{m}", **body) as r:
        raw = await r.json(content_type=None)
    if r.status >= 400:
        raise RuntimeError(f"botapi {m} http {r.status}: {raw}")
    if not raw.get("ok"):
        raise RuntimeError(f"botapi {m} fail: {raw}")
    return raw["result"]
```


Примечание. `content_type=None` передается в `r.json()` для обработки случайных нестандартных заголовков Content-Type Telegram.

Все ошибки вызывают `RuntimeError` — иерархии типизированных исключений нет. Звонящего надо поймать и осмотреть.