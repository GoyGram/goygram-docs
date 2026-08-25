---
title: Writing Code
---

# Как писать код для GoyGram

Эта страница объясняет код без лишней теории. Сначала выберите, кто будет подключаться к Telegram.

## 1. Бот через Bot API

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

Что здесь происходит:

1. `import asyncio` даёт Python возможность ждать сеть, не блокируя всё приложение.
2. `GoyGram` создаёт приложение.
3. `bot_token` говорит Telegram, какого бота запускать. Токен нельзя публиковать.
4. `@app.on_msg(...)` говорит: «когда придёт сообщение, вызови функцию ниже».
5. `filters.text` пропускает сообщения, в которых есть текст.
6. `echo` получает объект сообщения в переменной `msg`.
7. `msg.text` — текст входящего сообщения.
8. `msg.reply(...)` отправляет ответ через тот же транспорт.
9. `asyncio.run(app.run())` запускает бесконечное ожидание обновлений.

## 2. Команда

```python
@app.on_cmd("ping")
async def ping(msg):
    await msg.reply("pong")
```

Теперь функция вызывается на `/ping`. Имя команды пишется без `/`.

## 3. Фильтры

```python
@app.on_msg(filt=filters.text & ~filters.me)
async def only_other_people(msg):
    await msg.reply("Это написал не я")
```

- `&` означает «и».
- `|` означает «или».
- `~` означает «не».
- `filters.me` проверяет, что сообщение отправил текущий аккаунт или бот.

## 4. Пользовательский аккаунт через MTProto

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

При первом запуске программа может попросить номер телефона, код Telegram и пароль двухфакторной защиты. Эти данные не нужно записывать в исходник. Сессия сохраняется в vault-файле.

## 5. Вызов метода Bot API

Явный метод:

```python
await app.send_document(chat_id=123456789, document=file_object)
```

Динамический метод:

```python
await app.get_chat(chat_id=123456789)
await app.set_my_commands(commands=[])
```

GoyGram преобразует `snake_case` в имя Bot API. Для методов MTProto используется префикс `mt_`, если такой shortcut предусмотрен клиентом.

## 6. Ошибки

Сетевые вызовы могут завершиться ошибкой. На границе приложения лучше обрабатывать ожидаемые ошибки:

```python
try:
    await msg.reply("Ответ")
except Exception as error:
    app.logger.exception("Не удалось отправить ответ: %s", error)
```

Не печатайте в лог весь токен, vault или auth key.

## 7. Как добавлять новую функцию

1. Сначала решите, нужен Bot API или MTProto.
2. Найдите подходящий объект события: сообщение, callback, опрос или участник.
3. Напишите маленький обработчик.
4. Добавьте фильтр, чтобы обработчик не ловил чужие события.
5. Проверьте обычный путь и ошибочный путь.
6. Если функция меняет состояние, проверьте повторный запуск и очистку состояния.
7. Не меняйте transport вручную внутри обработчика без причины.

## 8. Чего не делать

- Не путайте `bot_token` с `api_hash`.
- Не отправляйте MTProto-запросы через Bot API URL.
- Не храните секреты в Git.
- Не называйте Linux wheel Android wheel.
- Не рассчитывайте, что любой метод Telegram автоматически имеет одинаковые параметры в Bot API и MTProto.
- Не создавайте новый сетевой клиент на каждое сообщение.

## 9. Запуск

```bash
python bot.py
```

Для подробного лога:

```bash
GOYGRAM_LOG=DEBUG python bot.py
```

В production обычно используют `INFO` или `WARNING`, чтобы случайно не получить слишком много технического вывода.
