---
title: "Как писать код"
---

# Как писать код для GoyGram

Здесь показано, как сделать простого бота. Сначала выберите способ подключения к Telegram.

## Бот через Bot API

Создайте файл `bot.py`:

```python
import asyncio
from goygram import GoyGram, filters

app = GoyGram(bot_token="ВАШ_ТОКЕН_БОТА")

@app.on_msg(filt=filters.text)
async def echo(msg):
    await msg.reply("Я получил: " + msg.text)

asyncio.run(app.run())
```

Разберём по шагам:

1. `import asyncio` позволяет Python ждать сеть и не замораживать всё приложение.
2. `GoyGram(...)` создаёт приложение.
3. `bot_token` — пароль бота. Его нельзя публиковать.
4. `@app.on_msg(...)` говорит: «когда придёт сообщение, вызови функцию ниже».
5. `filters.text` оставляет только сообщения с текстом.
6. `echo` получает объект сообщения в переменной `msg`.
7. `msg.text` — текст входящего сообщения.
8. `msg.reply(...)` отправляет ответ через тот же транспорт.
9. `asyncio.run(app.run())` запускает приложение и оставляет его ждать новые сообщения.

## Команда

```python
@app.on_cmd("ping")
async def ping(msg):
    await msg.reply("pong")
```

Функция вызывается на `/ping`. В `on_cmd` имя пишется без символа `/`.

## Фильтры

```python
@app.on_msg(filt=filters.text & ~filters.me)
async def only_other_people(msg):
    await msg.reply("Это написал другой человек")
```

- `&` означает «и»;
- `|` означает «или»;
- `~` означает «не»;
- `filters.me` проверяет сообщения текущего аккаунта или бота.

## Пользовательский аккаунт через MTProto

```python
import asyncio
from goygram import GoyGram

app = GoyGram(
    api_id=ВАШ_API_ID,
    api_hash="ВАШ_API_HASH",
    session_name="main",
)

@app.on_cmd("ping")
async def ping(msg):
    await msg.reply("pong from MTProto")

asyncio.run(app.run())
```

При первом запуске GoyGram может попросить номер телефона, код Telegram и пароль двухфакторной защиты. Не записывайте их в исходник. Сессия сохраняется в vault-файле.

## Вызов Bot API

```python
await app.send_document(chat_id=123456789, document=file_object)
await app.get_chat(chat_id=123456789)
await app.set_my_commands(commands=[])
```

Имена с подчёркиваниями преобразуются в имена Bot API. Bot API и MTProto — разные интерфейсы, поэтому их параметры не всегда одинаковы.

## Ошибки

```python
import logging

try:
    await msg.reply("Ответ")
except Exception as error:
    logging.getLogger("goygram.app").exception("Не удалось отправить ответ: %s", error)
```

Не печатайте в журнал токен, vault или ключ аутентификации.

## Как добавить новую функцию

1. Решите, нужен Bot API или MTProto.
2. Выберите событие: сообщение, callback, опрос или участник.
3. Напишите маленький обработчик.
4. Добавьте фильтр.
5. Проверьте обычный случай и ошибку.
6. Если меняется состояние, проверьте повторный запуск и очистку состояния.
7. Не создавайте новый сетевой клиент для каждого сообщения.

## Запуск

```bash
python bot.py
GOYGRAM_LOG=DEBUG python bot.py
```

`DEBUG` нужен для подробной диагностики. Для обычной работы лучше `INFO` или `WARNING`.
