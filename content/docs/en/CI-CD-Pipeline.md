---
title: CI CD Pipeline
---

# CI/CD Pipeline

GoyGram uses GitHub Actions for continuous delivery. Every tag push (`v*`) triggers a multi-OS wheel build + PyPI publish.

## Trigger

```yaml
on:
  push:
    tags:
      - 'v*'
```

Only version tags trigger the pipeline. Branch pushes don't.

## Pipeline Stages

### 1. Build (Matrix)

Three parallel jobs build platform-specific wheels:

| OS | Runner | Wheel Tag |
|----|--------|-----------|
| Linux | `ubuntu-latest` | `manylinux` x86-64 |
| Windows | `windows-latest` | win32/amd64 |
| macOS | `macos-latest` | macosx x86-64/arm64 |

Each job:
```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-python@v5
    with:
      python-version: '3.11'
  - uses: PyO3/maturin-action@v1
    with:
      args: --release --out d
  - uses: actions/upload-artifact@v4
    with:
      name: whl-${{ matrix.name }}
      path: d
```

`maturin-action` compiles the Rust extension and builds the wheel in one step.

### 2. Source Distribution

```yaml
src:
  runs-on: ubuntu-latest
  steps:
    - uses: PyO3/maturin-action@v1
      with:
        command: sdist
        args: --out d
```

Separate job for the sdist (`.tar.gz`).

### 3. Publish

```yaml
pub:
  runs-on: ubuntu-latest
  needs: [build, src]  # wait for all builds
  steps:
    - uses: actions/download-artifact@v4
      with:
        pattern: whl-*
        merge-multiple: true
        path: d
    - uses: PyO3/maturin-action@v1
      env:
        MATURIN_PYPI_TOKEN: ${{ secrets.PYPI_API_TOKEN }}
      with:
        command: upload
        args: --non-interactive --skip-existing d/*
```

Collects all artifacts, uploads to PyPI. `--skip-existing` prevents errors if a version was already published.

## Secrets

| Secret | Purpose |
|--------|---------|
| `PYPI_API_TOKEN` | PyPI API token for package upload |

## Build Configuration

The release profile is optimized for size and speed:

```toml
[profile.release]
strip = true      # remove debug symbols
lto = true        # link-time optimization
opt-level = 3     # maximum optimization
```

## Artifact Naming

Wheels follow PEP 427 naming:
- `goygram-0.5.5-cp311-abi3-linux_x86_64.whl`
- `goygram-0.5.5-cp311-abi3-win_amd64.whl`
- `goygram-0.5.5-cp311-abi3-macosx_10_12_x86_64.whl`

The `abi3` tag means Python 3.11+ stable ABI — one wheel works on Python 3.11 through 3.14+.

## Release Process

```bash
# 1. Update version in pyproject.toml
# 2. Commit + push
# 3. Tag + push
git tag v0.5.6
git push origin v0.5.6
# 4. GitHub Actions builds + publishes automatically
# 5. pip install goygram --upgrade
```
