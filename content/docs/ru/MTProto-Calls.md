---
title: "Вызовы MTProto"
---

# Вызовы MTProto

Используйте динамический MTProto API вместо ожидания сгенерированной обёртки. Актуальная схема Telegram даёт имена методов, аргументов, конструкторы и форму результата.

```python
dialogs = await app.mt_messages_get_dialogs(
    offset_date=0,
    offset_id=0,
    offset_peer={"_": "inputPeerEmpty"},
    limit=5,
    hash=0,
)
```

Это вызовет `messages.getDialogs`. Явная форма удобна, когда имя метода содержит пространство имён или нужна точная TL-запись:

```python
result = await app.mt_req("messages.getDialogs", limit=5, hash=0)
```

`mt_req()` убирает значения `None`, конвертирует объекты через `to_dict()`, подставляет настроенные API-метаданные, резолвит обычных peer'ов `messages.*`, где возможно, и возвращает результат, декодированный по схеме. Динамические вызовы принимают ключевые аргументы; используйте точные имена из текущей TL-схемы.

## Конструкторы и peer'ы

TL-конструкторы передаются словарями с полем `_`, либо уже сериализованным конструктором, если низкоуровневый метод требует именно его:

```python
peer = await app.core.mt.resolve_peer("some_username")
result = await app.mt_req("messages.getHistory", peer=peer, limit=50)
```

Не выдумывайте access hash. Для положительного ID пользователя или канала сначала резолвните сущность или передайте исходный peer-конструктор из декодированного ответа.

## Файлы и контейнеры

Лёгкий транспорт предоставляет:

- `await app.core.mt.upload_file(source, file_name=None, part_size=524288)`;
- `await app.core.mt.download_file(location, destination, offset=0, limit=524288)`;
- `await app.core.mt.send_container(calls)` для осознанного низкоуровневого батчинга.

Загрузки и скачивания используют ограниченные чанки и атомарную замену целевого файла. Сырые TL-вызовы остаются доступны для медиа, rich-сообщений, историй, реакций, business-обновлений и конструкторов, для которых ещё нет удобного помощника.

## Повторы и восстановление

Повторы `FloodWaitError` ограничены ключевым словом `retry=`. Курсоры обновлений MTProto (`pts`, `qts`, `date`, `seq`) персистятся, а после разрыва используется `updates.getDifference` — с 0.7.79 полным циклом по слайсам с обработкой `differenceTooLong`, плюс восстановление per-channel через `getChannelDifference` на `updateChannelTooLong`. Не создавайте второй цикл приёма: `app.run()` владеет reader'ом и диспетчером.

`FILE_REFERENCE_EXPIRED` при скачивании запускает автоматическое обновление ссылки и однократный повтор того же запроса.

## Takeout (выгрузка данных)

Любой MTProto-вызов принимает `takeout_id=` и оборачивается в `invokeWithTakeout` за вас:

```python
t = await app.start_takeout(files=True)
tid = t["result"]["id"]
rules = await app.mt_req("account.getPrivacy", takeout_id=tid, key={"_": "inputPrivacyKeyStatusTimestamp"})
await app.finish_takeout(tid, success=False)
```

`start_takeout` / `finish_takeout` — единственные методы, которые не оборачивают сами себя; всё остальное с `takeout_id` едет внутри takeout-контекста.

## Разбор результатов

Результаты — обычные словари/списки с ключом конструктора `_`, скалярными полями, вложенными конструкторами, векторами и сырыми значениями там, где схема не смогла декодировать узел. Проверяйте конструктор перед использованием результата и сохраняйте неизвестные поля для прямой совместимости.
