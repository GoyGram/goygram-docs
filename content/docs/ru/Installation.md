---
title: "Установка"
---

# Установка

GoyGram работает на CPython 3.8 и новее. Wheel-файлы на PyPI используют `cp38-abi3`, поэтому один нативный wheel подходит для всех поддерживаемых версий CPython на той же платформе.

## Установка из PyPI

```bash
python -m pip install --upgrade goygram
```

Проверить установленную версию:

```bash
python -c "from importlib.metadata import version; print(version('goygram'))"
```

Команда `python`, которой вы ставите пакет, и команда, которой запускаете бота, должны использовать одно и то же окружение.

## Установка из исходников

Так ставят пакет на платформе без подходящего wheel, например на ARM64 Termux:

```bash
pkg update
pkg install python rust clang
python -m pip install --no-build-isolation .
```

## Перед началом

Для Bot API создайте бота через [BotFather](https://t.me/BotFather). Для MTProto создайте приложение на [my.telegram.org](https://my.telegram.org).

Токен, `api_hash`, файлы сессий и vault нельзя класть в Git или показывать в логах.

Дальше: [быстрый старт Bot API](/ru/docs/Quick-Start-Bot-API) или [быстрый старт MTProto](/ru/docs/Quick-Start-MTProto-Userbot).
