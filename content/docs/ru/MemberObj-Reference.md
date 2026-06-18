---
---

# Ссылка на MemberObj

`MemberObj` представляет события изменения статуса участника чата — обновления `chat_member` и `my_chat_member` из потока длинного опроса Bot API.

## Структура


```python
class MemberObj:
    __slots__ = ("src", "raw", "app", "chat_id", "from_id",
                 "user_id", "old", "new", "kind")

    def __init__(self, src: str, raw: dict[str, Any], app: Any) -> None:
        self.src = src
        self.raw = raw
        self.app = app
        self.chat_id = raw.get("chat_id")
        self.from_id = raw.get("from_id")
        self.user_id = raw.get("user_id")
        self.old = raw.get("old_status")
        self.new = raw.get("new_status")
        self.kind = raw.get("kind", "member")
```


## Поля

| Поле | Источник в сыром виде | Описание |
|-------|---------------|-------------|
| `chat_id` | `chat.id` из нормализованного обновления | ID чата/канала, где произошло изменение |
| `from_id` | `from.id` из нормализованного обновления | Идентификатор пользователя, инициировавшего изменение (например, администратор, выполнивший повышение) |
| `user_id` | `new_chat_member.user.id` или `old_chat_member.user.id` | Идентификатор затронутого пользователя |
| `old` | `old_chat_member.status` | Предыдущий статус до изменения |
| `new` | `new_chat_member.status` | Новый статус после изменения |
| `kind` | — | Всегда `"member"` |

## Значения статуса

Поля `old` и `new` содержат стандартные строки статуса Bot API:

- `"creator"` — владелец чата
- `"administrator"` — администратор
- `"member"` — постоянный участник
- `"restricted"` — участник с ограниченным доступом
- `"left"` — вышел из чата
- `"kicked"` — кикнут/забанен

## Нормализация из Bot API

В `BotNet.norm()` оба обновления `chat_member` и `my_chat_member` нормализуются в единый формат:


```python
mem = upd.get("chat_member") or upd.get("my_chat_member")
if isinstance(mem, dict):
    chat = mem.get("chat") or {}
    usr = mem.get("from") or {}
    old = mem.get("old_chat_member") or {}
    new = mem.get("new_chat_member") or {}
    target = new.get("user") or old.get("user") or {}
    return {
        "kind": "member",
        "src": "bot",
        "upd_id": upd.get("update_id"),
        "chat_id": chat.get("id"),
        "from_id": usr.get("id"),
        "user_id": target.get("id"),
        "old_status": old.get("status"),
        "new_status": new.get("status"),
        "raw": upd,
    }
```


Ключевое различие между `chat_member` и `my_chat_member`:
- `chat_member` — изменение статуса любого участника в чате, в котором находится бот
- `my_chat_member` — изменился собственный статус бота

Оба создают один и тот же нормализованный формат и отправляются одним и тем же обработчикам `on_member`.

## Поток событий

1. `BotNet.spin()` опрашивает `getUpdates` с помощью `allowed_updates=["chat_member", "my_chat_member"]`
2. `BotNet.norm()` нормализует обновление в словарь с помощью `kind: "member"`.
3. Пакет передается на шину событий.
4. `Disp.consume()` → `Disp.one()` создает `MemberObj` и выполняет итерацию `app.member_hook`.

## Обработчик on_member()


```python
app = GoyGram(bot_token="...")

@app.on_member
async def handle_member(mem: MemberObj):
    # Track new members
    if mem.new == "member" and mem.old in ("left", None):
        await app.bot.send_msg(
            mem.chat_id,
            f"Welcome, user {mem.user_id}!"
        )

    # Detect kicks
    if mem.new == "kicked" and mem.old == "member":
        await app.bot.send_msg(
            mem.chat_id,
            f"User {mem.user_id} has been removed."
        )

    # Track admin promotions
    if mem.new == "administrator":
        await app.bot.send_msg(
            mem.chat_id,
            f"New admin: user {mem.user_id}"
        )
```


## Использование с фильтрами

Объедините `on_member` с системой фильтров для детального контроля:


```python
from goygram.filters import Filter

# Only react to kicks
kick_filter = Filter(lambda mem: bool(mem.new == "kicked"))

@app.on_member(filt=kick_filter)
async def on_kick(mem: MemberObj):
    await app.bot.send_msg(
        mem.chat_id,
        f"User {mem.user_id} was kicked."
    )
```


## Доступ к необработанным данным

Поле `raw` сохраняет исходный текст обновления Bot API, позволяя получить доступ к полям, не представленным в нормализованном формате:


```python
@app.on_member
async def debug_member(mem: MemberObj):
    raw_update = mem.raw
    invite_link = raw_update.get("invite_link")
    if invite_link:
        print(f"Joined via invite: {invite_link}")
```


## Транспортное примечание

`MemberObj` предназначен только для API ботов (всегда `src = "bot"`). MTProto имеет другой механизм обновлений участников (событий участников канала в потоке обновлений), которые обрабатываются отдельно через конвейер событий MTProto.