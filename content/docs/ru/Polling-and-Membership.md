# Polls and membership updates

GoyGram exposes dedicated handlers for Telegram polls and chat-member changes. Register them before `run()` just like message handlers.

## Poll updates

```python
@app.on_poll
async def poll_changed(poll):
    print(poll.id, poll.question)
    for answer in poll.options:
        print(answer.text, answer.voter_count)
```

`PollObj` contains the poll identifier, question, options, total voter count, anonymous/multiple-answer flags, close state, and the correct option information supplied by Telegram for quiz polls.

Use a filter when only a subset is useful:

```python
from goygram import filters

@app.on_poll(filt=filters.func(lambda poll: poll.is_closed))
async def closed_poll(poll):
    print("closed:", poll.question)
```

## Chat-member updates

```python
@app.on_member
async def member_changed(member):
    print(member.chat.id, member.from_user.id)
```

`MemberObj` represents a `my_chat_member` or `chat_member` Bot API update. Its `old_chat_member` and `new_chat_member` fields preserve the Telegram payload, allowing applications to compare status or permissions according to their own policy.

## Raw updates

Not every Telegram update has a specialized object. Use `on_update` for the original update payload:

```python
@app.on_update
async def audit(update):
    print(update)
```

Raw updates are useful for observability and for Bot API additions that have not yet gained a convenience event. Do not rely on one exact dictionary shape across Bot API and MTProto; inspect and normalize the data needed by your application.

Related: [[Handlers-and-Updates]], [[Event-Objects]], and [[Filters]].