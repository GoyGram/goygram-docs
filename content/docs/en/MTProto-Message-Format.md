---
title: MTProto Message Format
---

# MTProto message format

This page shows the byte layout used by GoyGram's MTProto transport. The examples describe the wire format; they are not a replacement for Telegram's official MTProto documentation.

## Intermediate transport frame

GoyGram uses a length-prefixed intermediate frame:

```text
[length: 4 bytes, little-endian][payload: length bytes]
```

In Python, the important operation is:

```python
frame = len(payload).to_bytes(4, "little") + payload
```

The length belongs to the payload. It does not include the four length bytes.

## Encrypted message envelope

After the authorization key is established through the DH exchange, a message has this outer layout:

```text
[auth_key_id: 8 bytes][msg_key: 16 bytes][encrypted_data: N bytes]
```

`auth_key_id` is derived from the authorization key. `msg_key` identifies the message key used by the MTProto encryption rules. The remaining bytes are encrypted with AES-256-IGE.

The encrypted data length must be valid for the cipher block size. GoyGram checks packet boundaries before decrypting and before reading fields from the decrypted buffer.

## Decrypted payload

The decrypted payload contains:

```text
[salt: 8 bytes]
[session_id: 8 bytes]
[msg_id: 8 bytes, little-endian]
[seq_no: 4 bytes, little-endian]
[body_length: 4 bytes, little-endian]
[body: body_length bytes]
[padding]
```

The body is a TL-encoded Telegram method or result. The padding is random and is not part of the TL body.

## TL body

A TL body starts with a four-byte constructor ID. The constructor tells the decoder what object or method follows. Fields then appear in the exact order defined by the active Telegram TL schema.

Common field sizes are:

- `int`: 4 bytes;
- `long`: 8 bytes;
- `int128`: 16 bytes;
- `int256`: 32 bytes;
- strings and byte arrays: TL length, data, and four-byte padding;
- vectors: vector constructor ID, item count, then encoded items.

## Before authorization

Messages used during the initial authorization exchange are not encrypted with an established authorization key. Their envelope is different:

```text
[auth_key_id: 8 bytes set to zero]
[msg_id: 8 bytes]
[body_length: 4 bytes]
[body: body_length bytes]
```

This form is used for the DH authorization methods such as `req_pq_multi`, `req_DH_params`, and `set_client_DH_params`.

## Reading safely

Never read a field before checking that the buffer contains enough bytes. A wrong length moves the read position and makes every field after it invalid. A packet that ends before its declared body is damaged, not a valid partial response.

See [Bytes and TL data](Bytes-and-TL) for the basic byte rules and [MTProto Calls](MTProto-Calls) for application-level calls.
