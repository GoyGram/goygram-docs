---
---

# Система фильтров

Система фильтров GoyGram предоставляет **более 100 составных фильтров** для каждого типа событий. Фильтры поддерживают логические операторы (`&`, `|`, `~`, `^`, `-`), самоанализ дерева выражений и шаблоны с отслеживанием состояния, такие как `cooldown`, `limit` и `once`.

## Класс фильтра


```python
@dataclass
class Filter:
    fn: Callable[[object], bool]
    _name: str | None = None
    _left: Filter | None = field(default=None, repr=False)
    _right: Filter | None = field(default=None, repr=False)
    _op: str | None = field(default=None, repr=False)

    def __call__(self, event: object) -> bool:
        return bool(self.fn(event))

    def __and__(self, other: Filter) -> Filter: ...
    def __or__(self, other: Filter) -> Filter: ...
    def __invert__(self) -> Filter: ...
    def __xor__(self, other: Filter) -> Filter: ...
    def __sub__(self, other: Filter) -> Filter: ...
```


Ключевые свойства:
- **Именованные фильтры**: каждый встроенный фильтр имеет `_name` для вывода отладки/объяснения.
- **Дерево выражений**: `_left`, `_right`, `_op` отслеживание дерева композиции для самоанализа.
- **Операторы**: `&` (И), `|` (ИЛИ), `~` (НЕ), `^` (ИСКЛЮЧАЮЩЕЕ ИЛИ), `-` (И НЕ — `self & ~other`)

## Фильтрация самоанализа

### `explain(event)`

Рекурсивно сравнивает дерево фильтров с реальным событием и печатает результат с маркерами ✓/✗:


```python
f = filters.text & ~filters.me
print(f.explain(msg))
# text: ✓
# True & ...
# me: ✗
# ~False = ✓
# RESULT: ✓
```


### `tree()`

Отображает выражение фильтра в виде дерева ASCII:


```python
f = (filters.text & ~filters.me) | filters.command("start")
print(f.tree())
# Or
#   And
#     text
#     Not
#       me
#   command(start)
```


## Текстовые фильтры

| Фильтр | Описание |
|--------|-------------|
| `text` | Сообщение содержит любой текстовый контент |
| `command("start", "help")` | Соответствует командам с префиксом `/` или `!`; устанавливает `msg.cmd` и `msg.args` |
| `regex(r"\d+")` | Текст соответствует регулярному выражению; устанавливает `msg.match` |
| `fullmatch(r"\d+")` | Полный текст соответствует регулярному выражению; устанавливает `msg.match` |
| `findall(r"\w+")` | Все совпадения регулярных выражений; устанавливает `msg.finds` |
| `finditer(r"\w+")` | Итератор регулярных выражений соответствует; устанавливает `msg.finds` |
| `split(r"\s+")` | Разделить текст по регулярному выражению; устанавливает `msg.parts` |
| `contains("word")` | Текст содержит подстроку (по умолчанию без учета регистра) |
| `contains_any("a", "b")` | Текст содержит любую из подстрок |
| `contains_all("a", "b")` | Текст содержит все подстроки |
| `startswith("Hello")` | Текст начинается с префикса |
| `endswith("!")` | Текст заканчивается суффиксом |
| `text_len(min=1, max=100)` | Диапазон длины текста |
| `word_count(min=2, max=50)` | Диапазон количества слов |
| `line_count(min=1, max=10)` | Диапазон количества строк |
| `numeric` | Текст является допустимым числом |
| `json_text` | Текст действителен JSON |
| `is_language("ru", min_confidence=0.7)` | Распознавание языка |

## Фильтры сущностей

Проверьте наличие определенных объектов Telegram в тексте сообщения или заголовках:

`has_url`, `has_mention`, `has_hashtag`, `has_cashtag`, `has_email`, `has_phone`, `has_bold`, `has_italic`, `has_code`, `has_pre`, `has_spoiler`, `has_custom_emoji`, `has_blockquote`, `has_underline`, `has_strikethrough`, `has_text_link`, `has_text_mention`, `has_bank_card`, `mentioned`, `has_entity("type")`


```python
@app.on_msg(filt=filters.has_url)
async def links(msg): ...

@app.on_msg(filt=filters.has_entity("bold"))
async def bold_text(msg): ...
```


## Медиа-фильтры

Обнаружение типов и атрибутов мультимедиа:

**Определение типа**: `photo`, `video`, `audio`, `document`, `sticker`, `animation`, `voice`, `video_note`, `location`, `contact`, `venue`, `dice`, `game`, `invoice`, `story`, `giveaway`

**Агрегат**: `media` (любой тип носителя), `media_group` (альбом), `caption` (с подписью).

**Атрибуты**: `media_size(min, max)`, `media_duration(min, max)`, `media_mime("image/png")`, `media_width(min)`, `media_height(max)`, `file_name("doc.pdf")`, `specific_media_group(n)`, `album_len(n)`


```python
@app.on_msg(filt=filters.photo & filters.caption)
async def captioned_photo(msg): ...

@app.on_msg(filt=filters.media_size(min=1024*1024))
async def large_files(msg): ...
```


## Фильтры подписей

Фильтры, работающие с заголовками мультимедиа (поле `caption`, отличное от `text`):

`caption_regex`, `caption_contains`, `caption_len`

## Фильтры чата

| Фильтр | Матчи |
|--------|---------|
| `private` | Приватный чат (user_id > 0) |
| `group` | Базовая группа |
| `supergroup` | Супергруппа |
| `channel` | Канал |
| `forum` | Форум (супергруппа с темами) |
| `chat_type("private")` | Общая проверка типа чата |
| `chat(123456789)` | Точный идентификатор чата |
| `any_chat(111, 222)` | Любой из указанных идентификаторов чата |
| `not_chat(111)` | Нет в указанных идентификаторах чата |
| `topic(5)` | Идентификатор ветки сообщений/темы |

## Фильтры отправителей

| Фильтр | Матчи |
|--------|---------|
| `me` | Сообщение от текущего аккаунта |
| `from_user(123456)` | От определенного идентификатора пользователя |
| `from_any(111, 222)` | От любого из указанных пользователей |
| `not_from(111)` | Не от этого пользователя |
| `is_bot` | От бота |
| `is_premium` | От премиум-пользователя |
| `is_verified` | С подтвержденного аккаунта |
| `is_scam` | Из аккаунта, помеченного как мошенничество |
| `is_fake` | С фейкового аккаунта |
| `is_support` | Из службы поддержки Telegram |
| `is_contact` | Из сохраненного контакта |
| `is_mutual_contact` | От взаимного контакта |
| `lang_code("ru")` | Код языка пользователя |

## Фильтры свойств сообщений

`edited`, `forwarded`, `reply`, `pinned`, `has_protected_content`, `has_media_spoiler`, `via_bot`, `is_topic_message`, `has_markup`, `has_inline_kbd`, `has_reply_kbd`, `has_web_preview`, `silent`, `from_offline`, `effect`, `noforwards`, `views(min)`, `forwards(min)`, `reaction`, `has_sender_name`, `signature`, `message_id`

## Фильтры служебных сообщений

Обнаружение типов сообщений службы Telegram:

`service`, `new_chat_members`, `left_chat_member`, `new_chat_title`, `new_chat_photo`, `delete_chat_photo`, `group_created`, `supergroup_created`, `channel_created`, `migrate_to`, `migrate_from`, `pinned_msg`, `connected_website`, `proximity_alert`, `video_chat_started`, `video_chat_ended`, `video_chat_scheduled`, `message_auto_delete_timer`, `successful_payment`, `refunded_payment`, `users_shared`, `chat_shared`, `write_access_allowed`, `boost_added`, `forum_topic_created`, `forum_topic_edited`, `forum_topic_closed`, `forum_topic_reopened`, `general_forum_topic_hidden`, `general_forum_topic_unhidden`, `giveaway_created`, `giveaway_completed`, `giveaway_winners`

## Фильтры обратного вызова

| Фильтр | Описание |
|--------|-------------|
| `cb_data("payload")` | Точное совпадение по `callback_data` |
| `cb_startswith("page_")` | `callback_data` начинается с префикса |
| `cb_endswith("_confirm")` | `callback_data` заканчивается суффиксом |
| `cb_contains("admin")` | `callback_data` содержит подстроку |
| `cb_regex(r"page_\d+")` | `callback_data` соответствует регулярному выражению; устанавливает `cb.match` |
| `cb_payload("action", "id")` | Разобрать формат `action:id:extra`; устанавливает `cb.payload` |
| `cb_json()` | Разобрать `callback_data` как JSON; устанавливает `cb.json_data` |
| `cb_kvp("key", "value")` | Разобрать формат `key=value\nexpr` |
| `cb_from(123456)` | От конкретного пользователя |
| `cb_chat(123456)` | В специальном чате |
| `cb_msg(42)` | По конкретному сообщению |
| `cb_game` | Обратный вызов игры |
| `cb_any` | Любой запрос обратного вызова |

## Фильтры опросов

| Фильтр | Описание |
|--------|-------------|
| `poll_filter` | Любое событие опроса |
| `poll_closed` | Опрос только что закрылся |
| `poll_open` | Опрос все еще открыт |
| `poll_question("What...")` | Текст вопроса совпадает |
| `poll_contains("word")` | Вопрос содержит текст |
| `poll_regex(r"...")` | Вопрос соответствует регулярному выражению |
| `poll_type("regular"|"quiz")` | Тип опроса |
| `poll_chat(123456)` | В специальном чате |
| `poll_option(0)` | Конкретный вариант проголосовал |
| `poll_any` | Любое событие опроса |
| `poll_answer` | Ответ на опрос (не создание опроса) |

## Фильтры участников

| Фильтр | Описание |
|--------|-------------|
| `member_joined` | Пользователь присоединился |
| `member_left` | Пользователь ушел |
| `member_banned` | Пользователь был забанен/выкинут |
| `member_unbanned` | Пользователь был разбанен |
| `member_promoted` | Пользователь повышен до администратора |
| `member_demoted` | Администратор понижен в должности до члена |
| `member_restricted` | Пользователь ограничен |
| `member_unrestricted` | Пользователь неограничен |
| `member_status("administrator")` | Конкретное изменение статуса |
| `member_chat(123456)` | В специальном чате |
| `member_user(123456)` | Влияние на конкретного пользователя |
| `member_by(123456)` | Действия конкретного администратора |
| `member_self` | Влияние на самого бота/пользовательского бота |
| `member_any` | Любое мероприятие для участников |

## Фильтры перекрестного типа

| Фильтр | Описание |
|--------|-------------|
| `update_type("msg")` | События определенного вида: `"msg"`, `"cb"`, `"poll"`, `"member"` |
| `network("bot")` | События от конкретного транспорта: `"bot"` или `"mt"` |
| `user(123456)` | От определенного идентификатора пользователя для всех типов событий |

## Фильтры состояний FSM

Фильтровать обработчики на основе текущего состояния FSM пары чат+пользователь:


```python
from goygram.filters import state, state_any

@app.on_msg(filt=filters.text & state("waiting_name"))
async def get_name(msg):
    name = msg.text
    app.set_state(msg.chat_id, msg.from_id, "waiting_age", {"name": name})
    await msg.reply("How old are you?")

@app.on_msg(filt=filters.text & state_any("waiting_age", "waiting_email"))
async def get_details(msg):
    ...
```

- `state("name")` — срабатывает только если `app.get_state(chat_id, user_id) == "name"`
- `state_any("a", "b", "c")` — срабатывает, если состояние является любым из заданных имен.

## Операторы композиции

| Оператор | Метод | Описание |
|----------|--------|-------------|
| `&` | `all_of(f1, f2, ...)` | Все фильтры должны пройти (И) |
| `\|` | `any_of(f1, f2, ...)` | Любой фильтр должен пройти (ИЛИ) |
| `~` | `invert(f)` | Отменить фильтр (НЕ) |
| `^` | — | Эксклюзивное ИЛИ |
| `-` | — | И НЕ (`self & ~other`) |
| — | `none_of(f1, f2)` | Фильтр не проходит |
| — | `at_least(n, f1, f2, ...)` | Проходит как минимум N фильтров |
| — | `at_most(n, f1, f2, ...)` | Проходит не более N фильтров |
| — | `exactly(n, f1, f2, ...)` | Ровно N фильтров проходят |

## Фильтры с отслеживанием состояния

Фильтры, которые отслеживают свое состояние при вызовах:

| Фильтр | Описание |
|--------|-------------|
| `once` | Срабатывает ровно один раз, потом больше никогда |
| `limit(5)` | Всего пожаров не более N раз |
| `every_n(3)` | Вызывает каждое N-е соответствующее событие |
| `cooldown(60)` | Срабатывает не чаще одного раза в N секунд |
| `throttled(rate=5, per=60)` | Не более N событий за M секунд |


```python
# Only handle the first 10 start commands
@app.on_msg(filt=filters.command("start") & filters.limit(10))
async def first_ten(msg): ...

# Rate limit spam to 3 messages per 60 seconds
@app.on_msg(filt=filters.text & filters.throttled(3, 60))
async def rate_limited(msg): ...
```


## Фильтры утилит

| Фильтр | Описание |
|--------|-------------|
| `any_filter` | Всегда проходит |
| `none_filter` | Всегда терпит неудачу |
| `func(callable)` | Оберните любой вызываемый объект `(event) -> bool` |
| `filter_data(key="value")` | Соответствие необработанным полям событий |
| `if_(condition_filter, then_filter, else_filter)` | Условное ветвление |
| `unless(condition_filter, body_filter)` | `body_filter` срабатывает, если `condition_filter` не соответствует |

## Использование фильтров

Фильтры работают со всеми декораторами обработчиков:


```python
@app.on_msg(filt=filters.text & ~filters.me)
async def text_not_me(msg): ...

@app.on_cb(filt=filters.cb_startswith("page_"))
async def page_cb(cb): ...

@app.on_poll(filt=filters.poll_closed & filters.poll_chat(MY_GROUP))
async def closed_polls(poll): ...

@app.on_member(filt=filters.member_joined)
async def welcomes(mem): ...

@app.on_update(filt=filters.update_type("msg"))
async def catch_all(event): ...
```


## Пользовательские фильтры

Любой вызываемый `(event) -> bool`, завернутый в `Filter()`, работает:


```python
from goygram.filters import Filter

@app.on_msg(filt=Filter(lambda msg: msg.chat_id == MY_CHANNEL))
async def my_channel(msg): ...
```


## Примечания по производительности

- Оценка фильтра **синхронная** — без асинхронности, без ввода-вывода.
- Деревья выражений создают новые объекты `Filter` во время композиции, а не во время оценки.
- Короткое замыкание составных фильтров: `f1 & f2` останавливается на `f1`, если возвращает `False`.
- Фильтры `command` и `regex` изменяют объект события через `__setattr__` — они устанавливают `cmd`/`args` или `match`/`finds`/`parts` для события для использования обработчиком.
- Фильтры с отслеживанием состояния (`once`, `limit`, `cooldown`, `throttled`) поддерживают внутренние счетчики — они не являются потокобезопасными и не подлежат сериализации.