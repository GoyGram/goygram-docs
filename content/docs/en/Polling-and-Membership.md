---
title: Polling and Membership
---

# Polls and membership updates

GoyGram keeps the common event path small and preserves the complete update in `raw`.

## Poll updates

For Bot API poll answers, `on_poll` receives `PollObj` with `src`, `raw`, `app`, `id`, `question`, `closed`, and `kind`. Poll-specific fields are available lazily through attributes, `.get()`, and `[]` when they are present in the source update:

```python
@app.on_poll(filt=filters.poll_open)
async def poll_answer(poll):
    print(poll.question)
    print(poll.get("option_ids", []))
    print(poll.raw)
```

Use `filters.poll_filter(...)`, `poll_open`, `poll_closed`, `poll_question(...)`, `poll_contains(...)`, `poll_regex(...)`, `poll_type(...)`, `poll_chat(...)`, `poll_option(...)`, `poll_any`, and `poll_answer` to select poll events.

## Chat-member updates

`on_member` receives `MemberObj` with `src`, `raw`, `app`, `chat_id`, `from_id`, `user_id`, `old`, `new`, and `kind`. The complete Bot API `chat_member` or MTProto participant update remains in `raw`:

```python
@app.on_member(filters.member_joined)
async def joined(member):
    print(member.chat_id, member.user_id, member.from_id)
    print(member.old, member.new)
    print(member.raw)
```

Additional fields such as dates, privileges, custom titles, invite information, `qts`, and channel-list state are available through `member.get(...)` or `member[...]`.

## Generic MTProto updates

The current layer-229 schema contains 172 update-related constructors: 165 `Update` constructors and 7 `Updates` envelopes. Every structured constructor is decoded dynamically. Constructors without a specialized event object arrive through `on_update`:

```python
@app.on_update(filt=filters.update_type("updateMessageReactions"))
async def reactions(update):
    message_id = update.get("msg_id") or update.get("message_id")
    print(update.raw)
```

`on_update` also receives messages, edits, callbacks, polls, and members before their specialized handlers. Use `update.update_type` to distinguish the constructor.

## Recovery

MTProto persists `pts`, `qts`, `date`, and `seq`. After `updatesTooLong` or a reconnect gap, GoyGram requests `updates.getDifference`, applies its returned `state`, dispatches recovered messages and `other_updates`, and advances the durable cursor monotonically.
