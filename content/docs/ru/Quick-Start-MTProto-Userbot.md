---
title: "Быстрый старт: пользовательский робот MTProto"

---
# Быстрый старт: пользовательский робот MTProto

Запустите учетную запись пользователя Telegram (не бота) с помощью GoyGram. Это дает вам доступ ко всему, что может делать обычный клиент Telegram — диалогам, реакциям, каналам и многому другому.

## 1. Установить


```bash
pip install goygram
```


Требуется Python 3.11+.

## 2. Получите учетные данные API

Перейдите на [my.telegram.org](https://my.telegram.org), войдите в систему, перейдите в раздел «Инструменты разработки API» и создайте приложение. Вы получите:
- **Идентификатор API** (целое число)
- **Хеш API** (шестнадцатеричная строка из 32 символов)

Держите это в секрете. Это индивидуальность вашего приложения.

## 3. Напишите своего пользовательского бота


```python
import asyncio
from goygram import GoyGram, filters

app = GoyGram(
    api_id=123456,
    api_hash="0123456789abcdef0123456789abcdef",
    session_name="my_account"
)

@app.on_cmd(".ping")
async def ping(msg):
    await msg.reply("<b>🏓 PONG!</b> GoyGram is running.", parse_mode="HTML")

asyncio.run(app.run())
```


## 4. Первый запуск — интерактивный вход

При первом запуске вы увидите процесс входа в TUI:


```
GoyGram Interactive Login

? Choose login method:
  > QR Code Login
    Phone Number Login
```


Выберите один:
- **QR-код**: сканируйте с помощью другого клиента Telegram (Настройки → Устройства → Сканировать QR).
- **Номер телефона**: введите свой номер, получите код, введите его.

Если у вас включен 2FA, вам будет предложено ввести пароль.

После успешного входа:

```
Success! Session saved to my_account.vault
```


При последующих запусках хранилище загружается автоматически — повторный вход в систему не требуется.

## 5. Что вы можете сделать

### Команды


```python
@app.on_cmd(".ping")
async def ping(msg): ...

@app.on_cmd(".del")
async def delete_last(msg):
    await msg.delete()
```


### Отслеживание собственных сообщений


```python
@app.on_msg(filt=filters.text & filters.me)
async def self_logger(msg):
    if msg.text.lower() == "test":
        await msg.edit("Test passed!")
```


### Действия MTProto


```python
# Get dialogs
dialogs = await app.mt_messages_get_dialogs(limit=50)

# Send reactions
await app.mt_messages_send_reaction(chat_id=..., msg_id=..., reaction="👍")

# Get chat members
members = await app.mt_channels_get_participants(chat_id=-10012345678, limit=200)

# Join channel
await app.mt_channels_join_channel(chat_id=-10012345678)
```


### Именованные сеансы (несколько аккаунтов)


```python
worker1 = GoyGram(api_id=APP_ID, api_hash=APP_HASH, session_name="farm_1")
worker2 = GoyGram(api_id=APP_ID, api_hash=APP_HASH, session_name="farm_2")

await asyncio.gather(worker1.run(), worker2.run())
```


## Примечания по безопасности

- Ваш сеанс хранится в зашифрованном виде в `my_account.vault`.
– Никогда не делитесь своим файлом `.vault` — он содержит ваш ключ авторизации.
- Используйте переменную env `GOYGRAM_VAULT_KEY` для детерминированного ввода ключей в CI/контейнерах.
- Платформа обнуляет старые файлы `.session` во время миграции.

## Ведение журнала


```bash
GOYGRAM_LOG=DEBUG python userbot.py
```