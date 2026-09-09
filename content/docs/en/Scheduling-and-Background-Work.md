---
title: Scheduling and Background Work
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

## Built-in jobs: `every` and `later`

For the two most common scheduling shapes, GoyGram wraps `asyncio` for you — no decorators, no job store, no wrapper classes. Both accept sync and async callables and return the underlying `asyncio.Task`:

```python
# run forever every N seconds
task = app.every(3600, heartbeat)
task = app.every(30, poll_api, "feed-id")     # positional args pass through

# run once after a delay
task = app.later(10, remind, "check the oven") # keyword args pass through too
```

`every` never overlaps two runs of the same job: each tick waits for the previous call to finish before sleeping. Cancel the returned task to stop the job. These helpers keep a strong reference to the task, so a periodic job cannot be garbage-collected mid-flight.

## Conversations

`conv_wait` pauses a handler until the next message from the same chat arrives, with a timeout — the question/answer flow without FSM state plumbing:

```python
@app.on_cmd("name")
async def ask_name(msg):
    await msg.reply("What should I call you?")
    answer = await app.conv_wait(msg.chat_id, timeout=60)
    if answer is None:
        await msg.reply("Timed out, never mind.")
        return
    await msg.reply(f"Nice to meet you, {answer.text}")
```

`conv_wait(chat_id, user_id=None, filt=None, timeout=60)` can also wait for a specific user or filter the awaited message. Only messages from other users feed conversations; the bot's own messages keep flowing to handlers. A new `conv_wait` on the same chat supersedes an older pending waiter. The waiter is resolved before regular handlers run, so a conversation step can consume a message that would otherwise also fire `on_msg` handlers.

## Avoid blocking handlers

Handlers share the event loop with Telegram polling and MTProto reads. Do not run blocking I/O or CPU-heavy work directly inside a handler. Prefer an asynchronous library, queue work to a worker, or move CPU-bound work to `asyncio.to_thread` / a process pool.

```python
@app.on_cmd("report")
async def report(msg):
    result = await asyncio.to_thread(build_report)
    await msg.reply(result)
```

## State expiration

[State entries](/docs/Keyboards-Formatting-and-State) can receive a TTL. GoyGram's runtime starts the FSM cleanup loop automatically, so expired entries disappear while `app.run()` is active.

For external schedulers such as systemd timers, cron, or a worker queue, keep the Telegram client startup separate from the job implementation and initialize only the transport that the job requires.