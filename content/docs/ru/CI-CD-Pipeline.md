---
title: "Конвейер CI/CD"

---
# Конвейер CI/CD

GoyGram использует GitHub Actions для непрерывной доставки. Каждое нажатие тега (`v*`) запускает сборку колеса для нескольких ОС + публикацию PyPI.

## Триггер


```yaml
on:
  push:
    tags:
      - 'v*'
```


Только теги версии запускают конвейер. Нажатия ветвей — нет.

## Этапы конвейера

### 1. Построение (Матрица)

Три параллельных задания создают колеса для конкретной платформы:

| ОС | Бегун | Колесо Тег |
|----|--------|-----------|
| Линукс | `ubuntu-latest` | `manylinux` x86-64 |
| Окна | `windows-latest` | Win32/AMD64 |
| macOS | `macos-latest` | Macosx x86-64/arm64 |

Каждая работа:

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


`maturin-action` компилирует расширение Rust и собирает колесо за один шаг.

### 2. Распространение исходного кода


```yaml
src:
  runs-on: ubuntu-latest
  steps:
    - uses: PyO3/maturin-action@v1
      with:
        command: sdist
        args: --out d
```


Отдельная работа для sdist (`.tar.gz`).

### 3. Опубликовать


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


Собирает все артефакты, загружает в PyPI. `--skip-existing` предотвращает ошибки, если версия уже опубликована.

## Секреты

| Секрет | Цель |
|--------|---------|
| `PYPI_API_TOKEN` | Токен PyPI API для загрузки пакета |

## Конфигурация сборки

Профиль выпуска оптимизирован по размеру и скорости:


```toml
[profile.release]
strip = true      # remove debug symbols
lto = true        # link-time optimization
opt-level = 3     # maximum optimization
```


## Именование артефактов

Колеса соответствуют названию PEP 427:
- `goygram-0.5.5-cp311-abi3-linux_x86_64.whl`
- `goygram-0.5.5-cp311-abi3-win_amd64.whl`
- `goygram-0.5.5-cp311-abi3-macosx_10_12_x86_64.whl`

Тег `abi3` означает стабильный ABI Python 3.11+ — одно колесо работает с Python 3.11–3.14+.

## Процесс выпуска


```bash
# 1. Update version in pyproject.toml
# 2. Commit + push
# 3. Tag + push
git tag v0.5.6
git push origin v0.5.6
# 4. GitHub Actions builds + publishes automatically
# 5. pip install goygram --upgrade
```