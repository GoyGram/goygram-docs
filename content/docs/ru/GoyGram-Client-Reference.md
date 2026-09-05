---
title: "Справочник клиента"
---

# Справочник клиента GoyGram

```python
GoyGram(
    bot_token=None,
    mt_host=None, mt_port=None, mt_key=None, mt_iv=None,
    bot_timeout=25, bot_base="https://api.telegram.org", bus_max=0,
    api_id=None, api_hash=None, session_name="default", session=None,
    default_transport="auto", proxy=None,
    app_name=None, app_version=None, device_model=None,
    system_version=None, system_lang_code="en", lang_pack="", lang_code="en",
)
```

`bot_token` включает Bot API. `api_id` и `api_hash` включают MTProto. Если передать оба набора, приложение запустит оба транспорта: бот также авторизуется по MTProto через `auth.importBotAuthorization`. `session=` принимает объект `Session` или зашифрованную строку сессии. `default_transport` — `"api"`, `"mtproto"` или `"auto"`. `via="api"` / `via="mtproto"` выбирают транспорт для конкретного вызова.

## Жизненный цикл

- `await app.run()` запускает обработчики, состояние и настроенные транспорты;
- `app.stop()` просит приложение остановиться;
- `await app.close()` останавливает обработчики, состояние и сетевые соединения.

Обычно `run()` сам вызывает аккуратное закрытие.

## Помощники

- `app.ikb()` создаёт inline-клавиатуру;
- `app.rkb(**opts)` создаёт обычную reply-клавиатуру;
- `app.frk(**opts)` создаёт ForceReply;
- `app.rgk(**opts)` убирает клавиатуру;
- `app.html(text)` готовит текст с `parse_mode="HTML"`;
- `app.md(text)` готовит текст с `parse_mode="MarkdownV2"`;
- `app.raw_chat(chat_id)` убирает префикс `bot:` или `mt:`;
- `app.via(chat_id, via=None)` выбирает транспорт;
- `app.help()` печатает найденные методы.

## Состояние

```python
app.set_state(msg.chat_id, msg.from_id, "awaiting_name", {"step": 1}, ttl=300)
state = app.get_state(msg.chat_id, msg.from_id)
data = app.get_state_data(msg.chat_id, msg.from_id)
app.clear_state(msg.chat_id, msg.from_id)
```

Состояние хранится в памяти и привязано к паре `(chat_id, user_id)`. `ttl` удаляет запись после указанного времени. После перезапуска процесса состояние пропадает. Сохранение долгих диалогов во внешнюю базу — задача приложения.
