---
title: "Парсинг URL-адреса прокси"

---
# Парсинг URL-адреса прокси

GoyGram поддерживает прокси-серверы SOCKS5 и HTTP CONNECT для соединений MTProto.

## Конфигурация

Прокси настраиваются через параметр `proxy` конструктора `GoyGram` или через переменные среды:


```python
app = GoyGram(
    mt_host="149.154.167.50",
    mt_port=443,
    proxy="socks5://user:pass@proxy.example.com:1080",
    ...
)
```


## Переменные среды

Приоритет, когда `proxy` не передается явно:

1. `ALL_PROXY` / `all_proxy`
2. `HTTPS_PROXY` / `https_proxy`
3. `HTTP_PROXY` / `http_proxy`

## ProxyCfg — анализ URL-адресов


```python
class ProxyCfg:
    def __init__(self, scheme, host, port, user=None, pwd=None):
        self.scheme = scheme  # "socks5", "socks5h", "http"
        self.host = host
        self.port = port
        self.user = user
        self.pwd = pwd
```


Разбор через `urllib.parse`:


```python
def proxy_cfg(self) -> ProxyCfg | None:
    raw = self.proxy_url or os.getenv("ALL_PROXY") or \
          os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY")
    if not raw:
        return None
    p = urllib.parse.urlparse(raw)
    scheme = p.scheme.lower()
    if scheme not in {"socks5", "socks5h", "http"}:
        return None
    user = urllib.parse.unquote(p.username) if p.username else None
    pwd = urllib.parse.unquote(p.password) if p.password else None
    return ProxyCfg(scheme, p.hostname, p.port, user, pwd)
```


## Формат URL-адреса


```
socks5://user:pass@host:port
socks5://host:port
http://user:pass@host:port
http://host:port
```


## SOCKS5 Рукопожатие

Полный SOCKS5 с поддержкой аутентификации по имени пользователя и паролю (RFC 1929):


```python
async def socks5_handshake(self, rd, wr, px, dst_host, dst_port):
    # 1. Authentication method proposal
    methods = [0]  # NO AUTH
    if px.user or px.pwd:
        methods.append(2)  # USERNAME/PASSWORD
    wr.write(bytes([5, len(methods), *methods]))

    # 2. If server picked method 2 — username/password auth
    if rsp[1] == 2:
        u = (px.user or "").encode()
        pw = (px.pwd or "").encode()
        wr.write(bytes([1, len(u)]) + u + bytes([len(pw)]) + pw)

    # 3. CONNECT request to dst_host:dst_port
    host_b = dst_host.encode("idna")
    req = bytes([5, 1, 0, 3, len(host_b)]) + host_b + dst_port.to_bytes(2, "big")
    wr.write(req)
```


## HTTP CONNECT Рукопожатие


```python
async def http_connect_handshake(self, rd, wr, px, dst_host, dst_port):
    auth = ""
    if px.user or px.pwd:
        token = f"{px.user or ''}:{px.pwd or ''}".encode()
        auth = f"Proxy-Authorization: Basic {base64.b64encode(token).decode()}\r\n"
    req = (
        f"CONNECT {dst_host}:{dst_port} HTTP/1.1\r\n"
        f"Host: {dst_host}:{dst_port}\r\n"
        f"{auth}"
        "Proxy-Connection: Keep-Alive\r\n\r\n"
    ).encode()
    wr.write(req)
    # Validate HTTP 200
    ...
```


## open_via_proxy()

Выбирает правильное рукопожатие на основе схемы прокси:


```python
async def open_via_proxy(self, px: ProxyCfg):
    rd, wr = await asyncio.open_connection(px.host, px.port)
    if px.scheme in {"socks5", "socks5h"}:
        await self.socks5_handshake(rd, wr, px, self.host, self.port)
    elif px.scheme == "http":
        await self.http_connect_handshake(rd, wr, px, self.host, self.port)
    return rd, wr
```