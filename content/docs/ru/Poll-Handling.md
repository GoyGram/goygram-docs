---
---

# Обработка опроса

Как события опроса проходят через GoyGram и тип событий `PollObj`.

## Регистрация


```python
@app.on_poll()
async def poll_handler(poll):
    print(f"Poll: {poll.question}")
    if poll.closed:
        print("Poll is now closed")
```


## Ссылка на PollObj


```python
class PollObj:
    __slots__ = ("src", "raw", "app", "id", "question", "closed", "kind")

    def __init__(self, src, raw, app):
        self.src = src                     # "bot" (Bot API only)
        self.raw = raw                     # original event dict
        self.app = app                     # AppCore reference
        self.id = raw.get("poll_id") or raw.get("id")
        self.question = raw.get("question", "")
        self.closed = bool(raw.get("is_closed", False))
        self.kind = raw.get("kind", "poll")
```


## Нормализация API ботов

В `BotNet.norm()`:


```python
poll = upd.get("poll")
if isinstance(poll, dict):
    return {
        "kind": "poll",
        "src": "bot",
        "upd_id": upd.get("update_id"),
        "poll_id": poll.get("id"),
        "question": poll.get("question", ""),
        "is_closed": bool(poll.get("is_closed", False)),
        "raw": upd,
    }
```


## Что доступно

| Недвижимость | Тип | Описание |
|----------|------|-------------|
| `id` | `str \| None` | Идентификатор опроса |
| `question` | `str` | Текст вопроса опроса |
| `closed` | `bool` | Закрыто ли голосование |
| `src` | `str` | Источник транспорта (`"bot"`) |
| `raw` | `dict` | Полное оригинальное обновление dict |

## Что НЕ извлечено

Объект опроса НЕ извлекает:
- Параметры опроса (доступны в `raw["poll"]["options"]`)
- Подсчет голосов (доступен в `raw["poll"]["total_voter_count"]`)
- Тип опроса (викторина или обычный)
- Правильные ответы (для викторин)

Для получения полных данных опроса используйте `poll.raw["poll"]`.

## Диспетчеризация


```python
# In Disp.one():
if kind == "poll":
    poll = PollObj(src, data, self.app)
    for fn in self.app.poll_hook:
        try:
            await fn(poll)
        except Exception as e:
            self.log.error("Handler failure: %r", e)
```


Обработчики опросов срабатывают в порядке регистрации. Все зарегистрированные обработчики срабатывают при каждом обновлении опроса.

## Отправка опросов


```python
# Via Bot API
await app.sendPoll(chat_id=..., question="Vote!",
                   options=["Option A", "Option B"],
                   is_anonymous=True)

# Via static wrapper
await app.send_poll(chat_id=..., question="Vote!", options=[...])
```


## Остановка опросов


```python
await app.stopPoll(chat_id=..., message_id=...)
```