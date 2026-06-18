# Rust Extension Core

The Rust native library (`goygram.ext`) is the beating heart of GoyGram's performance. Every encrypted MTProto packet and every session vault passes through it. Without it, the framework would be a toy.

## Compilation & Distribution

### Build System

GoyGram uses **maturin** (PyO3's build tool) to compile the Rust crate into a Python extension module:

```toml
# pyproject.toml
[build-system]
requires = ["maturin>=1.7,<2.0"]
build-backend = "maturin"

[tool.maturin]
manifest-path = "ext_rust/Cargo.toml"
python-source = "."
module-name = "goygram.ext"
bindings = "pyo3"
```

### Rust Crate

```toml
# ext_rust/Cargo.toml
[package]
name = "goygram_ext"
version = "0.5.5"
edition = "2021"

[dependencies]
pyo3 = { version = "0.21.2", features = ["extension-module", "abi3", "abi3-py311"] }
aes = "0.8.4"
aes-gcm = "0.10.3"
cipher = "0.4.4"

[profile.release]
strip = true
lto = true
opt-level = 3
```

Key details:
- **`abi3-py311`**: The extension targets Python's stable ABI (3.11+). One compiled `.so` works on Python 3.11 through 3.14+ without recompilation.
- **`strip = true`**: Debug symbols stripped from release builds.
- **`lto = true`**: Link-time optimization for maximum performance.
- **`opt-level = 3`**: Aggressive optimization.

### Loading in Python

```python
# goygram/security.py
try:
    from goygram import ext as _rx
except Exception:
    _rx = None
```

The extension is optional at import time but becomes a hard requirement when you try to encrypt/decrypt anything. Both `security.py` and `mtproto.py` check `if _rx is None: raise RuntimeError(...)` before using crypto operations.

### CI/CD Pipeline

The CI (`.github/workflows/pub.yml`) builds wheels on:

| OS | Runner |
|----|--------|
| Linux | `ubuntu-latest` |
| Windows | `windows-latest` |
| macOS | `macos-latest` |

Plus a source distribution (sdist). All artifacts are collected and uploaded to PyPI on tag push (`v*`).

## Exported Functions

### AES-256-IGE (MTProto Packet Encryption)

The IGE (Infinite Garble Extension) mode is Telegram's custom block cipher mode. It's not a standard mode — it's the critical path for every MTProto message.

```
aes_ige_enc(data, key, iv)    → encrypt + auto-pad (PKCS7)
aes_ige_dec(data, key, iv)    → decrypt + auto-unpad
aes_ige_enc_raw(data, key, iv) → encrypt raw (no padding)
aes_ige_dec_raw(data, key, iv) → decrypt raw (no padding)
```

**Constraints enforced in Rust:**
- `key` must be exactly 32 bytes (AES-256)
- `iv` must be exactly 32 bytes (IGE uses two 16-byte sub-IVs)
- `data` must be a multiple of 16 bytes (for raw variants)

**Algorithm (raw encrypt):**
```
x = iv[0:16]   # first half of IV
y = iv[16:32]  # second half of IV
for each 16-byte block in data:
    tmp = block XOR x
    tmp = AES_encrypt(tmp)
    out = tmp XOR y
    x = out
    y = block
```

**Algorithm (raw decrypt):**
```
x = iv[0:16]
y = iv[16:32]
for each 16-byte block in data:
    tmp = block XOR y
    tmp = AES_decrypt(tmp)
    out = tmp XOR x
    x = block
    y = out
```

The `enc` variant adds PKCS7 padding before encryption. The `dec` variant removes PKCS7 padding after decryption, with validation that all pad bytes are correct.

### AES-256-GCM (Vault Encryption)

Used for the session vault system:

```
aes_gcm_encrypt(key, nonce, plaintext, aad) → ciphertext+tag
aes_gcm_decrypt(key, nonce, ciphertext, aad) → plaintext
```

**Constraints:**
- `key`: exactly 32 bytes
- `nonce`: exactly 12 bytes
- `aad`: additional authenticated data (always empty `b""` in GoyGram)

GCM provides **authenticated encryption** — if anyone tampers with the vault file, decryption fails with `"decryption failed (wrong key or corrupted data)"`.

### Utility Functions

```
cut(buf)  → (list_of_frames, remainder)
pack(data) → length_prefix + data
```

`cut` splits a byte buffer into TL-length-prefixed frames (4-byte little-endian length + payload). Identical logic to the Python version in `MTNet.cut()` but native speed.

`pack` prepends a 4-byte little-endian length prefix. Identical to `IntermediateTransport.pack()`.

## Why Rust and Not Cython/C Extension?

1. **Safety**: Rust's borrow checker eliminates memory safety bugs. The crypto code manipulates raw byte buffers heavily — undefined behavior here would be catastrophic.
2. **Performance**: `aes` crate uses hardware AES-NI instructions on x86-64. Python's `cryptography` library also does this, but the overhead of crossing the Python/C boundary per packet adds up.
3. **Build simplicity**: `maturin` handles cross-compilation for all platforms. No need to maintain separate C extension build scripts for Linux/Win/Mac.
4. **Type safety**: PyO3 provides Rust-native Python bindings. The function signatures (`&[u8]` → `PyResult<Vec<u8>>`) are checked at compile time.

## Performance Characteristics

The IGE encrypt/decrypt path processes 16-byte blocks in a loop. For a typical MTProto packet (~500 bytes padded to 512, i.e., 32 blocks), that's 32 AES encrypt calls. With AES-NI, each encrypt takes ~10-20 CPU cycles. The entire packet encryption is measured in **nanoseconds**.

The GCM path uses `Aes256Gcm` from the `aes-gcm` crate, which also uses hardware acceleration. Vault encryption typically processes a few KB of JSON — also nanoseconds.

The real bottleneck is **never crypto**. It's network I/O and Python handler execution.
