---
title: "Планирование и фоновая работа"
---

# Scheduling and background work

GoyGram deliberately keeps application scheduling simple: the client owns Telegram I/O, while your application owns background tasks and cancellation policy.

## Start a periodic task

Create background work from your program's async entry point, then run the client in the same event loop.


```python
import asyncio
from goygram import GoyGram

app = GoyGram(bot_token="TOKEN")

async def heartbeat():
    while True:
        await app.send_message(chat_id=123456, text="still alive")
        await asyncio.sleep(3600)

async def main():
    task = asyncio.create_task(heartbeat())
    try:
        await app.run()
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

asyncio.run(main())
```


Keep a reference to every task you create. On shutdown, cancel tasks and await them with `return_exceptions=True` so a cancelled sleep does not mask a real shutdown error.

## Avoid blocking handlers

Handlers share the event loop with Telegram polling and MTProto reads. Do not run blocking I/O or CPU-heavy work directly inside a handler. Prefer an asynchronous library, queue work to a worker, or move CPU-bound work to `asyncio.to_thread` / a process pool.


```python
@app.on_cmd("report")
async def report(msg):
    result = await asyncio.to_thread(build_report)
    await msg.reply(result)
```


## State expiration

[[Keyboards-Formatting-and-State|State entries]] can receive a TTL. GoyGram's runtime starts the FSM cleanup loop automatically, so expired entries disappear while `app.run()` is active.

For external schedulers such as systemd timers, cron, or a worker queue, keep the Telegram client startup separate from the job implementation and initialize only the transport that the job requires.