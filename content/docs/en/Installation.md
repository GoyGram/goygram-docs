---
title: "Installation"
---

# Installation

## Requirements

- **Python 3.11+** (the Rust extension targets the stable ABI from 3.11)
- **pip** 24.0+
- **Rust is NOT required** for installation — pre-built wheels are provided for Linux, Windows, and macOS

## Install via pip

```bash
pip install goygram
```

This pulls the latest version from PyPI with the pre-compiled Rust extension.

### Alternative Installers

```bash
# uv (faster, deterministic)
uv pip install goygram

# pipx (isolated environment, CLI use)
pipx install goygram

# poetry
poetry add goygram
```

## Platform Support

| Platform | Architecture | Wheel |
|----------|-------------|-------|
| Linux | x86-64 | `cp311-abi3-linux_x86_64.whl` |
| Windows | x86-64 | `cp311-abi3-win_amd64.whl` |
| macOS | x86-64 | `cp311-abi3-macosx_10_12_x86_64.whl` |
| macOS | ARM64 (Apple Silicon) | `cp311-abi3-macosx_11_0_arm64.whl` |

## From Source (if you have Rust)

```bash
git clone https://github.com/GoyGram/GoyGram
cd GoyGram
pip install maturin
maturin develop --release
```

## Dependencies

```
aiohttp>=3.9,<4.0    # HTTP client (Bot API)
pydantic>=2.7,<3.0   # Config models
rich>=13.0.0         # Terminal UI (login flow + help)
qrcode>=7.0          # QR code generation (login)
```

## Verify Installation

```bash
python -c "from goygram import GoyGram; print('OK')"
python -c "from goygram import ext; print(dir(ext))"
# ['aes_gcm_decrypt', 'aes_gcm_encrypt', 'aes_ige_dec',
#  'aes_ige_dec_raw', 'aes_ige_enc', 'aes_ige_enc_raw',
#  'cut', 'pack']
```

## Development Install

```bash
git clone https://github.com/GoyGram/GoyGram
cd GoyGram
python -m venv .venv && source .venv/bin/activate
pip install maturin
maturin develop --release
```

`maturin develop` builds the Rust extension in-place and installs GoyGram as an editable package. Changes to Python source files take effect immediately (no reinstall). Changes to Rust files require re-running `maturin develop --release`.

### Iterative Rust Development

```bash
# After editing ext_rust/src/lib.rs:
maturin develop --release
python -c "from goygram import ext; print('Rust recompiled')"
```

## Docker

```dockerfile
FROM python:3.12-slim
RUN pip install goygram
COPY app.py /app/
WORKDIR /app
ENV GOYGRAM_LOG=WARNING
CMD ["python", "app.py"]
```

Build and run:
```bash
docker build -t goygram-bot .
docker run -d --restart unless-stopped -v ./default.vault:/app/default.vault goygram-bot
```

Mount the vault file as a volume to persist sessions across container restarts.

## systemd Service

```ini
# /etc/systemd/system/goygram-bot.service
[Unit]
Description=GoyGram Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=botuser
WorkingDirectory=/opt/goygram
Environment=GOYGRAM_LOG=WARNING
ExecStart=/opt/goygram/.venv/bin/python app.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now goygram-bot
sudo journalctl -u goygram-bot -f
```

## Upgrading

```bash
pip install --upgrade goygram
```

The `abi3` stable ABI means minor version upgrades don't require Rust recompilation. Only major Rust crate changes (rare) would need a fresh wheel.

## Uninstalling

```bash
pip uninstall goygram -y
# Vault files are NOT removed — they stay in your working directory
# Delete manually if needed: rm *.vault
```

## Troubleshooting

### "Rust extension not available"

If `from goygram import ext` fails:
- You're on an unsupported platform (ARM Linux, 32-bit, etc.)
- Install from source with Rust: `pip install maturin && maturin develop --release`
- For ARM Linux, you need to compile the Rust crate yourself

### "No module named 'goygram.ext'"

The wheel might not have been built correctly. Try:
```bash
pip uninstall goygram goygram_ext -y
pip install goygram --no-cache-dir
```

### Python Version

Minimum Python 3.11. The `abi3-py311` feature means the compiled extension links against Python 3.11's stable ABI.

### musl / Alpine Linux

Alpine uses musl libc, not glibc. Pre-built wheels target glibc (manylinux). On Alpine:
```bash
apk add rust cargo python3-dev
pip install maturin
pip install goygram --no-binary goygram
# or: maturin develop --release  (from git clone)
```

### "undefined symbol" at import

```bash
# Check the wheel is for your platform
pip download goygram --no-deps -d /tmp/whl
unzip -l /tmp/whl/goygram-*.whl | grep '\.so$'
# Should show: goygram/ext.abi3.so (Linux) or goygram/ext.pyd (Windows)
```

If you see a macOS wheel on Linux or vice versa, `pip` picked the wrong platform. Use `--platform` to force:
```bash
pip install --platform manylinux_2_17_x86_64 --only-binary :all: goygram
```
