---
title: "Architecture and Runtime Behavior"
---

# Architecture and Runtime Behavior

GoyGram has a single application core with optional Bot API and MTProto transports. Both feed an internal event bus; the dispatcher converts updates into event objects and invokes the registered handler collections.

## Startup order

`run()` starts the dispatcher and FSM engine first. It then starts Bot API polling if configured. For MTProto it bootstraps authorization, starts the MTProto connection and reader, and requests update state before waiting for `stop()`.

## Dynamic dispatch

Bot API and MTProto method wrappers are resolved with `__getattr__`, rather than being generated as Python methods:

- `send_message(...)` becomes Bot API `sendMessage`.
- `mt_messages_get_dialogs(...)` becomes MTProto `messages.getDialogs`.

This means new supported schema methods do not require a Python wrapper release, but it also means argument validation follows the upstream transport/schema rather than static Python signatures.

## Schema and Rust extension

The MTProto layer initializes TL schema data through the Rust extension and schema manager. Serialization uses the Rust extension when available. Schema data has bundled/bootstrap and remote-refresh paths; applications should not depend on internal schema-cache formats.

## Data-center routing

MTProto without an explicit host queries dynamic data-center configuration and selects DC 2. A built-in endpoint is used only as a fallback if this lookup fails. A loaded vault can subsequently select its saved data center.
