---
title: Bytes and TL
---

# Bytes and TL data

This page explains the bytes used on the main low-level path: Telegram TL data inside an MTProto message.

It does not pretend to describe every byte in the whole project. It describes each important field that the codec reads and writes.

## What is a byte?

A byte is a small box containing eight bits, each set to `0` or `1`:

```text
5 = 00000101
```

Telegram does not send a Python object such as `Message(...)`. GoyGram turns the object into bytes. Telegram reads those bytes and turns them back into data.

## A TL constructor

A TL object starts with a four-byte constructor ID. The ID tells the decoder what comes next:

```text
[4-byte constructor ID]
[field 1 bytes]
[field 2 bytes]
[field 3 bytes]
```

Field order matters. Swapping two fields changes how every following byte is read.

## Integer sizes

- `int` is 4 bytes;
- `long` is 8 bytes;
- `int128` is 16 bytes;
- `int256` is 32 bytes.

If a decoder reads seven bytes for an 8-byte `long`, the read position is now wrong. The rest of the packet will be interpreted incorrectly.

## Strings and byte arrays

A string is first encoded as UTF-8. One character is not always one byte:

- `A` uses 1 byte;
- `é` uses 2 bytes;
- many emoji use 4 bytes.

The encoded length and the number of characters are therefore different things.

The encoded data is followed by padding so the next TL value starts on a four-byte boundary. A simplified example:

```text
length: 03
data:   41 42 43
padding: 00 00
```

Short and long values use different TL length forms. Use GoyGram's codec instead of writing this by hand in application code.

## Vectors

A TL vector is more than a Python list:

```text
[vector constructor ID]
[number of items]
[item 1]
[item 2]
...
```

Every item is encoded according to its type. A vector of integers and a vector of objects therefore have different byte layouts.

## An MTProto message

The TL body is wrapped by MTProto. In simplified form:

```text
[auth_key_id: 8 bytes]
[msg_key: 16 bytes]
[encrypted body]
```

The encrypted body contains the salt, session ID, message ID, sequence number, body length, and TL body. In normal operation these bytes are protected by AES-256-IGE.

## Bounds checks

A decoder must check:

- that the buffer contains the next field;
- that a declared length stays inside the buffer;
- that padding does not move the read position past the end;
- that the packet size matches the format;
- that required fields were actually read.

Reading after the end of a buffer means the data is damaged. It is not a valid partial response.

## Where to look in the source

- TL schema: `goygram/protocol/tl_schema.py`;
- native operations: `ext_rust/src/lib.rs`;
- MTProto transport: `goygram/transports/mtproto.py`;
- message layout: [MTProto message format](MTProto-Message-Format).

One missing byte shifts everything that follows it.
