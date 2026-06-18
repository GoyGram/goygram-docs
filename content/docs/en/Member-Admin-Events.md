---
title: "Member / Admin Events"
---

# Member / Admin Events

Chat member updates — joins, leaves, promotions, bans, restrictions. Handled via `on_member()` and `MemberObj`.

## Registration

```python
@app.on_member()
async def member_handler(member):
    print(f"Chat {member.chat_id}: User {member.user_id} "
          f"went from {member.old} to {member.new}")
```

## MemberObj Reference

```python
class MemberObj:
    __slots__ = ("src", "raw", "app", "chat_id", "from_id",
                 "user_id", "old", "new", "kind")

    def __init__(self, src, raw, app):
        self.src = src                     # "bot" (Bot API only)
        self.raw = raw                     # original event dict
        self.app = app
        self.chat_id = raw.get("chat_id")  # where it happened
        self.from_id = raw.get("from_id")  # who initiated (admin, or the user)
        self.user_id = raw.get("user_id")  # the affected user
        self.old = raw.get("old_status")   # previous status
        self.new = raw.get("new_status")   # new status
        self.kind = raw.get("kind", "member")
```

## Bot API Normalization

In `BotNet.norm()`:

```python
mem = upd.get("chat_member") or upd.get("my_chat_member")
if isinstance(mem, dict):
    chat = mem.get("chat") or {}
    usr = mem.get("from") or {}
    old = mem.get("old_chat_member") or {}
    new = mem.get("new_chat_member") or {}
    target = new.get("user") or old.get("user") or {}

    return {
        "kind": "member",
        "src": "bot",
        "upd_id": upd.get("update_id"),
        "chat_id": chat.get("id"),
        "from_id": usr.get("id"),
        "user_id": target.get("id"),
        "old_status": old.get("status"),
        "new_status": new.get("status"),
        "raw": upd,
    }
```

## Status Values

| Status | Meaning |
|--------|---------|
| `"creator"` | Chat owner |
| `"administrator"` | Admin |
| `"member"` | Regular member |
| `"restricted"` | Restricted (read-only, etc.) |
| `"left"` | Left the chat |
| `"kicked"` | Banned/kicked |

## Common Patterns

```python
@app.on_member()
async def welcome_new(member):
    if member.new == "member" and member.old in ("left", "kicked", None):
        await app.bot.send_msg(member.chat_id,
                          f"Welcome back, user {member.user_id}!")

@app.on_member()
async def log_promotions(member):
    if member.old == "member" and member.new == "administrator":
        await app.bot.send_msg(member.chat_id,
                          f"User {member.user_id} is now an admin!")

@app.on_member()
async def detect_my_promotion(member):
    # my_chat_member update (my own status changed)
    if member.from_id == member.user_id:
        if member.new == "administrator":
            print(f"I was promoted in {member.chat_id}!")
```

## Dispatching

```python
# In Disp.one():
if kind == "member":
    mem = MemberObj(src, data, self.app)
    for fn in self.app.member_hook:
        try:
            await fn(mem)
        except Exception as e:
            self.log.error("Handler failure: %r", e)
```

## MTProto Note

Member events currently only come from Bot API (`chat_member` / `my_chat_member` update types). MTProto has `UpdateChatParticipant` and `UpdateChannelParticipant` but they're not yet parsed into member events — they'd need to be added to the `_handle_encrypted_packet` update handler.
