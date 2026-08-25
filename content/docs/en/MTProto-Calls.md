---
title: MTProto Calls
---

# MTProto Calls

Use `mt_` followed by a TL namespace and snake_case method name. GoyGram converts it to the TL method name dynamically:

```python
dialogs = await app.mt_messages_get_dialogs(
    offset_date=0,
    offset_id=0,
    offset_peer={"_": "inputPeerEmpty"},
    limit=5,
    hash=0,
)
```

This calls `messages.getDialogs`.

You can also use an explicit name:

```python
result = await app.mt_req("messages.getDialogs", limit=5, hash=0)
```

`mt_req()` removes keyword arguments whose value is `None`, converts values with `to_dict()`, and supplies the configured `api_id` and `api_hash` unless you explicitly provide them.

## TL arguments and results

Pass TL constructors as dictionaries whose `_` field names the constructor, for example `{"_": "inputPeerEmpty"}`. Responses are decoded into Python data structures by the current schema.

MTProto methods are schema-driven and dynamic; there are no generated per-method Python wrappers. Method names, parameter names, constructors, and result shapes come from Telegram's TL schema and can change upstream.

Do not run competing receive loops against the same MTProto connection. `app.run()` owns the MTProto reader and update dispatch loop.
