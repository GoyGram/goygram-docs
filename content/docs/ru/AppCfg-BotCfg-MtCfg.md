---
title: "AppCfg/BotCfg/MtCfg"

---
# AppCfg/BotCfg/MtCfg

Классы модели конфигурации, которые объединяют разделенные транспорты GoyGram.

## AppCfg


```python
class AppCfg(BaseModel):
    model_config = ConfigDict(frozen=True)
    bot: BotCfg | None = None     # Bot API config (optional)
    mt: MtCfg | None = None       # MTProto config (optional)
    bus_max: int = 0              # Event queue max size (0=unlimited)
```


- **`frozen=True`**: неизменяемый после создания. Конфигурация времени выполнения не изменяется.
- **`bot=None`** + **`mt=None`**: должен быть установлен хотя бы один. Оба `None` означают отсутствие транспорта — приложение выйдет из строя при запуске.
- **`bus_max=0`**: неограниченная очередь по умолчанию. Положительные значения применяют противодавление.

## БотКфг


```python
class BotCfg(BaseModel):
    model_config = ConfigDict(frozen=True)
    token: str                    # Bot API token (required)
    timeout: int = 25             # getUpdates long-poll timeout
    base: str = "https://api.telegram.org"  # API base URL
```


- **`token`**: от @BotFather. Обязательно — нет по умолчанию.
- **`timeout=25`**: тайм-аут `getUpdates` в секундах. Также используется для таймаута HTTP-запроса (буфер +10 с).
- **`base`**: переопределение для автономных серверов API ботов или тестирования.

## МтКфг


```python
class MtCfg(BaseModel):
    model_config = ConfigDict(frozen=True)
    host: str                     # MTProto server hostname/IP
    port: int                     # MTProto port (typically 443)
    key: bytes | None = None      # Pre-existing auth key (rare)
    iv: bytes | None = None       # Pre-existing IV (rare)
```


- **`host`**: разрешено на основе параметра `mt_host`, автоматически определяется по карте DC или по умолчанию `"149.154.167.50"`.
- **`port`**: по умолчанию — 443, если не указано иное.
- **`key`/`iv`**: для восстановления существующих сеансов без полного обмена DH. Редко используется напрямую.

## Строительный процесс

В `GoyGram.__init__`:


```python
# 1. Bot config (simple)
bot = BotCfg(token=bot_token, timeout=bot_timeout, base=bot_base) \
      if bot_token is not None else None

# 2. MTProto config (DC resolution)
if bot is None and resolved_host is None:
    # Auto-detect DC
    dc_map = get_dynamic_dc_config()
    selected = pick_dc_endpoint(dc_map, preferred_dc=2)
    resolved_host, resolved_port = selected.host, selected.port

mt = MtCfg(host=resolved_host, port=resolved_port, key=mt_key, iv=mt_iv) \
     if resolved_host and resolved_port else None

# 3. Assemble
self.core = AppCore(AppCfg(bot=bot, mt=mt, bus_max=bus_max), ...)
```


## Конфигурация с двойным транспортом


```python
# Both transports — the "split-brain" full config
app = GoyGram(
    bot_token="123:ABC",           # → BotCfg(token="123:ABC")
    api_id=123, api_hash="abc",    # → MtCfg(host=auto, port=443)
)
# Result: AppCfg(bot=BotCfg(...), mt=MtCfg(...))
```


## Неизменяемость конфигурации

Конфигурация `frozen=True` предотвращает случайную мутацию:


```python
app.core.cfg.bot.timeout = 10  # ❌ raises ValidationError (frozen)
```


Если вам нужно изменить конфигурацию, создайте новый экземпляр `GoyGram`.