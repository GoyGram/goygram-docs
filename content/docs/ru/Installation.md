---
---

# Установка

## Требования

- **Python 3.11+** (расширение Rust предназначено для стабильного ABI версии 3.11)
- **пип** 24.0+
- **Rust НЕ требуется** для установки — имеются готовые диски для Linux, Windows и macOS.

## Установить через pip


```bash
pip install goygram
```


При этом из PyPI будет получена последняя версия с предварительно скомпилированным расширением Rust.

### Альтернативные установщики


```bash
# uv (faster, deterministic)
uv pip install goygram

# pipx (isolated environment, CLI use)
pipx install goygram

# poetry
poetry add goygram
```


## Поддержка платформы

| Платформа | Архитектура | Колесо |
|----------|-------------|-------|
| Линукс | x86-64 | `cp311-abi3-linux_x86_64.whl` |
| Окна | x86-64 | `cp311-abi3-win_amd64.whl` |
| macOS | x86-64 | `cp311-abi3-macosx_10_12_x86_64.whl` |
| macOS | ARM64 (яблочный кремний) | `cp311-abi3-macosx_11_0_arm64.whl` |

## Из исходного кода (если у вас есть Rust)


```bash
git clone https://github.com/GoyGram/GoyGram
cd GoyGram
pip install maturin
maturin develop --release
```


## Зависимости


```
aiohttp>=3.9,<4.0    # HTTP client (Bot API)
pydantic>=2.7,<3.0   # Config models
rich>=13.0.0         # Terminal UI (login flow + help)
qrcode>=7.0          # QR code generation (login)
```


## Проверка установки


```bash
python -c "from goygram import GoyGram; print('OK')"
python -c "from goygram import ext; print(dir(ext))"
# ['aes_gcm_decrypt', 'aes_gcm_encrypt', 'aes_ige_dec',
#  'aes_ige_dec_raw', 'aes_ige_enc', 'aes_ige_enc_raw',
#  'cut', 'pack']
```


## Установка для разработки


```bash
git clone https://github.com/GoyGram/GoyGram
cd GoyGram
python -m venv .venv && source .venv/bin/activate
pip install maturin
maturin develop --release
```


`maturin develop` собирает расширение Rust на месте и устанавливает GoyGram как редактируемый пакет. Изменения в исходных файлах Python вступают в силу немедленно (без переустановки). Изменения в файлах Rust требуют повторного запуска `maturin develop --release`.

### Итеративная разработка Rust


```bash
# After editing ext_rust/src/lib.rs:
maturin develop --release
python -c "from goygram import ext; print('Rust recompiled')"
```


## Докер


```dockerfile
FROM python:3.12-slim
RUN pip install goygram
COPY app.py /app/
WORKDIR /app
ENV GOYGRAM_LOG=WARNING
CMD ["python", "app.py"]
```


Сборка и запуск:

```bash
docker build -t goygram-bot .
docker run -d --restart unless-stopped -v ./default.vault:/app/default.vault goygram-bot
```


Подключите файл хранилища как том, чтобы сохранять сеансы при перезапуске контейнера.

## системная служба


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


## Обновление


```bash
pip install --upgrade goygram
```


Стабильный ABI `abi3` означает, что незначительные обновления версий не требуют перекомпиляции Rust. Только серьезные изменения в ящике Rust (редко) потребуют нового колеса.

## Удаление


```bash
pip uninstall goygram -y
# Vault files are NOT removed — they stay in your working directory
# Delete manually if needed: rm *.vault
```


## Устранение неполадок

### "Расширение Rust недоступно"

Если `from goygram import ext` не работает:
- Вы используете неподдерживаемую платформу (ARM Linux, 32-разрядная версия и т. д.)
- Установить из исходников с помощью Rust: `pip install maturin && maturin develop --release`
- Для ARM Linux вам необходимо скомпилировать крейт Rust самостоятельно.

### "Нет модуля с именем 'goygram.ext'"

Возможно, колесо было построено неправильно. Попробуйте:

```bash
pip uninstall goygram goygram_ext -y
pip install goygram --no-cache-dir
```


### Версия Python

Минимум Python 3.11. Функция `abi3-py311` означает, что скомпилированное расширение связывается со стабильным ABI Python 3.11.

### musl / Альпийский Linux

Alpine использует musl libc, а не glibc. Предварительно созданные колеса предназначены для glibc (manylinux). На Альпийском:

```bash
apk add rust cargo python3-dev
pip install maturin
pip install goygram --no-binary goygram
# or: maturin develop --release  (from git clone)
```


### «неопределенный символ» при импорте


```bash
# Check the wheel is for your platform
pip download goygram --no-deps -d /tmp/whl
unzip -l /tmp/whl/goygram-*.whl | grep '\.so$'
# Should show: goygram/ext.abi3.so (Linux) or goygram/ext.pyd (Windows)
```


Если вы видите колесо macOS в Linux или наоборот, `pip` выбрал неправильную платформу. Используйте `--platform`, чтобы принудительно:

```bash
pip install --platform manylinux_2_17_x86_64 --only-binary :all: goygram
```