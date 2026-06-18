---
---

Добро пожаловать на вики **GoyGram** — полный справочник по идеальной платформе Telegram с разделенным мозгом.

<p align="center">
  <img src="https://raw.githubusercontent.com/GoyGram/GoyGram/main/GoyGram.png" alt="GoyGram Logo" width="650">
</p>

## Что охватывает эта вики

Здесь документирована каждая строка GoyGram. Никаких маханий руками, никаких «поверь мне, братан». Что на самом деле делают биты.

### Что вы здесь найдете

- **Основная архитектура** — Как на самом деле работает разделенная архитектура Python+Rust. Топология шины событий, конвейер диспетчера и система динамического разрешения методов, которая позволяет вызывать `app.sendDocument(...)`, не являясь жестко запрограммированным методом.
- **Подробное описание сети** – как Bot API (длинный опрос HTTP через aiohttp), так и MTProto (необработанный TCP-сокет с полным обменом ключами DH, шифрованием AES-IGE и проверкой открытого ключа RSA). Каждый формат пакета, каждый шаг шифрования.
- **Аутентификация и безопасность** – полная система хранилища сеансов (AES-256-GCM с получением ключа PBKDF2 на основе идентификатора компьютера), интерактивные процессы входа в систему (номер телефона + QR-код), обработка паролей 2FA/SRP, перенос стороннего `.session` с безопасным обнулением и механизм переопределения `GOYGRAM_VAULT_KEY`.
- **Полный справочник по клиентскому API** — каждый общедоступный метод, каждый тип событий (`MsgObj`, `CbObj`, `PollObj`, `MemberObj`), система фильтров с логической композицией, маршрутизацией команд и построителями клавиатуры.
- **Внутренние компоненты и инструменты** — кодек TL, который вручную создает байты, сериализованные в TL, реестр ключей RSA со всеми 8 открытыми ключами Telegram, инструменты генерации кода, которые очищают документацию Telegram Bot API и схему TL, а также конвейер сборки расширения Rust на основе `maturin`.
- **Расширенные шаблоны** — многосессионное фермерство, двойная транспортная маршрутизация, туннелирование прокси-сервера (SOCKS5 + HTTP CONNECT), динамическая миграция DC при ошибках `PHONE_MIGRATE` и жизненный цикл токена входа в систему с помощью QR-кода.

## Быстрая навигация

- **Только начинаем?** → [Быстрый старт: Bot API](Quick-Start-Bot-API) или [Быстрый старт: MTProto Userbot](Quick-Start-MTProto-Userbot)
- **Хотите понять архитектуру?** → [Обзор архитектуры](Architecture-Overview) → [Split-Brain Design](Split-Brain-Design)
- **Углубляемся в сети?** → [Bot API Transport](Bot-API-Transport) или [MTProto Transport](MTProto-Transport)
- **Подробное описание аутентификации?** → [Session Vault (AES-256-GCM)](Session-Vault-AES-256-GCM) → [Интерактивный поток аутентификации](Interactive-Auth-Flow)
- **Ссылка на API?** → [Полная ссылка на клиент](Полная ссылка на клиент) → [Справочник по действиям MTProto](MTProto-Actions-Reference)

## Снимок проекта


```python
# Split-brain in action — one runtime, two transports
from goygram import GoyGram, filters

app = GoyGram(
    bot_token="123456:ABC_TOKEN",     # Bot API transport
    api_id=123456,                     # MTProto transport
    api_hash="abcdef0123456789",
    session_name="my_account",
)

@app.on_msg(filt=filters.text)
async def echo(msg):
    await msg.reply("Received on either transport. GoyGram handles routing.")
```


[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg?style=for-the-badge&logo=python)](https://www.python.org)
[![Rust Core](https://img.shields.io/badge/Rust_Core-Blazing_Fast-orange.svg?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
[![Лицензия: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-red.svg?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)