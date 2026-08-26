---
title: MTProto Calls
---

# MTProto Calls

Use the dynamic MTProto API instead of waiting for a generated wrapper. The active Telegram schema supplies method names, argument names, constructors, and result shapes.

```python
dialogs = await app.mt_messages_get_dialogs(
    offset_date=0,
    offset_id=0,
    offset_peer={"_": "inputPeerEmpty"},
    limit=5,
    hash=0,
)
```

This calls `messages.getDialogs`. The explicit form is useful when a method name contains a namespace or when you want the exact TL spelling:

```python
result = await app.mt_req("messages.getDialogs", limit=5, hash=0)
```

`mt_req()` removes `None` values, converts objects with `to_dict()`, injects configured API metadata, resolves ordinary `messages.*` peers when possible, and returns the schema-decoded result. Dynamic calls accept keyword arguments; use the exact names from the current TL schema.

## Constructors and peers

Pass TL constructors as dictionaries with `_`, or pass an already serialized constructor when a low-level method requires it:

```python
peer = await app.core.mt.resolve_peer("some_username")
result = await app.mt_req("messages.getHistory", peer=peer, limit=50)
```

Do not invent access hashes. For a positive user ID or channel, resolve the entity first or pass the original peer constructor from a decoded response.

## Files and containers

The lightweight transport exposes:

- `await app.core.mt.upload_file(source, file_name=None, part_size=524288)`;
- `await app.core.mt.download_file(location, destination, offset=0, limit=524288)`;
- `await app.core.mt.send_container(calls)` for deliberate low-level batching.

Uploads and downloads use bounded chunks and atomic destination replacement. Raw TL calls remain available for media, rich messages, stories, reactions, business updates, and constructors not yet given a convenience helper.

## Retries and recovery

`FloodWaitError` retries are bounded by the `retry=` keyword. MTProto update cursors (`pts`, `qts`, `date`, `seq`) are persisted and `updates.getDifference` is used after a gap. Do not create a second receive loop: `app.run()` owns the reader and dispatcher.

## Dynamic result handling

Results are ordinary dictionaries/lists containing the constructor key `_`, scalar fields, nested constructors, vectors, and raw values when the schema cannot decode a node. Check the constructor before consuming a result and retain unknown fields for forward compatibility.
