# Event Objects

GoyGram normalizes Bot API and MTProto updates into lightweight event objects.

## `MsgObj`

Message fields are `src`, `raw`, `app`, `id` (`msg_id` is an alias), `chat_id`, `from_id`, `text`, `is_me`, `cmd`, `args`, `match`, `finds`, and `parts`. `reply()` and `delete()` delegate through the owning application.

## `CbObj`

Callback-query fields are `src`, `raw`, `app`, `id`, `chat_id`, `from_id`, `msg_id`, `data`, `text`, `match`, `payload`, and `json_data`. Use `await cb.answer(text=None, alert=False, url=None, cache_time=0)` to answer it; `await cb.edit(text, kbd=None, **kw)` edits the source Bot API message.

## `PollObj`

Poll fields are `src`, `raw`, `app`, `id`, `question`, `closed`, and `kind`.

## `MemberObj`

Member-update fields are `src`, `raw`, `app`, `chat_id`, `from_id`, `user_id`, `old`, `new`, and `kind`.

The `raw` field retains the underlying normalized update content. Not every field is available for every Telegram update type; write handlers defensively and use filters where appropriate.
