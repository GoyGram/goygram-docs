---
title: "Установка"
---

# Установка

GoyGram работает на CPython 3.13 и новее. Wheel-файлы на PyPI собраны под стабильный ABI и несут тег `cp38-abi3`, поэтому один нативный wheel подходит для всех поддерживаемых версий CPython на одной платформе.

## Установка из PyPI

```bash
python -m pip install --upgrade goygram
```

Проверить установленную версию:

```bash
python -c "from importlib.metadata import version; print(version('goygram'))"
```

Команда `python`, которой вы ставите пакет, и команда, которой запускаете бота, должны использовать одно и то же окружение.

## Установка на Termux

Termux приносит свой CPython, и начиная с 3.13 он отдаёт android-теги платформы, поэтому pip находит готовый wheel так же, как на любой другой системе:

```bash
pkg update
pkg install python-pip
pip install goygram
```

Готовые wheel есть для телефонов `arm64_v8a` и для эмуляторов и Chromebook на `x86_64`, собраны под Android API 24. Зависимости тоже приходят готовыми wheel, поэтому на устройстве ничего не собирается.

## Установка из исходников

Так ставят пакет на платформе без подходящего wheel:

```bash
git clone https://github.com/GoyGram/GoyGram
cd GoyGram
python -m pip install --no-build-isolation .
```

Для сборки из исходников нужны компиляторы Rust и C. В Termux это `pkg install rust clang`.

## Перед началом

Для Bot API создайте бота через [BotFather](https://t.me/BotFather). Для MTProto создайте приложение на [my.telegram.org](https://my.telegram.org).

Токен, `api_hash`, файлы сессий и vault нельзя класть в Git или показывать в логах.

Дальше: [быстрый старт Bot API](/ru/docs/Quick-Start-Bot-API) или [быстрый старт MTProto](/ru/docs/Quick-Start-MTProto-Userbot).
