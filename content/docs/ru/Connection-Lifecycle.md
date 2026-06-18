---
title: "Жизненный цикл соединения"

---
# Жизненный цикл соединения

Как GoyGram устанавливает, поддерживает и разрывает сетевые соединения для обоих видов транспорта.

## Жизненный цикл API бота


```
app.run()
  │
  ├─ create_task(bot.spin())
  │     │
  │     ├─ bot.boot()
  │     │    └─ aiohttp.ClientSession(timeout=35s, trust_env=True)
  │     │
  │     ├─ delete_webhook(drop_pending_updates=False)  # clear conflicts
  │     │
  │     └─ while not stop_ev:
  │           └─ getUpdates(offset=off, timeout=25s)
  │                └─ for each update: norm() → bus.push("bot", data)
  │
  └─ await stop_ev.wait()  # blocks until stop() called
       │
       └─ close()
            ├─ bot.close() → sess.close()
            └─ disp.close() → stop_ev.set()
```


### Повторное использование соединения

`aiohttp.ClientSession` создается один раз в `boot()` и используется повторно. `trust_env=True` означает, что переменные среды `HTTP_PROXY`/`HTTPS_PROXY` учитываются для HTTP-соединений.

### Тайм-аут

- Тайм-аут HTTP-запроса: `self.timeout + 10` (по умолчанию 35 секунд).
- `getUpdates` тайм-аут длительного опроса: `self.timeout` (по умолчанию 25 сек.)

### Повторное подключение

Если HTTP-соединение разрывается, `aiohttp` прозрачно создает новое TCP-соединение при следующем запросе. Объект сеанса управляет пулом соединений.

## Жизненный цикл MTProto


```
app.run()
  │
  ├─ create_task(mt.spin())
  │     │
  │     ├─ await auth_ready.wait()  # block until DH completes
  │     │
  │     └─ while not stop_ev:
  │           ├─ read_packet()      # TCP read (blocks)
  │           └─ _handle_encrypted_packet()
  │
  └─ bootstrap_session()
       │
       ├─ if vault exists:
       │    ├─ decrypt vault → restore auth_key, DC
       │    ├─ mt.boot()           # TCP connect
       │    ├─ mt.ensure_auth_key() # if no key, DH exchange
       │    └─ auth_ready.set()
       │
       └─ if no vault:
            └─ interactive auth → save vault → auth_ready.set()
```


### TCP-соединение


```python
async def boot(self):
    if self.rd and self.wr and not self.wr.is_closing():
        return  # already connected

    px = self.proxy_cfg()
    if px is not None:
        self.rd, self.wr = await self.open_via_proxy(px)
    else:
        self.rd, self.wr = await asyncio.open_connection(self.host, self.port)

    # Send transport tag
    self.wr.write(b"\xee\xee\xee\xee")
    await self.wr.drain()
```


Соединение постоянное — один TCP-сокет на все время существования сеанса. Если соединение обрывается:

1. `read_packet()` обнаруживает пустое чтение → `ConnectionError('mt socket closed')`
2. Все отложенные фьючерсы не состоялись, за исключением
3. `spin()` завершает работу с исключением
4. Задача asyncio завершается.
5. **Нет автоматического переподключения** — приложение необходимо перезапустить.

### Миграция DC

Во время аутентификации миграция DC вызывает полное переподключение к другому IP-адресу. См. [Система маршрутизации постоянного тока](Система маршрутизации постоянного тока).

### Выключение


```python
async def close(self):
    if self.wr:
        self.wr.close()
        await self.wr.wait_closed()
        self.wr = None
        self.rd = None
```


## Грамотное завершение работы


```
stop() called (or KeyboardInterrupt)
  │
  ├─ stop_ev.set()
  │
  ├─ disp.consume() exits while loop
  ├─ bot.spin() exits while loop
  ├─ mt.spin() exits while loop (if not already dead)
  │
  └─ close()
       ├─ bot.close() → close HTTP session
       ├─ mt.close() → close TCP socket
       └─ cancel all tasks → gather with return_exceptions=True
```


## Обработка сигнала (быстрый выход)


```python
signal.signal(signal.SIGINT, _instant_exit)
signal.signal(signal.SIGTERM, _instant_exit)

def _instant_exit(signum, frame):
    os._exit(0)  # immediate process death
```


Это полностью обходит корректное завершение работы. Блок `finally` в `run()` по-прежнему выполняется для завершения работы на основе `stop_ev`, но нажатие Ctrl+C переходит прямо к `_exit`.