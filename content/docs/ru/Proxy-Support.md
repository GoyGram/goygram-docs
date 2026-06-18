---
title: "Поддержка прокси"

---
# Поддержка прокси

GoyGram поддерживает прокси-серверы SOCKS5 и HTTP CONNECT для соединений MTProto. Оба прикрепляются болтами — они оборачивают сокет TCP во время соединения, а затем прозрачно запускается MTProto.

## Конфигурация прокси

### Параметр конструктора


```python
app = GoyGram(
    api_id=123,
    api_hash="abc",
    proxy="socks5://user:pass@proxy.example.com:1080"
    # proxy="socks5h://proxy.example.com:1080"  # proxy does DNS
    # proxy="http://proxy.example.com:8080"      # HTTP CONNECT
)
```


### Переменные среды

Если конструктору не передан прокси, GoyGram проверяет переменные среды:


```python
def proxy_cfg(self):
    if self.proxy_url:
        raw = self.proxy_url
    else:
        raw = (
            os.getenv("ALL_PROXY") or os.getenv("all_proxy")
            or os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")
            or os.getenv("HTTP_PROXY") or os.getenv("http_proxy")
        )
    # ... parse and validate
```


Приоритетный порядок:
1. Параметр конструктора `proxy=`
2. `ALL_PROXY` / `all_proxy`
3. `HTTPS_PROXY` / `https_proxy`
4. `HTTP_PROXY` / `http_proxy`

Используется только один прокси — первый установленный.

## Парсинг URL-адресов


```python
p = urllib.parse.urlparse(raw)
scheme = p.scheme.lower()
if scheme not in {"socks5", "socks5h", "http"}:
    return None  # unsupported, skip proxy
if not p.hostname or not p.port:
    return None  # invalid URL, skip proxy
user = urllib.parse.unquote(p.username) if p.username else None
pwd = urllib.parse.unquote(p.password) if p.password else None
return ProxyCfg(scheme, p.hostname, p.port, user, pwd)
```


## SOCKS5 Рукопожатие


```python
async def socks5_handshake(self, rd, wr, px, dst_host, dst_port):
    # 1. Method negotiation
    methods = [0]  # no auth
    if px.user is not None or px.pwd is not None:
        methods.append(2)  # username/password auth
    wr.write(bytes([5, len(methods), *methods]))
    await wr.drain()
    rsp = await rd.readexactly(2)
    if rsp[0] != 5 or rsp[1] == 0xFF:
        raise ConnectionError(f"SOCKS5 auth method negotiation failed: {rsp.hex()}")

    # 2. Authenticate (if method 2)
    if rsp[1] == 2:
        u = (px.user or "").encode()
        pw = (px.pwd or "").encode()
        wr.write(bytes([1, len(u)]) + u + bytes([len(pw)]) + pw)
        await wr.drain()
        ar = await rd.readexactly(2)
        if ar[1] != 0:
            raise ConnectionError(f"SOCKS5 auth failed: {ar.hex()}")

    # 3. CONNECT request (domain name, ATYP=3)
    host_b = dst_host.encode("idna")
    req = bytes([5, 1, 0, 3, len(host_b)]) + host_b + dst_port.to_bytes(2, "big")
    wr.write(req)
    await wr.drain()

    # 4. Read reply
    head = await rd.readexactly(4)
    if head[0] != 5 or head[1] != 0:
        raise ConnectionError(f"SOCKS5 connect failed: {head.hex()}")

    # 5. Skip bind address
    atyp = head[3]
    if atyp == 1:      # IPv4: 4 + 2 bytes
        await rd.readexactly(6)
    elif atyp == 3:    # Domain: 1 + n + 2 bytes
        ln = await rd.readexactly(1)
        await rd.readexactly(ln[0] + 2)
    elif atyp == 4:    # IPv6: 16 + 2 bytes
        await rd.readexactly(18)
```


Ключевые детали:
- Использует **адресацию доменного имени** (ATYP=3) — прокси разрешает DNS.
- `socks5h://` делает то же самое (также на основе домена)
- Реализована аутентификация по паролю (имя пользователя/пароль RFC 1929).
- Проверка длины имени пользователя/пароля (максимум 255 байт)

## HTTP CONNECT Рукопожатие


```python
async def http_connect_handshake(self, rd, wr, px, dst_host, dst_port):
    # Build CONNECT request
    auth = ""
    if px.user is not None or px.pwd is not None:
        token = f"{px.user or ''}:{px.pwd or ''}".encode("utf-8")
        auth = f"Proxy-Authorization: Basic {base64.b64encode(token).decode('ascii')}\r\n"

    req = (
        f"CONNECT {dst_host}:{dst_port} HTTP/1.1\r\n"
        f"Host: {dst_host}:{dst_port}\r\n"
        f"{auth}"
        "Proxy-Connection: Keep-Alive\r\n\r\n"
    ).encode("ascii", errors="ignore")

    wr.write(req)
    await wr.drain()

    # Read response headers (up to 64KB)
    resp = await self._read_http_headers(rd)

    # Parse status line
    head = resp.split(b"\r\n", 1)[0].decode("iso-8859-1", errors="ignore")
    parts = head.split(" ", 2)
    status = int(parts[1])
    if status != 200:
        raise ConnectionError(f"HTTP proxy CONNECT failed with status {status}: {head}")
```


Простое туннелирование HTTP CONNECT с поддержкой базовой аутентификации. После ответа 200 сокет представляет собой прозрачный туннель.

## Подключение через прокси

Метод `open_via_proxy` заменяет обычное TCP-соединение:


```python
async def open_via_proxy(self, px):
    rd, wr = await asyncio.open_connection(px.host, px.port)  # connect to proxy
    if px.scheme in {"socks5", "socks5h"}:
        await self.socks5_handshake(rd, wr, px, self.host, self.port)
    elif px.scheme == "http":
        await self.http_connect_handshake(rd, wr, px, self.host, self.port)
    return rd, wr  # return tunneled stream
```


После подтверждения прокси-сервера `rd` и `wr` используются точно так же, как при прямом соединении. MTProto кадрирование, шифрование, все работает сверху прозрачно.

## Обработка ошибок

Все ошибки прокси вызывают `ConnectionError` с описательными сообщениями. Это распространяется через `MTNet.boot()` и в конечном итоге приводит к сбою `MTNet.spin()`, что приводит к остановке задачи MTProto. Приложение не выполняет автоматически повторную попытку с другим прокси-сервером — если прокси-сервер выходит из строя, соединение прерывается.