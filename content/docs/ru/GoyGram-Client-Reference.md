---
title: "Справочник клиента"
---

# Справочник клиента GoyGram

```python
GoyGram(
    bot_token=None,
    mt_host=None, mt_port=None, mt_key=None, mt_iv=None,
    bot_timeout=25, bot_base="https://api.telegram.org", bus_max=0,
    webhook_url=None, webhook_host="127.0.0.1", webhook_port=8080,
    webhook_path="/telegram/webhook", webhook_secret_token=None,
    webhook_max_body=1048576, webhook_drop_pending_updates=False,
    api_id=None, api_hash=None, session_name="default", session=None,
    default_transport="auto", proxy=None,
    app_name=None, app_version=None, device_model=None,
    system_version=None, system_lang_code="en", lang_pack="", lang_code="en",
    bot_offset_path=None,
    intake="auto",
)
```

`bot_token` включает транспорт Bot API. Передача MTProto-credentials без явного эндпоинта включает MTProto и резолвит датацентр Telegram динамически. Если передать и то и другое, работают оба транспорта: бот дополнительно авторизуется по MTProto через `auth.importBotAuthorization`. `session=` принимает объект `Session` или зашифрованную строку сессии. `default_transport` — `"api"`, `"mtproto"` или `"auto"`. `via="api"` / `via="mtproto"` выбирают транспорт для конкретного вызова. `intake` управляет тем, какие каналы обновлений кормят диспетчер — `"auto"`, `"dual"`, `"mtproto"` или `"api"`; подробности в [режимах intake](/docs/Configuration-and-Transports).

## Жизненный цикл

- `await app.run()` запускает диспетчер, движок состояния и настроенные транспорты и ждёт остановки;
- `app.stop()` просит приложение остановиться;
- `await app.close()` останавливает движок состояния, диспетчер и сети.

## Динамический API

GoyGram не генерирует сотни Python-классов-обёрток. Схема грузится в рантайме, вызовы диспетчеризуются напрямую:

```python
result = await app.mt_req("messages.getHistory", peer=peer, limit=50)
result = await app.mt_messages_get_history(peer=peer, limit=50)
```

Любой метод из активной TL-схемы вызывается через `mt_req("namespace.method", ...)` или форму `mt_namespace_method(...)`. Методы Bot API — через `app.bot_req("method", ...)` или `app.method_name(...)`.

`app.help()` печатает доступную поверхность помощников. `app.core.mt.resolve_peer(...)` резолвит peer'а для MTProto — сохраняйте возвращённый конструктор и передавайте его в последующие вызовы.

## Помощники

- `app.ikb()`, `app.rkb(**opts)`, `app.frk(**opts)`, `app.rgk(**opts)` создают билдеры клавиатур;
- `app.html(text)` возвращает Bot API HTML-полезную нагрузку;
- `app.md(text)` возвращает Bot API MarkdownV2-полезную нагрузку;
- `app.raw_chat(chat_id)` убирает префикс `bot:`/`mt:`, если он есть;
- `app.via(chat_id, via=None)` выбирает настроенный транспорт;
- `app.transport` читает текущий транспорт по умолчанию, `app.switch("api"|"mt")` меняет его, `app.using("api"|"mt")` / `app.use_api()` / `app.use_mt()` — контекст-менеджеры, ограничивающие это действие областью;
- `app.me` — закешированный собственный ID; `await app.get_me(refresh=False)` резолвит и кеширует полный словарь своего пользователя через доступный транспорт;
- `app.group(name)` возвращает именованную группу обработчиков с `disable()` / `enable()` / `clear()`;
- `app.every(seconds, fn, ...)` планирует бесконечную периодическую задачу; `app.later(delay, fn, ...)` — разовую; обе возвращают `asyncio.Task`;
- `await app.conv_wait(chat_id, user_id=None, filt=None, timeout=60)` ставит обработчик на паузу до следующего подходящего сообщения в чате (см. [диалоги](/docs/Scheduling-and-Background-Work));
- `await app.download_file(file_id, destination=None)` скачивает файл Bot API;
- `await app.upload_file(source, **kw)` делегирует чанковую MTProto-загрузку;
- `await app.send_msg(chat_id, text, via=None, reply_to=None, kbd=None, **kw)` отправляет через выбранный транспорт;
- `app.iter_history(chat_id, limit=100, batch=100, via=None)` — асинхронный итератор по истории чата (MTProto, страницы лениво);
- `await app.count_history(chat_id, via=None)` возвращает общее число сообщений чата (MTProto);
- `app.set_state(...)`, `app.get_state(...)`, `app.get_state_data(...)`, `app.clear_state(...)` управляют лёгким FSM-состоянием.

## Сахарные помощники (0.7.74)

Клиент несёт слой удобств из [Sugar API](/docs/Sugar-API): отправку медиа (`send_photo`/`send_doc`/`send_audio`/`send_video`/`send_voice`/`send_sticker`/`send_animation` через `send_media`), `edit_msg`, `delete_msg`, `get_chat`/`get_user` (с кэшем), `copy_msg` (настоящий `copyMessage` в Bot API), `forward_msg`, `send_action`, `mark_read`, `send_reaction`, `pin_msg`, `ask(chat_id, text)` (отправка + ожидание ответа) и `app.iter_dialogs(limit, batch, folder)` — ленивый итератор диалогов MTProto.

0.7.75 добавил `search_messages`/`iter_search`, `vote_poll`, `get_forum_topics`, `send_media_group`, `download_media`, `get_self`, админ-помощники и camelCase-диспетчеризацию из [Rich API](/docs/Rich-API).

0.7.79 добавил доменный слой: истории (`get_stories`/`send_story`/`edit_story`/`delete_story`/`read_stories`/`get_story_views`/`export_story_link`), звёзды и подарки (`get_stars_balance`/`get_stars_history`/`get_star_gifts`/`send_star_gift`), черновики и отложенные сообщения (`save_draft`/`get_all_drafts`/`get_scheduled_messages`/`send_scheduled`/`delete_scheduled`), полное админство и модерацию (`restrict_member`/`promote_member`/`demote_member`/`set_slow_mode`/`get_invite_links`/`edit_invite_link`/`revoke_invite_link`/`approve_join_request`/`decline_join_request`) и takeout (`start_takeout`/`finish_takeout` + `takeout_id=` у любого вызова).

## Примитивы MTProto-транспорта

Прямой MTProto-транспорт даёт резолв peer'ов, вызовы по схеме, чанковые `upload_file` и `download_file`, надёжные курсоры обновлений, обработку реконнектов и сырой доступ через возвращаемые словари. Он сохраняет полную структурную TL-нагрузку вместо того, чтобы заводить Python-модель под каждый конструктор Telegram.

## Модель памяти и задержек

Общий путь события хранит компактный нормализованный объект плюс исходный сырой словарь. Специфичные поля сообщения резолвятся лениво через `msg.field`, `msg.get(...)` или `msg[...]`; в большую модель они не копируются. Это держит горячий путь маленьким, сохраняя специфичные поля Telegram и будущие дополнения слоя.
