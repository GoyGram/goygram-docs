---
title: "Rich-сообщения"
---

# Rich-сообщения

Rich Messages — формат сообщений нового поколения в Telegram: кнопки внутри текста, сворачиваемые блоки, коллажи, слайдшоу, карты, раскрываемые цитаты. GoyGram даёт билдер с нулём абстракций: каждый метод дописывает сырой HTML в плоский список частей, а финальная полезная нагрузка — один конструктор `inputRichMessageHTML` (MTProto) или один JSON-объект `{html}` (Bot API).

## Идея

Никаких классов-моделей и деревьев. `Rich` — это список частей; `build()` склеивает его:

```python
from goygram import Rich

r = Rich().b("Жирный").text(" обычный").nl().link("Сайт", "https://example.com")
print(r.to_html())
# <b>Жирный</b> обычный<br><a href="https://example.com">Сайт</a>
```

`to_html()` также превращает голые `\n` в `<br>` (Rich HTML схлопывает сырые переводы строк), `to_msg()` возвращает JSON-нагрузку Bot API, `to_tl()` — TL-конструктор MTProto.

## Отправка

```python
await app.send_rich(chat_id, r)                    # MTProto или Bot API, автоматически
await app.send_rich(chat_id, "<b>сырая html-строка</b>")  # обычная строка тоже работает
await app.edit_rich(chat_id, msg_id, r)           # правка на месте
```

Оба транспорта сами нормализуют переводы строк, так что прежний шим с подстановкой `<br>` больше не нужен.

## Кнопки внутри сообщения

Главная фича. Кнопки живут в теле сообщения, а не в reply-клавиатуре:

```python
r = (
    Rich()
    .b("Меню")
    .nl()
    .btn_row(
        Rich().btn_url("Открыть сайт", "https://example.com"),
        Rich().btn_user("Профиль", 111040773),
    )
    .btn_cb("Callback-кнопка", "menu:main")
)
await app.send_rich(chat_id, r)
```

Виды кнопок: `btn_url`, `btn_user`, `btn_cb` (callback data), `btn_app` (мини-апп), `btn_login`, `btn_inline` / `btn_inline_chosen` (переключатели inline-запроса), `btn_copy` (копирование в буфер), `btn_disabled`. У каждой кнопки есть необязательный `style` (positive / destructive / neutral). `btn_row(*buttons, align=...)` ставит несколько кнопок в один ряд, `buttons(rows, align=...)` рендерит список рядов.

## Блоки

```python
r = Rich()
r.details("Шаги", "1. установить\n2. импортировать\n3. готово")   # сворачиваемый <details>
r.list(["один", "два", "три"], ordered=True)                      # <ol>/<ul>
r.quote("Цитируемая строка", cite="Автор")                        # <blockquote>
r.pull_quote("Крупная врезка-цитата")                             # pull-quote блок
r.img("https://example.com/p.jpg", caption="Подпись к фото")      # HTTP(S) медиа-блок
r.video("https://example.com/v.mp4")
r.collage(["https://a/1.jpg", "https://a/2.jpg"], caption="Две")
r.slideshow([("https://a/1.jpg", "Первая"), ("https://a/2.jpg", "Вторая")])
r.map(55.75222, 37.61556)                                        # живая карта
r.math(r"E = mc^2")                                              # формула LaTeX
r.time(1757000000)                                               # локализованная дата
r.anchor("chapter-1")                                            # якорь навигации
r.emoji(5368324170671202286, "❤")                                # премиум-эмодзи
r.mention(111040773, "sam")                                      # упоминание пользователя
```

## Строчное форматирование

`text`, `b`, `i`, `u`, `s`, `spoiler`, `code`, `pre(lang)`, `link`, `heading(level)`, `nl`. Все они — однострочные дописывания без скрытого состояния.

## html_to_entities: классические сообщения MTProto с форматированием

Rich — один вариант; классические сообщения принимают сырой текст плюс явные TL-entities. GoyGram сам конвертирует HTML в эту пару:

```python
await app.send_msg(chat_id, "<b>жирный</b> <i>курсив</i>", parse_mode="html")
```

С `parse_mode="html"` на MTProto `send_msg`/`edit_msg` вырезают теги и автоматически прикладывают интервалы `messageEntityBold` / `messageEntityItalic` / `messageEntityTextUrl` / `messageEntityPre` / `messageEntitySpoiler` / `messageEntityBlockquote` / `inputMessageEntityMentionName` / `messageEntityCustomEmoji`. Та же функция импортируется напрямую:

```python
from goygram import html_to_entities
plain, entities = html_to_entities('<a href="tg://user?id=42">Sam</a> работает')
```

## split_html_text: длинный HTML без сломанных тегов

Раньше отправка длинного форматированного вывода требовала самописный сплиттер, заново открывающий теги в каждой части. Теперь:

```python
from goygram import split_html_text
for part in split_html_text(big_html, limit=4096):
    await app.send_msg(chat_id, part)
```

Функция токенизирует теги и текст, ведёт стек открытых тегов, резервирует место под закрывающие теги и открывает их заново в начале каждой части. Размер считается в UTF-16 единицах — так, как считает Telegram.

## extract_sent_message: единая форма ответа для отправки

`send_msg` / `send_media` возвращают сырой результат RPC: это может быть обёртка `updates`, голое сообщение или `updateShortSentMessage`. Достаньте словарь сообщения одним вызовом:

```python
from goygram import extract_sent_message
res = await app.send_msg(chat_id, "привет")
msg = extract_sent_message(res)
msg_id = msg["id"] if msg else None
```

## get_self

Информация о себе без рекурсивных блужданий по словарям:

```python
me = await app.get_self()          # закешированный словарь пользователя
me = await app.get_self(full=True) # добавляет результат users.getFullUser под ключом "full"
premium = me["full"].get("premium") if "full" in me else me.get("premium")
```

## camelCase динамическая диспетчеризация

Каждый из 185 методов Bot API и вся поверхность MTProto доступны через динамическую диспетчеризацию по атрибуту, в трёх стилях:

```python
await app.get_me()                     # явный сахар
await app.getMe()                      # camelCase Bot API
await app.AnswerInlineQuery(inline_query_id=q, results=[])  # тоже camelCase
await app.mt_users_getUsers(id=[{"_": "inputUserSelf"}])   # явный MTProto
await app.UsersGetUsers(id=[{"_": "inputUserSelf"}])        # camel MTProto
```

Имена, начинающиеся с известного MTProto-пространства (`users`, `channels`, `messages`, `contacts`, ...) идут в MTProto первыми; всё остальное — в Bot API. Существующие snake_case-методы выигрывают у любой динамической резолвции.
