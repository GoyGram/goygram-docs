---
title: "Логика выбора транспорта"
---

# Логика выбора транспорта

GoyGram поддерживает два транспорта — Bot API (HTTP) и MTProto (TCP). Метод `via()` определяет, какой транспорт использовать, а `MsgObj.reply()` автоматически маршрутизирует через правильный транспорт.

## Метод `via()`


```python
def via(self, chat_id: int | str, via: str | None = None) -> str:
    # 1. Explicit override
    if via in {"bot", "mt"}:
        if via == "bot" and self.bot is None:
            raise RuntimeError("bot net is not configured")
        if via == "mt" and self.mt is None:
            raise RuntimeError("mt net is not configured")
        return via

    # 2. Chat ID prefix inference
    if isinstance(chat_id, str) and chat_id.startswith("bot:"):
        if self.bot is None:
            raise RuntimeError("bot net is not configured")
        return "bot"

    if isinstance(chat_id, str) and chat_id.startswith("mt:"):
        if self.mt is None:
            raise RuntimeError("mt net is not configured")
        return "mt"

    # 3. Default: first available
    if self.bot is not None:
        return "bot"
    if self.mt is not None:
        return "mt"

    raise RuntimeError("no transport configured")
```


## Приоритет решения

1. **Явный параметр `via=`** — имеет абсолютный приоритет.
2. **Префикс идентификатора чата** (`"bot:"` или `"mt:"`) — явная маршрутизация для каждого сообщения.
3. **Резервный вариант по умолчанию** — сначала API бота, затем MTProto.

## Удаление префикса идентификатора чата

Метод `raw_chat()` удаляет префиксы перед отправкой в транспорт:


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


Таким образом, `"bot:123456789"` становится `123456789` при фактической отправке в Bot API.

## Отправка сообщений

Сообщения отправляются с помощью методов, специфичных для транспорта:

### API бота


```python
# Dynamic dispatch — snake_case → CamelCase
await app.send_message(chat_id=123, text="Hello")

# Lower-level with special formatting (reply_to, kbd, topic_id)
await app.bot.send_msg(chat_id=123, text="Hello", kbd=my_kbd, topic_id=42)

# Direct call
await app.bot_req("sendMessage", chat_id=123, text="Hello")
```


### МТПрото


```python
# Dynamic dispatch with full namespace
await app.mt_messages_send_message(peer=..., message="Hello", random_id=...)

# Direct call
await app.mt_req("messages.sendMessage", peer=..., message="Hello", random_id=...)
```


## Различия в именах параметров

Bot API и MTProto используют разные имена параметров для одних и тех же концепций:

| Концепция | API ботов | МТПрото |
|---------|---------|---------|
| Цель ответа | `reply_parameters` / `{"message_id": ...}` | `reply_to` |
| Клавиатура | `reply_markup` | `kbd` |
| Тема | `message_thread_id` | `topic_id` |
| Предварительный просмотр ссылки | `link_preview_options` | `link_options` |

`BotNet.send_msg()` обрабатывает нормализацию параметров API бота. `MsgObj.reply()` обрабатывает оба транспорта.

## Выбор транспорта в ответах

Когда обработчик отвечает на сообщение, `MsgObj.reply()` использует `src` сообщения для маршрутизации через правильный транспорт:


```python
async def reply(self, txt, kbd=None, topic_id=None, link_options=None, **kw):
    if self.src == "bot" and self.app.bot is not None:
        # Build reply_parameters, reply_markup for Bot API
        return await self.app.bot_req("sendMessage",
            chat_id=self.chat_id, text=txt, ...)
    if self.app.mt is not None:
        # Resolve peer, build MTProto-specific fields
        return await self.app.mt_req("messages.sendMessage",
            peer=peer, message=txt, random_id=..., ...)
```


Таким образом, если сообщение пришло через Bot API, ответ возвращается через Bot API — автоматически.