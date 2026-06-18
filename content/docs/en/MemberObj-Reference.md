---
title: MemberObj Reference
---

# MemberObj Reference

`MemberObj` represents chat member status change events — `chat_member` and `my_chat_member` updates from the Bot API long-polling stream.

## Structure

```python
class MemberObj:
    __slots__ = ("src", "raw", "app", "chat_id", "from_id",
                 "user_id", "old", "new", "kind")

    def __init__(self, src: str, raw: dict[str, Any], app: Any) -> None:
        self.src = src
        self.raw = raw
        self.app = app
        self.chat_id = raw.get("chat_id")
        self.from_id = raw.get("from_id")
        self.user_id = raw.get("user_id")
        self.old = raw.get("old_status")
        self.new = raw.get("new_status")
        self.kind = raw.get("kind", "member")
```

## Fields

| Field | Source in raw | Description |
|-------|---------------|-------------|
| `chat_id` | `chat.id` from normalized update | ID of the chat/channel where the change occurred |
| `from_id` | `from.id` from normalized update | ID of the user who initiated the change (e.g. admin who promoted) |
| `user_id` | `new_chat_member.user.id` or `old_chat_member.user.id` | ID of the affected user |
| `old` | `old_chat_member.status` | Previous status before the change |
| `new` | `new_chat_member.status` | New status after the change |
| `kind` | — | Always `"member"` |

## Status Values

The `old` and `new` fields contain standard Bot API status strings:

- `"creator"` — chat owner
- `"administrator"` — admin
- `"member"` — regular member
- `"restricted"` — restricted member
- `"left"` — left the chat
- `"kicked"` — kicked/banned

## Normalization from Bot API

In `BotNet.norm()`, both `chat_member` and `my_chat_member` updates are normalized into a unified format:

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

The key distinction between `chat_member` and `my_chat_member`:
- `chat_member` — any member's status changed in a chat the bot is in
- `my_chat_member` — the bot's own status changed

Both produce the same normalized format and are dispatched to the same `on_member` handlers.

## Event Flow

1. `BotNet.spin()` polls `getUpdates` with `allowed_updates=["chat_member", "my_chat_member"]`
2. `BotNet.norm()` normalizes the update into a dict with `kind: "member"`
3. The packet is pushed to the event bus
4. `Disp.consume()` → `Disp.one()` creates `MemberObj` and iterates `app.member_hook`

## on_member() Handler

```python
app = GoyGram(bot_token="...")

@app.on_member
async def handle_member(mem: MemberObj):
    # Track new members
    if mem.new == "member" and mem.old in ("left", None):
        await app.bot.send_msg(
            mem.chat_id,
            f"Welcome, user {mem.user_id}!"
        )

    # Detect kicks
    if mem.new == "kicked" and mem.old == "member":
        await app.bot.send_msg(
            mem.chat_id,
            f"User {mem.user_id} has been removed."
        )

    # Track admin promotions
    if mem.new == "administrator":
        await app.bot.send_msg(
            mem.chat_id,
            f"New admin: user {mem.user_id}"
        )
```

## Using with Filters

Combine `on_member` with the filter system for granular control:

```python
from goygram.filters import Filter

# Only react to kicks
kick_filter = Filter(lambda mem: bool(mem.new == "kicked"))

@app.on_member(filt=kick_filter)
async def on_kick(mem: MemberObj):
    await app.bot.send_msg(
        mem.chat_id,
        f"User {mem.user_id} was kicked."
    )
```

## Accessing Raw Data

The `raw` field preserves the original Bot API update dict, allowing access to fields not surfaced in the normalized format:

```python
@app.on_member
async def debug_member(mem: MemberObj):
    raw_update = mem.raw
    invite_link = raw_update.get("invite_link")
    if invite_link:
        print(f"Joined via invite: {invite_link}")
```

## Transport Note

`MemberObj` is Bot API-only (always `src = "bot"`). MTProto has a different mechanism for member updates (channel participant events in the updates stream), which are handled separately through the MTProto event pipeline.
