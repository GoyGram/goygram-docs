---
title: "Транспортные интерфейсы"
---

# Транспортные интерфейсы

GoyGram абстрагирует два протокола связи Telegram за единым интерфейсом: **BotNet** (длинный опрос Bot API HTTP) и **MTNet** (MTProto TCP с шифрованием AES-IGE).

## Архитектура


```
┌─────────────────────────────────────────┐
│                AppCore                  │
│  ┌──────────────────────────────────┐   │
│  │  via() — transport selection     │   │
│  │  bot_req() / mt_req() — calls    │   │
│  └──────────┬──────────┬────────────┘   │
│             │          │                │
│      ┌──────▼──┐  ┌───▼──────┐         │
│      │ BotNet  │  │ MTNet   │          │
│      │ (HTTP)  │  │ (TCP)   │          │
│      └────┬────┘  └───┬─────┘          │
│           │           │                │
│     Bot API       MTProto              │
└─────────────────────────────────────────┘
```


## BotNet — Транспорт API ботов

Длинный HTTP-опрос через `aiohttp`:


```python
class BotNet:
    def __init__(self, token: str, bus: Any, timeout: int = 25,
                 base: str = "https://api.telegram.org") -> None:
        self.token = token
        self.bus = bus
        self.timeout = timeout
        self.base = f"{base}/bot{token}"
```


Ключевые методы:

| Метод | Цель |
|--------|---------|
| `req(method, data)` | Отправьте запрос API бота, верните `result` |
| `call(method, **kw)` | Удобная оболочка для `req()` |
| `send_msg(chat_id, text, **kw)` | Отправить сообщение через `sendMessage` |
| `del_msg(chat_id, msg_id)` | Удалить сообщение через `deleteMessage` |
| `norm(upd)` | Нормализовать необработанный словарь обновления |
| `spin()` | Цикл длительного опроса |

### Отправка сообщения


```python
async def send_msg(self, chat_id, text, reply_to=None, kbd=None,
                   topic_id=None, link_preview_options=None, **kw):
    data = {"chat_id": chat_id, "text": text, **kw}
    if reply_to is not None:
        data["reply_parameters"] = {"message_id": reply_to}
    if kbd is not None:
        data["reply_markup"] = kbd.to_dict() if hasattr(kbd, "to_dict") else kbd
    if topic_id is not None:
        data["message_thread_id"] = topic_id
    opts = link_preview_options or kw.get("link_options")
    if opts is not None:
        data["link_preview_options"] = opts.to_dict() if hasattr(opts, "to_dict") else opts
    return await self.req("sendMessage", data)
```


### Загрузка файлов

`BotNet` автоматически определяет файловое/двоичное содержимое и переключается с JSON на данные составной формы:


```python
def has_file(self, v: Any) -> bool:
    if isinstance(v, (bytes, bytearray, memoryview)):
        return True
    if isinstance(v, tuple) and isinstance(v[1], (bytes, bytearray, memoryview)):
        return True
    # recursively checks lists and dicts
```


Файлы можно передавать как необработанные `bytes`, файловые объекты или кортежи `(filename, data, mime_type)`.

### Длинный опрос


```python
async def spin(self) -> None:
    while not self.stop_ev.is_set():
        res = await self.req("getUpdates", {
            "offset": self.off,
            "timeout": self.timeout,
            "allowed_updates": [
                "message", "edited_message", "callback_query",
                "poll", "chat_member", "my_chat_member"
            ],
        })
        for upd in res:
            uid = int(upd.get("update_id", 0))
            if uid >= self.off:
                self.off = uid + 1
            pkt = self.norm(upd)
            if pkt:
                await self.bus.push("bot", pkt)
```


Автоматическая очистка веб-перехватчика: если на `getUpdates` возникает конфликт 409, GoyGram вызывает `deleteWebhook` и повторяет попытку.

## MTNet — MTProto Transport

TCP-соединение с шифрованием AES-IGE, полным подтверждением связи MTProto 2.0 и поддержкой прокси:


```python
class MTNet:
    def __init__(self, host: str, port: int, bus: Any,
                 key: bytes | None = None, iv: bytes | None = None,
                 *, proxy: str | None = None, ...) -> None:
```


Ключевые методы:

| Метод | Цель |
|--------|---------|
| `send(obj)` | Зашифровать и отправить запрос MTProto |
| `_rpc_call(act, **kw)` | Вызов RPC с корреляцией будущего |
| `call(act, **kw)` | Высокоуровневый вызов RPC с поддержкой 2FA |
| `send_msg(chat_id, text, **kw)` | Отправить сообщение |
| `del_msg(chat_id, msg_id)` | Удалить сообщение |
| `spin()` | Цикл приема зашифрованных пакетов |
| `ensure_auth_key()` | Полный обмен ключами DH |

### Поддержка прокси

MTNet поддерживает прокси-серверы SOCKS5 и HTTP CONNECT через переменные среды или явную настройку:


```python
def proxy_cfg(self) -> ProxyCfg | None:
    raw = self.proxy_url or os.getenv("ALL_PROXY") or \
          os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY")
    if not raw:
        return None
    p = urllib.parse.urlparse(raw)
    # Parse and return ProxyCfg(scheme, host, port, user, pwd)
```


## via() — Выбор транспорта

`AppCore.via()` определяет транспорт на основе префикса `chat_id` или явного параметра `via`:


```python
def via(self, chat_id: int | str, via: str | None = None) -> str:
    if via in {"bot", "mt"}:
        return via
    if isinstance(chat_id, str):
        if chat_id.startswith("bot:"): return "bot"
        if chat_id.startswith("mt:"):  return "mt"
    if self.bot is not None: return "bot"
    if self.mt is not None:  return "mt"
    raise RuntimeError("no transport configured")
```


Префиксы идентификаторов чата:
- `bot:123456789` → маршруты через BotNet
- `mt:123456789` → маршруты через MTNet
- Голое целое число → по умолчанию используется доступный транспорт (сначала BotNet, затем MTNet)

## raw_chat() — Нормализация идентификатора

Удаляет транспортный префикс из идентификаторов чата:


```python
def raw_chat(self, chat_id: int | str) -> int | str:
    if isinstance(chat_id, str) and ":" in chat_id:
        pfx, raw = chat_id.split(":", 1)
        if pfx in {"bot", "mt"}:
            if raw.lstrip("-").isdigit():
                return int(raw)
            return raw
    return chat_id
```


## MsgObj.reply() — ответ, не зависящий от транспорта

`MsgObj.reply()` автоматически маршрутизирует правильный транспорт на основе `self.src`:


```python
async def reply(self, txt, kbd=None, topic_id=None,
                link_options=None, **kw):
    if self.src == "bot" and self.app.bot is not None:
        # Build reply_parameters, reply_markup, etc.
        return await self.app.bot_req("sendMessage",
            chat_id=self.chat_id, text=txt, ...)
    if self.app.mt is not None:
        # Resolve peer, build MTProto-specific fields
        return await self.app.mt_req("messages.sendMessage",
            peer=peer, message=txt, random_id=..., ...)
    return None
```


`self.src` сохраняется из исходного пакета (`"bot"` или `"mt"`), поэтому ответы автоматически проходят по тому же каналу, по которому было доставлено сообщение.