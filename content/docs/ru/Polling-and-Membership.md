---
title: "Polling and Membership"
---

# Опросы и обновления членства

GoyGram предоставляет специальные обработчики для опросов Telegram и изменений участников чата. Зарегистрируйте их перед `run()`, как и обработчики сообщений.

## Обновления опросов


```python
@app.on_poll
async def poll_changed(poll):
    print(poll.id, poll.question)
    for answer in poll.options:
        print(answer.text, answer.voter_count)
```


`PollObj` содержит идентификатор опроса, вопрос, параметры, общее количество проголосовавших, флаги анонимности/множественных ответов, состояние закрытия и правильную информацию о параметрах, предоставляемую Telegram для опросов-викторин.

Используйте фильтр, когда полезно только подмножество:


```python
from goygram import filters

@app.on_poll(filt=filters.func(lambda poll: poll.is_closed))
async def closed_poll(poll):
    print("closed:", poll.question)
```


## Обновления участников чата


```python
@app.on_member
async def member_changed(member):
    print(member.chat.id, member.from_user.id)
```


`MemberObj` представляет собой обновление API бота `my_chat_member` или `chat_member`. Его поля `old_chat_member` и `new_chat_member` сохраняют полезную нагрузку Telegram, позволяя приложениям сравнивать статус или разрешения в соответствии с их собственной политикой.

## Необработанные обновления

Не каждое обновление Telegram имеет специализированный объект. Используйте `on_update` для исходных полезных данных обновления:


```python
@app.on_update
async def audit(update):
    print(update)
```


Необработанные обновления полезны для наблюдения и для дополнений API ботов, которые еще не получили удобство. Не полагайтесь на одну точную форму словаря в Bot API и MTProto; проверять и нормализовать данные, необходимые вашему приложению.

Связано: [Обработчики и обновления](/ru/docs/Обработчики и обновления), [Объекты событий](/ru/docs/Объекты событий) и [Фильтры](/ru/docs/Фильтры).