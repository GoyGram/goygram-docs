---
title: Filter System
---

# Filter System

GoyGram's filter system provides **100+ composable filters** for every event type. Filters support boolean operators (`&`, `|`, `~`, `^`, `-`), expression tree introspection, and stateful patterns like `cooldown`, `limit`, and `once`.

## The Filter Class

```python
@dataclass
class Filter:
    fn: Callable[[object], bool]
    _name: str | None = None
    _left: Filter | None = field(default=None, repr=False)
    _right: Filter | None = field(default=None, repr=False)
    _op: str | None = field(default=None, repr=False)

    def __call__(self, event: object) -> bool:
        return bool(self.fn(event))

    def __and__(self, other: Filter) -> Filter: ...
    def __or__(self, other: Filter) -> Filter: ...
    def __invert__(self) -> Filter: ...
    def __xor__(self, other: Filter) -> Filter: ...
    def __sub__(self, other: Filter) -> Filter: ...
```

Key properties:
- **Named filters**: Every built-in filter has a `_name` for debug/explain output
- **Expression tree**: `_left`, `_right`, `_op` track the composition tree for introspection
- **Operators**: `&` (AND), `|` (OR), `~` (NOT), `^` (XOR), `-` (AND NOT — `self & ~other`)

## Filter Introspection

### `explain(event)`

Recursively evaluates a filter tree against a real event and prints the result with ✓/✗ markers:

```python
f = filters.text & ~filters.me
print(f.explain(msg))
# text: ✓
# True & ...
# me: ✗
# ~False = ✓
# RESULT: ✓
```

### `tree()`

Renders the filter expression as an ASCII tree:

```python
f = (filters.text & ~filters.me) | filters.command("start")
print(f.tree())
# Or
#   And
#     text
#     Not
#       me
#   command(start)
```

## Text Filters

| Filter | Description |
|--------|-------------|
| `text` | Message has any text content |
| `command("start", "help")` | Matches commands with `/` or `!` prefix; sets `msg.cmd` and `msg.args` |
| `regex(r"\d+")` | Text matches regex; sets `msg.match` |
| `fullmatch(r"\d+")` | Full text matches regex; sets `msg.match` |
| `findall(r"\w+")` | All regex matches; sets `msg.finds` |
| `finditer(r"\w+")` | Regex iterator matches; sets `msg.finds` |
| `split(r"\s+")` | Split text by regex; sets `msg.parts` |
| `contains("word")` | Text contains substring (case-insensitive by default) |
| `contains_any("a", "b")` | Text contains any of the substrings |
| `contains_all("a", "b")` | Text contains all substrings |
| `startswith("Hello")` | Text starts with prefix |
| `endswith("!")` | Text ends with suffix |
| `text_len(min=1, max=100)` | Text length range |
| `word_count(min=2, max=50)` | Word count range |
| `line_count(min=1, max=10)` | Line count range |
| `numeric` | Text is a valid number |
| `json_text` | Text is valid JSON |
| `is_language("ru", min_confidence=0.7)` | Language detection |

## Entity Filters

Check for specific Telegram entities in message text or captions:

`has_url`, `has_mention`, `has_hashtag`, `has_cashtag`, `has_email`, `has_phone`, `has_bold`, `has_italic`, `has_code`, `has_pre`, `has_spoiler`, `has_custom_emoji`, `has_blockquote`, `has_underline`, `has_strikethrough`, `has_text_link`, `has_text_mention`, `has_bank_card`, `mentioned`, `has_entity("type")`

```python
@app.on_msg(filt=filters.has_url)
async def links(msg): ...

@app.on_msg(filt=filters.has_entity("bold"))
async def bold_text(msg): ...
```

## Media Filters

Detect media types and attributes:

**Type detection**: `photo`, `video`, `audio`, `document`, `sticker`, `animation`, `voice`, `video_note`, `location`, `contact`, `venue`, `dice`, `game`, `invoice`, `story`, `giveaway`

**Aggregate**: `media` (any media type), `media_group` (album), `caption` (has caption)

**Attributes**: `media_size(min, max)`, `media_duration(min, max)`, `media_mime("image/png")`, `media_width(min)`, `media_height(max)`, `file_name("doc.pdf")`, `specific_media_group(n)`, `album_len(n)`

```python
@app.on_msg(filt=filters.photo & filters.caption)
async def captioned_photo(msg): ...

@app.on_msg(filt=filters.media_size(min=1024*1024))
async def large_files(msg): ...
```

## Caption Filters

Filters that operate on media captions (the `caption` field, distinct from `text`):

`caption_regex`, `caption_contains`, `caption_len`

## Chat Filters

| Filter | Matches |
|--------|---------|
| `private` | Private chat (user_id > 0) |
| `group` | Basic group |
| `supergroup` | Supergroup |
| `channel` | Channel |
| `forum` | Forum (supergroup with topics) |
| `chat_type("private")` | Generic chat type check |
| `chat(123456789)` | Exact chat ID |
| `any_chat(111, 222)` | Any of the given chat IDs |
| `not_chat(111)` | Not in the given chat IDs |
| `topic(5)` | Message thread / topic ID |

## Sender Filters

| Filter | Matches |
|--------|---------|
| `me` | Message from current account |
| `from_user(123456)` | From specific user ID |
| `from_any(111, 222)` | From any of the given users |
| `not_from(111)` | Not from this user |
| `is_bot` | From a bot |
| `is_premium` | From premium user |
| `is_verified` | From verified account |
| `is_scam` | From scam-flagged account |
| `is_fake` | From fake-flagged account |
| `is_support` | From Telegram support |
| `is_contact` | From saved contact |
| `is_mutual_contact` | From mutual contact |
| `lang_code("ru")` | User's language code |

## Message Property Filters

`edited`, `forwarded`, `reply`, `pinned`, `has_protected_content`, `has_media_spoiler`, `via_bot`, `is_topic_message`, `has_markup`, `has_inline_kbd`, `has_reply_kbd`, `has_web_preview`, `silent`, `from_offline`, `effect`, `noforwards`, `views(min)`, `forwards(min)`, `reaction`, `has_sender_name`, `signature`, `message_id`

## Service Message Filters

Detect Telegram service message types:

`service`, `new_chat_members`, `left_chat_member`, `new_chat_title`, `new_chat_photo`, `delete_chat_photo`, `group_created`, `supergroup_created`, `channel_created`, `migrate_to`, `migrate_from`, `pinned_msg`, `connected_website`, `proximity_alert`, `video_chat_started`, `video_chat_ended`, `video_chat_scheduled`, `message_auto_delete_timer`, `successful_payment`, `refunded_payment`, `users_shared`, `chat_shared`, `write_access_allowed`, `boost_added`, `forum_topic_created`, `forum_topic_edited`, `forum_topic_closed`, `forum_topic_reopened`, `general_forum_topic_hidden`, `general_forum_topic_unhidden`, `giveaway_created`, `giveaway_completed`, `giveaway_winners`

## Callback Filters

| Filter | Description |
|--------|-------------|
| `cb_data("payload")` | Exact match on `callback_data` |
| `cb_startswith("page_")` | `callback_data` starts with prefix |
| `cb_endswith("_confirm")` | `callback_data` ends with suffix |
| `cb_contains("admin")` | `callback_data` contains substring |
| `cb_regex(r"page_\d+")` | `callback_data` matches regex; sets `cb.match` |
| `cb_payload("action", "id")` | Parse `action:id:extra` format; sets `cb.payload` |
| `cb_json()` | Parse `callback_data` as JSON; sets `cb.json_data` |
| `cb_kvp("key", "value")` | Parse `key=value\nexpr` format |
| `cb_from(123456)` | From specific user |
| `cb_chat(123456)` | In specific chat |
| `cb_msg(42)` | On specific message |
| `cb_game` | Game callback |
| `cb_any` | Any callback query |

## Poll Filters

| Filter | Description |
|--------|-------------|
| `poll_filter` | Any poll event |
| `poll_closed` | Poll just closed |
| `poll_open` | Poll is still open |
| `poll_question("What...")` | Question text matches |
| `poll_contains("word")` | Question contains text |
| `poll_regex(r"...")` | Question matches regex |
| `poll_type("regular"|"quiz")` | Poll type |
| `poll_chat(123456)` | In specific chat |
| `poll_option(0)` | Specific option voted |
| `poll_any` | Any poll event |
| `poll_answer` | Poll answer (not poll creation) |

## Member Filters

| Filter | Description |
|--------|-------------|
| `member_joined` | User joined |
| `member_left` | User left |
| `member_banned` | User was banned/kicked |
| `member_unbanned` | User was unbanned |
| `member_promoted` | User promoted to admin |
| `member_demoted` | Admin demoted to member |
| `member_restricted` | User restricted |
| `member_unrestricted` | User unrestricted |
| `member_status("administrator")` | Specific status change |
| `member_chat(123456)` | In specific chat |
| `member_user(123456)` | Affecting specific user |
| `member_by(123456)` | Action by specific admin |
| `member_self` | Affecting the bot/userbot itself |
| `member_any` | Any member event |

## Cross-Type Filters

| Filter | Description |
|--------|-------------|
| `update_type("msg")` | Events of specific kind: `"msg"`, `"cb"`, `"poll"`, `"member"` |
| `network("bot")` | Events from specific transport: `"bot"` or `"mt"` |
| `user(123456)` | From specific user ID across all event types |

## FSM State Filters

Filter handlers based on the current FSM state of a chat+user pair:

```python
from goygram.filters import state, state_any

@app.on_msg(filt=filters.text & state("waiting_name"))
async def get_name(msg):
    name = msg.text
    app.set_state(msg.chat_id, msg.from_id, "waiting_age", {"name": name})
    await msg.reply("How old are you?")

@app.on_msg(filt=filters.text & state_any("waiting_age", "waiting_email"))
async def get_details(msg):
    ...
```

- `state("name")` — Only fires if `app.get_state(chat_id, user_id) == "name"`
- `state_any("a", "b", "c")` — Fires if state is any of the given names

## Composition Operators

| Operator | Method | Description |
|----------|--------|-------------|
| `&` | `all_of(f1, f2, ...)` | All filters must pass (AND) |
| `\|` | `any_of(f1, f2, ...)` | Any filter must pass (OR) |
| `~` | `invert(f)` | Negate a filter (NOT) |
| `^` | — | Exclusive OR |
| `-` | — | AND NOT (`self & ~other`) |
| — | `none_of(f1, f2)` | No filter passes |
| — | `at_least(n, f1, f2, ...)` | At least N filters pass |
| — | `at_most(n, f1, f2, ...)` | At most N filters pass |
| — | `exactly(n, f1, f2, ...)` | Exactly N filters pass |

## Stateful Filters

Filters that track their own state across invocations:

| Filter | Description |
|--------|-------------|
| `once` | Fires exactly once, then never again |
| `limit(5)` | Fires at most N times total |
| `every_n(3)` | Fires every Nth matching event |
| `cooldown(60)` | Fires at most once per N seconds |
| `throttled(rate=5, per=60)` | At most N events per M seconds |

```python
# Only handle the first 10 start commands
@app.on_msg(filt=filters.command("start") & filters.limit(10))
async def first_ten(msg): ...

# Rate limit spam to 3 messages per 60 seconds
@app.on_msg(filt=filters.text & filters.throttled(3, 60))
async def rate_limited(msg): ...
```

## Utility Filters

| Filter | Description |
|--------|-------------|
| `any_filter` | Always passes |
| `none_filter` | Always fails |
| `func(callable)` | Wrap any `(event) -> bool` callable |
| `filter_data(key="value")` | Match raw event dict fields |
| `if_(condition_filter, then_filter, else_filter)` | Conditional branching |
| `unless(condition_filter, body_filter)` | `body_filter` fires unless `condition_filter` matches |

## Using Filters

Filters work with all handler decorators:

```python
@app.on_msg(filt=filters.text & ~filters.me)
async def text_not_me(msg): ...

@app.on_cb(filt=filters.cb_startswith("page_"))
async def page_cb(cb): ...

@app.on_poll(filt=filters.poll_closed & filters.poll_chat(MY_GROUP))
async def closed_polls(poll): ...

@app.on_member(filt=filters.member_joined)
async def welcomes(mem): ...

@app.on_update(filt=filters.update_type("msg"))
async def catch_all(event): ...
```

## Custom Filters

Any callable `(event) -> bool` wrapped in `Filter()` works:

```python
from goygram.filters import Filter

@app.on_msg(filt=Filter(lambda msg: msg.chat_id == MY_CHANNEL))
async def my_channel(msg): ...
```

## Performance Notes

- Filter evaluation is **synchronous** — no async, no I/O
- Expression trees build new `Filter` objects at composition time, not at evaluation time
- Composed filters short-circuit: `f1 & f2` stops at `f1` if it returns `False`
- The `command` and `regex` filters mutate the event object via `__setattr__` — they set `cmd`/`args` or `match`/`finds`/`parts` on the event for handler use
- Stateful filters (`once`, `limit`, `cooldown`, `throttled`) maintain internal counters — they are not thread-safe and not serializable
