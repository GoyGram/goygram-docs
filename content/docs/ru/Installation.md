---
title: "Установка"
---

# Установка

GoyGram распространяется на PyPI. Для него требуется **Python 3.11+**, а расширение Rust создается с помощью Maturin.


```bash
python -m pip install --upgrade goygram
```


Для конкретного выпуска:


```bash
python -m pip install --upgrade --force-reinstall goygram==0.7.15
```


Убедитесь, что интерпретатор, запускающий вашу программу, импортирует ожидаемый пакет:


```bash
python -c "from importlib.metadata import version; import goygram; print(version('goygram')); print(goygram.__file__)"
```


## Примечание о платформе

Пакет включает сериализацию TL на базе Rust. Установите его в той же среде Python, в которой будет запускаться приложение. На платформах без совместимого колеса для установки может потребоваться локальная цепочка инструментов Rust и компилятор.

## Учетные данные

- **API бота:** создайте бота с помощью BotFather и используйте его токен.
- **MTProto:** создайте приложение на сайте [my.telegram.org](https://my.telegram.org) и используйте его `api_id` и `api_hash`.

Не фиксируйте токены, хеши API, файлы хранилища или сгенерированные материалы сеанса.

Далее: [[Quick-Start-MTProto-Userbot|Быстрый старт: пользовательский робот MTProto]] или [[Quick-Start-Bot-API|Быстрый старт: Bot API]].