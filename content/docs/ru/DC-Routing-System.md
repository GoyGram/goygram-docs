---
title: "Система маршрутизации постоянного тока"
---

# Система маршрутизации постоянного тока

Маршрутизация DC (центр обработки данных) GoyGram является **динамической при запуске** с жестко закодированной резервной картой. У Telegram есть 5 рабочих контроллеров домена — фреймворк определяет, к какому из них подключиться, исходя из конфигурации и условий выполнения.

## Карта конечных точек DC

Жестко запрограммировано в `goygram/dc_fetcher.py`:


```python
def get_dynamic_dc_config(timeout=6):
    by_dc = {
        1: [DcEndpoint(dc_id=1, host="149.154.175.53", port=443)],
        2: [DcEndpoint(dc_id=2, host="149.154.167.50", port=443)],
        3: [DcEndpoint(dc_id=3, host="149.154.175.100", port=443)],
        4: [DcEndpoint(dc_id=4, host="149.154.167.91", port=443)],
        5: [DcEndpoint(dc_id=5, host="91.108.56.130", port=443)],
    }
    by_dc[0] = by_dc[2]  # DC 0 is an alias for DC 2
    return by_dc
```


Несмотря на то, что в названии функции указано «динамический», текущая реализация использует жестко запрограммированные IP-адреса. Параметр `timeout` принимается, но не используется — сигнатура функции существует для будущей динамической выборки из `https://google.com` (обычный метод обнаружения Telegram DC) или конечной точки конфигурации Telegram DC.

## Выбор DC при запуске

В `GoyGram.__init__`:


```python
if bot is None and resolved_host is None:
    # No explicit MTProto host configured — auto-select
    dc_map = get_dynamic_dc_config()
    selected = pick_dc_endpoint(dc_map, preferred_dc=2)  # default to DC 2
    resolved_host = selected.host
    resolved_port = selected.port
```


**DC 2 используется по умолчанию**, поскольку это точка входа для большинства регионов. Вы можете переопределить с помощью `mt_host`:


```python
app = GoyGram(api_id=123, api_hash="abc", mt_host="149.154.167.91")
```


## Алгоритм выбора постоянного тока


```python
def pick_dc_endpoint(dc_map, preferred_dc=None):
    # 1. Use preferred DC if available
    if preferred_dc is not None and preferred_dc in dc_map and dc_map[preferred_dc]:
        return dc_map[preferred_dc][0]

    # 2. Fallback: DC 0 (alias for DC 2)
    if 0 in dc_map and dc_map[0]:
        return dc_map[0][0]

    # 3. Iterate through DCs in priority order
    for dc_id in (2, 1, 4, 5, 3):
        if dc_id in dc_map and dc_map[dc_id]:
            return dc_map[dc_id][0]

    raise RuntimeError("No available endpoint in DC map")
```


## Миграция DC во время выполнения

Если во время операций MTProto сервер отвечает ошибкой `PHONE_MIGRATE_X` или `NETWORK_MIGRATE_X`, GoyGram автоматически повторно подключается к правильному DC:


```python
async def _mt_req_with_migrate(app, act, **kw):
    while True:
        res = await app.mt_req(act, **kw)
        err = _extract_error(res) or ""
        dc_id = _extract_migrate_dc(err)
        if dc_id is None:
            return res  # no migration needed

        # Look up the new DC endpoint
        dc_map = get_dynamic_dc_config()
        endpoint = pick_dc_endpoint(dc_map, preferred_dc=dc_id)

        # Close existing connection
        await app.mt.close()

        # Reset all MTProto state
        app.mt.host = endpoint.host
        app.mt.port = endpoint.port
        app.mt.auth_key = None
        app.mt.seq = 0
        app.mt._init_done = False
        app.mt.session_id = secrets.token_bytes(8)

        # Reconnect and re-authenticate
        await app.mt.boot()
        await app.mt.ensure_auth_key()

        # Loop: retry the request on the new DC
```


### Триггеры миграции

Функция `_extract_migrate_dc` ищет шаблоны ошибок:


```python
def _extract_migrate_dc(err_text):
    m = re.search(r"(?:PHONE|NETWORK)_MIGRATE_(\d+)", err_text.upper())
    if m:
        return int(m.group(1))
    return None
```


Это ловит:
- `PHONE_MIGRATE_5` → перейти на DC 5
- `NETWORK_MIGRATE_1` → перейти на DC 1
- Любой шаблон `*_MIGRATE_N`.

### Что сбрасывается при миграции

| Государство | Перезагрузить? | Причина |
|-------|--------|--------|
| `auth_key` | ✅ Установите `None` | Ключ аутентификации зависит от DC |
| `_init_done` | ✅ Установите `False` | `initConnection` необходимо отправить повторно |
| `session_id` | ✅ Новые случайные байты | Свежая сессия для нового DC |
| `seq` | ✅ Сбросить до 0 | Порядковые номера перезапускаются |
| `host` / `port` | ✅ Обновлено | Укажите на новый DC |
| `bus` | ❌ Сохранено | Тот же автобус событий |
| `pending` | ❌ Сохранено | Ожидающие фьючерсы остаются (но не будут отправлены повторно) |
| `stop_ev` | ✅ Повторно очищен | Новому соединению требуется новое состояние остановки |

## Восстановление Убежища DC

При восстановлении из хранилища используется сохраненный DC:


```python
dc = data.get("dc")
if dc is not None:
    if isinstance(dc, str) and "." in str(dc):
        app.mt.host = str(dc)  # direct IP override
    else:
        dc_map = get_dynamic_dc_config()
        endpoint = pick_dc_endpoint(dc_map, preferred_dc=int(dc))
        app.mt.host = endpoint.host
        app.mt.port = endpoint.port
```


Это обрабатывает два случая:
- **Строка с точками**: прямой IP-адрес (обратная совместимость со старыми хранилищами).
- **Целое**: номер контроллера домена, который можно найти на карте динамической конфигурации.

## Резервное поведение

Если динамическое разрешение DC полностью не удалось (ошибка сети, сбой DNS и т. д.):


```python
try:
    dc_map = get_dynamic_dc_config()
    selected = pick_dc_endpoint(dc_map, preferred_dc=2)
    resolved_host, resolved_port = selected.host, selected.port
except Exception as e:
    log.error("Dynamic DC routing failed: %r", e)
    resolved_host, resolved_port = "149.154.167.50", 443  # DC 2 hardcoded
    log.warning("Using fallback MT endpoint %s:%s", resolved_host, resolved_port)
```


DC 2 (`149.154.167.50:443`) — это окончательный запасной вариант. Если даже это не удастся, время ожидания TCP-соединения истечет.