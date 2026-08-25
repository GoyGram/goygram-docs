---
title: "Обработчики и обновления"
---

# Обработчики и обновления

Обработчики нужно зарегистрировать до `run()`.

```python
@app.on_msg
async def every_message(msg):
    print(msg.text)

@app.on_msg(filt=filters.text & ~filters.me)
async def incoming_text(msg):
    await msg.reply("получено")

@app.on_cmd("help", "about")
async def help_command(msg):
    await msg.reply("Команды: /help и /about")
```

## Какие события бывают

- `on_msg` получает сообщение `MsgObj`;
- `on_cb` получает нажатие inline-кнопки `CbObj`;
- `on_poll` получает ответ на опрос `PollObj`;
- `on_member` получает изменение участника `MemberObj`;
- `on_update` получает необработанное нормализованное обновление.

Все обработчики должны быть `async def`. Сначала проверяется фильтр, затем вызывается функция. Для одного обновления могут сработать несколько подходящих обработчиков.

`MsgObj` содержит `text`, `chat_id`, `from_id`, `id`, `cmd`, `args` и другие поля сообщения. `await msg.reply(...)` отвечает в том же чате, `await msg.delete()` удаляет сообщение.
