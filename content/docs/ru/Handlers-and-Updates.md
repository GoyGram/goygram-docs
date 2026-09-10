---
title: "Обработчики и обновления"
---

# Обработчики и обновления

Обработчики регистрируются до вызова `run()`. Все они должны быть `async def`.

```python
@app.on_msg
async def every_message(msg):
    print(msg.text)

@app.on_edit
async def every_edit(msg):
    print("edited:", msg.id, msg.text)

@app.on_update
async def every_other_update(update):
    print(update.update_type)

@app.on_msg(filt=filters.text & ~filters.me)
async def incoming_text(msg):
    await msg.reply("получено")

@app.on_cmd("help", "about")
async def help_command(msg):
    await msg.reply("Имена команд не чувствительны к регистру.")
```

Когда сработал фильтр `command(...)`, разобранные части доступны прямо на объекте события: `msg.cmd` — имя команды без префикса, `msg.args` — остальной текст после неё.

```python
@app.on_cmd("ping")
async def ping(msg):
    await msg.reply(f"pong, {msg.cmd} получил аргументы: {msg.args!r}")
```

## Группы обработчиков

Если нужно включать или выключать целый набор функций разом, регистрируйте обработчики внутри именованной группы. Группа проксирует все способы регистрации:

```python
g = app.group("admin")

@g.on_msg(filt=F.from_user == OWNER_ID)
async def admin_only(msg): ...

@g.on_cmd("restart")
async def restart(msg): ...

g.disable()     # все админские обработчики перестают срабатывать
g.enable()      # и снова работают
g.clear()       # удалить их навсегда
```

Группы — это обычные списки зарегистрированных хуков: без классов-обёрток и лишних слоёв диспетчеризации. У выключенной группы обработчики пропускаются ещё до проверки фильтров.

## Одноразовые обработчики

Любая регистрация принимает `once=True` — обработчик сработает один раз и снимется. `once=` также принимает имя группы, тогда обработчик удаляется вместе с группой:

```python
@app.on_msg(filt=F.text == "!confirm", once=True)
async def confirm_once(msg): ...
```

## Регистрация

- `app.on_msg(fn=None, filt=None)` — новые сообщения `MsgObj`;
- `app.on_edit(fn=None, filt=None)` — отредактированные сообщения `MsgObj`;
- `app.on_cb(fn=None, *, filt=None)` — нажатия inline-кнопок;
- `app.on_poll(fn=None, *, filt=None)` — ответы на опросы;
- `app.on_member(fn=None, *, filt=None)` — изменения участников;
- `app.on_update(fn=None, *, filt=None)` — все остальные события как `UpdateObj`; специализированные хуки срабатывают после него;
- `app.on_cmd(*names)` — сокращение для `on_msg(filt=command(*names))`.

Фильтр проверяется до вызова обработчика; неподошедший обработчик просто не вызывается. На одно обновление может сработать несколько обработчиков. Ошибка внутри обработчика изолирована и не останавливает reader и остальные обработчики.

## Покрытие обновлений MTProto

Рантайм работает с загруженной TL-схемой Telegram динамически. Он распознаёт контейнеры `updates`, `updatesCombined`, `updateShort`, `updateShortMessage`, `updateShortChatMessage`, `updateShortSentMessage`, `msg_container` и gzip-упакованные полезные нагрузки. Сообщения классифицируются как новые или отредактированные; остальные конструкторы сохраняют исходное имя и целиком попадают в `UpdateObj`. `on_update` получает каждое событие до специализированного хука.

Для важных семейств обновлений поля извлекаются заранее, ещё до raw-фолбэка: набор текста (в личке, чате, канале), истории, изменения папок и фильтров диалогов, бусты, реакции на сообщения, заявки на вступление, черновики, закреплённые сообщения, отметки прочтения, статус, имя и телефон пользователя, сервисные уведомления. Неизвестный конструктор всё равно приходит с `update_type` и полным `raw` — ничего не теряется:

```python
@app.on_update(filt=filters.update_type("updateStory"))
async def story(update):
    print(update.owner_id, update.story_id, update.raw)

@app.on_update(filt=filters.update_type("updateUserTyping"))
async def typing(update):
    print(update.user_id, update.typing_kind, update.action)
```

## Восстановление пропущенных обновлений

Если соединение рвётся или сервер присылает `updatesTooLong`, GoyGram сам чинит пропуски: `getDifference` выполняется циклом по слайсам (`differenceSlice` повторяется, пока не придёт финальный `difference`/`differenceTooLong`) — разрыв любого размера вычитывается без потери событий. Каналы отслеживаются по отдельности: на `updateChannelTooLong` или рассинхрон версий `getChannelDifference` забирает ровно то, что пропущено в конкретном канале. Настраивать ничего не нужно — восстановление работает автоматически на каждом MTProto-соединении.

В официальной схеме больше 150 конструкторов обновлений. Класс Python под каждый не нужен: используйте общий путь и читайте поля лениво:

```python
from goygram import filters

@app.on_update(filt=filters.update_type("updateMessageReactions"))
async def reactions(update):
    message_id = update.get("msg_id") or update.get("message_id")
    print(update.raw)
```

Для событий-сообщений поля, не нужные быстрому пути, не копируются. Берите их из исходного обновления:

```python
@app.on_edit
async def changed(msg):
    print(msg.get("edit_date"))
    print(msg.get("entities"))
    print(msg.get("reply_markup"))
    print(msg.get("reactions"))
```

Так память и задержка диспетчеризации остаются маленькими, а структура обновления сохраняется целиком.

## Порядок событий

Диспетчер сохраняет порядок, в котором обновления декодируются. Новые сообщения и правки идут в отдельные хуки. Остальные конструкторы попадают в `on_update` ровно один раз. Неизвестные валидные конструкторы остаются generic-событиями и не выбрасываются молча.

## Объект сообщения

`MsgObj` даёт общие поля: `id`, `chat_id`, `from_id`, `text`, `is_me`. Он поддерживает `msg.field`, `msg.get("field", default)`, `msg["field"]` и `msg.raw` для специфичных полей Telegram. Полный контракт ленивых полей описан в разделе [Объекты событий](/docs/Event-Objects).
