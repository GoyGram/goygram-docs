---
---

# HTML для объектов MTProto

При отправке сообщений через MTProto с помощью `parse_mode="HTML"` GoyGram преобразует теги HTML в формат объекта TL Telegram. Это анализатор регулярных выражений на чистом Python — без внешней библиотеки HTML.

## Функция преобразования


```python
def _html_to_entities(text: str) -> tuple[str, list[tuple[int, int, int, str | None]]]:
    """Returns (cleaned_text, entities_list)."""
```


Каждая сущность представляет собой:

```python
(offset: int, length: int, type_code: int, url: str | None)
```


## Поддерживаемые теги

| HTML-тег | Код типа | Описание |
|----------|-----------|-------------|
| `<b>`, `<strong>` | 1 | Жирный |
| `<i>`, `<em>` | 2 | Курсив |
| `<u>`, `<ins>` | 3 | Подчеркнуть |
| `<s>`, `<strike>`, `<del>` | 4 | Зачеркивание |
| `<code>` | 5 | Встроенный код |
| `<pre>` | 6 | Предварительно отформатированный блок |
| `<a href="...">` | 7 | Текстовая ссылка (с URL) |
| (текстовое упоминание) | 8 | Текстовое упоминание (с идентификатором пользователя) |

## Как это работает

Парсер использует `re.finditer` для поиска всех тегов, а затем отслеживает смещения с помощью стека:


```python
tags = {
    'b': 1, 'strong': 1,
    'i': 2, 'em': 2,
    'u': 3, 'ins': 3,
    's': 4, 'strike': 4, 'del': 4,
    'code': 5,
    'pre': 6,
}

it = re.finditer(r'</?([a-zA-Z][a-zA-Z0-9]*)(?:\s+[^>]*)?>', text)
```


Для каждого тега:
1. **Открывающий тег**: поместите `(current_offset, tag_name, url_or_None)` в стек.
2. **Закрывающий тег**: извлеките соответствующий тег из стека, вычислите `length = current_offset - tag_offset`, добавьте объект.

Для тегов `<a>` извлекается атрибут `href`:

```python
href = re.search(r'href=["\']([^"\']*)["\']', m.group(0))
url = href.group(1) if href else None
```


## Краевые случаи

- **Незакрытые теги**: любые незакрытые теги в конце анализа по-прежнему генерируют объекты (длина = оставшийся текст). Это соответствует собственному поведению Telegram.
- **Несовпадающие закрывающие теги**: анализатор просматривает стек назад, чтобы найти соответствующий открывающий тег. Если `<b><i>text</b></i>`, `</b>` закрывает `<i>` (последний открытый, первый сопоставленный).
- **Пустые объекты**: если `length <= 0`, объект пропускается (не добавляется в список).

## Интеграция

Парсер вызывается в `MTNet._build_body()`, когда `parse_mode == "HTML"`:


```python
if act in {'messages.sendMessage', 'app.bot.send_msg'}:
    text = str(obj.get('text') or obj.get('message') or '')
    entities = None
    if obj.get('parse_mode') == 'HTML':
        text, entities = _html_to_entities(text)
    return self.codec.messages_send_message(
        peer=peer, message=text,
        entities=entities,
        ...
    )
```


Необработанные HTML-теги удаляются из текста; отправляется только форматированный текст + список объектов.

## Кодирование сущностей в TL

Список сущностей сериализуется в формат TL с помощью `MTCodec._encode_entities()`:


```python
def _encode_entities(self, entities):
    raw = u32(0x1cb5c415) + i32(len(entities))  # Vector header
    for offset, length, tp, url in entities:
        if tp == 7 and url:
            raw += u32(0x76a6d327) + i32(offset) + i32(length) + tl_str(url)
        elif tp == 1:
            raw += u32(0xbd610bc9) + i32(offset) + i32(length)  # messageEntityBold
        elif tp == 2:
            raw += u32(0x826f8b60) + i32(offset) + i32(length)  # messageEntityItalic
        # ... etc for each type
```


Каждый тип сущности имеет свой собственный идентификатор конструктора TL. Полученные байты внедряются в полезную нагрузку `messages.sendMessage`.

## Ограничения синтаксического анализа

- Нет вложенных тегов `<a>` (приведет к неправильному анализу).
- Нет `<span>` или стилей на основе CSS (Telegram его не поддерживает).
- `<pre>` с атрибутом `language` не поддерживается (только обычный `<pre>`)
- Экранированные объекты HTML (`&lt;`, `&gt;`) не обрабатываются (они отображаются как обычный текст).