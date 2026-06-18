---
title: "Динамическая отправка API бота"
---

# Динамическая отправка API бота

GoyGram обеспечивает прозрачный доступ ко всей поверхности метода Bot API через механизм Python `__getattr__`. Любое имя метода `snake_case` преобразуется в `CamelCase` на лету и отправляется как вызов API бота — регистрация метода вручную не требуется.

## Как это работает

Два уровня динамической отправки охватывают все методы Bot API:

### Уровень 1: AppCore.\_\_getattr\_\_


```python
def __getattr__(self, name: str) -> Any:
    if self.api is not None and hasattr(self.api, name):
        return getattr(self.api, name)
    if name.startswith("mt_") and self.mt is not None:
        return self._dynamic_method(name)
    if not name.startswith("mt_") and not name.startswith("_") and self.bot is not None:
        return self._dynamic_method(name)
    raise AttributeError(name)
```


При этом проверяется, сначала разрешает ли `BotAPI` имя, а затем возвращается к динамической генерации. Методы, начинающиеся с `mt_`, перенаправляются в MTProto.

### Уровень 2: BotAPI.\_\_getattr\_\_


```python
class BotAPI:
    __slots__ = ("net",)
    def __init__(self, net): self.net = net

    async def call(self, meth, **kw):
        return await self.net.req(meth, dump(kw))

    def __getattr__(self, name):
        async def dyn(**kw):
            parts = name.split("_")
            meth = parts[0] + "".join(
                x[:1].upper() + x[1:] for x in parts[1:]
            )
            return await self.call(meth, **kw)
        return dyn
```


Это полностью динамический уровень — любое имя `snake_case` преобразуется и отправляется. `BotAPI.call()` запускает `dump(kw)` со всеми параметрами и вызывает `self.net.req(method_name, data)`.

BotAPI не имеет жестко запрограммированных типизированных методов — каждый вызов проходит через `__getattr__`.

## Преобразование имени

`_bot_method_name` преобразует `snake_case` → `CamelCase`:


```python
def _bot_method_name(self, name: str) -> str:
    if "_" in name:
        parts = name.split("_")
        return parts[0] + "".join(
            x[:1].upper() + x[1:] for x in parts[1:]
        )
    return name
```


Имя метода ДОЛЖНО совпадать с именем метода Telegram Bot API. Примеры:

| `app.method_name(...)` | Метод API бота | Работает? |
|---|---|---|
| `send_message` | `sendMessage` | ✓ |
| `get_chat_administrators` | `getChatAdministrators` | ✓ |
| `delete_webhook` | `deleteWebhook` | ✓ |
| `set_my_commands` | `setMyCommands` | ✓ |
| `edit_message_reply_markup` | `editMessageReplyMarkup` | ✓ |
| `sendMessage` (без подчеркивания) | `sendMessage` (сквозной) | ✓ |
| `send_msg` | `sendMsg` | ✗ — В Telegram есть `sendMessage`, а не `sendMsg` |
| `send_doc` | `sendDoc` | ✗ — В Telegram есть `sendDocument`, а не `sendDoc` |

Используйте полное имя метода, соответствующее документации Telegram. CamelCase без подчеркиваний также работает (сквозной).

## Генерация динамического метода

`_dynamic_method` создает `async`, вызываемый на лету:


```python
def _dynamic_method(self, name: str):
    async def call(**kw: Any) -> Any:
        if name.startswith("mt_"):
            return await self.mt_req(self._mt_method_name(name), **kw)
        return await self.bot_req(self._bot_method_name(name), **kw)
    return call
```


Сгенерированная функция возвращается из `__getattr__`. Обычный поиск атрибутов Python кэширует результат для последующих вызовов.

## Примеры использования


```python
app = GoyGram(bot_token="...")

# All of these work through dynamic dispatch:
await app.send_message(chat_id=123, text="Hello")
await app.get_chat(chat_id=123)
await app.get_chat_administrators(chat_id=123)
await app.set_my_commands(commands=[...])
await app.send_document(chat_id=123, document=open("file.pdf", "rb"))
await app.delete_webhook(drop_pending_updates=True)

# Any Bot API method — even newly released ones — works immediately:
await app.get_business_connection(business_connection_id="...")
```


## MTProto Параллельный

Методы MTProto используют префикс `mt_` с полным пространством имен. Пространство имен — это первый сегмент подчеркивания перед именем метода:


```python
# Correct: full namespace.methodName format
await app.mt_messages_get_dialogs(limit=50)
await app.mt_messages_get_history(peer=..., limit=100)
await app.mt_messages_send_message(peer=..., message="Hello", random_id=...)

# Or use the dotted form directly:
await app.mt_req("messages.getDialogs", limit=50)
await app.mt_req("messages.getHistory", peer=..., limit=100)
```


Преобразование имени для MTProto:
- `mt_messages_get_dialogs` → `messages.getDialogs`
- `mt_messages_get_history` → `messages.getHistory`
- `mt_channels_get_participants` → `channels.getParticipants`
- `mt_account_update_profile` → `account.updateProfile`

Первый сегмент подчеркивания после `mt_` становится пространством имен, остальные образуют имя метода CamelCase.

## Явные удобные методы

Несколько методов определены непосредственно в `AppCore`:

| Метод | Цель |
|--------|---------|
| `bot_req(method, **kw)` | Прямой вызов API бота с именем метода CamelCase |
| `mt_req(action, **kw)` | Прямой вызов MTProto с названием действия, разделенным точками |
| `html(text)` | Вернуть `{"text": text, "parse_mode": "HTML"}` |
| `md(text)` | Вернуть `{"text": text, "parse_mode": "MarkdownV2"}` |
| `ikb()` | Создать встроенный конструктор клавиатуры |
| `rkb(**opts)` | Создать ответ Конструктор клавиатуры |
| `frk(**opts)` | Создание разметки принудительного ответа |
| `rgk(**opts)` | Создать разметку для удаления клавиатуры |

Все остальные методы Bot API проходят динамическую отправку `__getattr__` — готовых оболочек методов нет.