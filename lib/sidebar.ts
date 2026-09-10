import type * as PageTree from 'fumadocs-core/page-tree';

const RU_NAMES: Record<string, string> = {
  'GoyGram Docs': 'Документация GoyGram',
  'Getting started': 'Начало работы',
  'Core concepts': 'Основы',
  'Reference': 'Справочник',
  'Advanced': 'Дополнительно',
  'Overview': 'Обзор',
  'Installation': 'Установка',
  'Quick start: Bot API': 'Быстрый старт: Bot API',
  'Quick start: MTProto userbot': 'Быстрый старт: MTProto-юзербот',
  'Writing GoyGram code': 'Как писать код для GoyGram',
  'Handlers and updates': 'Обработчики и обновления',
  'Update reference': 'Справочник обновлений',
  'Filters': 'Фильтры',
  'Event objects': 'Объекты событий',
  'Keyboards, formatting and state': 'Клавиатуры, форматирование и состояние',
  'Rich messages': 'Rich-сообщения',
  'Files and media': 'Файлы и медиа',
  'Sugar API helpers': 'Сахарные помощники (Sugar API)',
  'Client reference': 'Справочник клиента',
  'Bot API calls': 'Вызовы Bot API',
  'MTProto calls': 'Вызовы MTProto',
  'Bytes and TL data': 'Байты и TL',
  'MTProto message format': 'Формат сообщения MTProto',
  'Sessions and authentication': 'Сессии и аутентификация',
  'Polling and membership': 'Опросы и участники',
  'Scheduling and background work': 'Планировщик и фоновая работа',
  'Configuration and transports': 'Настройка и транспорты',
  'Architecture and runtime behavior': 'Архитектура и поведение во время работы',
  'Errors, logging and troubleshooting': 'Ошибки и диагностика',
  'Migration and compatibility': 'Миграция и совместимость',
  'Benchmarks': 'Бенчмарки',
  'FAQ': 'Вопросы и ответы',
};

function translateNames(tree: PageTree.Root): void {
  const walk = (node: PageTree.Node): void => {
    if ('name' in node && typeof node.name === 'string' && node.name in RU_NAMES) {
      node.name = RU_NAMES[node.name];
    }
    if ('children' in node) node.children.forEach(walk);
  };
  tree.children.forEach(walk);
}

const page = (name: string, slug: string): PageTree.Node => ({
  type: 'page', name, url: `/docs/${slug}`,
});

const sidebarTree: PageTree.Root = {
  name: 'GoyGram Docs',
  children: [
    {
      type: 'folder', name: 'Getting started', defaultOpen: true,
      children: [
        page('Overview', 'Home'),
        page('Installation', 'Installation'),
        page('Quick start: Bot API', 'Quick-Start-Bot-API'),
        page('Quick start: MTProto userbot', 'Quick-Start-MTProto-Userbot'),
      ],
    },
    {
      type: 'folder', name: 'Core concepts', defaultOpen: true,
      children: [
        page('Writing GoyGram code', 'Writing-Code'),
        page('Handlers and updates', 'Handlers-and-Updates'),
        page('Update reference', 'Update-Reference'),
        page('Filters', 'Filters'),
        page('Event objects', 'Event-Objects'),
        page('Keyboards, formatting and state', 'Keyboards-Formatting-and-State'),
        page('Rich messages', 'Rich-API'),
        page('Files and media', 'Files-and-Media'),
        page('Sugar API helpers', 'Sugar-API'),
      ],
    },
    {
      type: 'folder', name: 'Reference', defaultOpen: false,
      children: [
        page('Client reference', 'GoyGram-Client-Reference'),
        page('Bot API calls', 'Bot-API-Calls'),
        page('MTProto calls', 'MTProto-Calls'),
        page('Bytes and TL data', 'Bytes-and-TL'),
        page('MTProto message format', 'MTProto-Message-Format'),
        page('Sessions and authentication', 'Sessions-and-Authentication'),
        page('Polling and membership', 'Polling-and-Membership'),
        page('Scheduling and background work', 'Scheduling-and-Background-Work'),
        page('Benchmarks', 'Benchmarks'),
      ],
    },
    {
      type: 'folder', name: 'Advanced', defaultOpen: false,
      children: [
        page('Configuration and transports', 'Configuration-and-Transports'),
        page('Architecture and runtime behavior', 'Architecture-and-Runtime-Behavior'),
        page('Errors, logging and troubleshooting', 'Errors-Logging-and-Troubleshooting'),
        page('Migration and compatibility', 'Migration-and-Compatibility'),
        page('FAQ', 'FAQ'),
      ],
    },
  ],
};

function translateUrls(tree: PageTree.Root, locale: string): PageTree.Root {
  const walk = (nodes: PageTree.Node[]): PageTree.Node[] => nodes.map((node) => {
    if (node.type === 'page') return { ...node, url: locale === 'en' ? node.url : `/${locale}${node.url}` };
    if (node.type === 'folder') return { ...node, children: walk(node.children) };
    return node;
  });
  return { ...tree, children: walk(tree.children) };
}

export function getSidebarTree(locale: string): PageTree.Root {
  const tree = translateUrls(sidebarTree, locale);
  if (locale !== 'en') translateNames(tree);
  return tree;
}
