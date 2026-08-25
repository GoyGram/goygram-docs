import type * as PageTree from 'fumadocs-core/page-tree';

const RU_NAMES: Record<string, string> = {
  'GoyGram Docs': 'Документация GoyGram',
  'Getting started': 'Начало работы',
  'Reference': 'Справочник',
  'Build features': 'Разработка функций',
  'Technical reference': 'Технический справочник',
  'Overview': 'Обзор',
  'Installation': 'Установка',
  'Quick start: Bot API': 'Быстрый старт: Bot API',
  'Quick start: MTProto userbot': 'Быстрый старт: MTProto-юзербот',
  'How to write GoyGram code': 'Как писать код для GoyGram',
  'How GoyGram handles bytes and TL': 'Как GoyGram работает с байтами и TL',
  'Configuration and transports': 'Конфигурация и транспорты',
  'Client reference': 'Справочник клиента',
  'Handlers and updates': 'Обработчики и обновления',
  'Event objects': 'Объекты событий',
  'Filters': 'Фильтры',
  'Bot API calls': 'Вызовы Bot API',
  'MTProto calls': 'Вызовы MTProto',
  'Keyboards, formatting and state': 'Клавиатуры, форматирование и состояние',
  'Sessions and authentication': 'Сессии и аутентификация',
  'Polls and membership updates': 'Опросы и обновления участников',
  'Files and media': 'Файлы и медиа',
  'Scheduling and background work': 'Планирование и фоновые задачи',
  'Architecture and runtime behavior': 'Архитектура и поведение во время работы',
  'Errors, logging and troubleshooting': 'Ошибки, логирование и диагностика',
  'Migration and compatibility': 'Миграция и совместимость',
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
        page('How to write GoyGram code', 'Writing-Code'),
        page('How GoyGram handles bytes and TL', 'Bytes-and-TL'),
        page('Configuration and transports', 'Configuration-and-Transports'),
      ],
    },
    {
      type: 'folder', name: 'Reference', defaultOpen: false,
      children: [
        page('Client reference', 'GoyGram-Client-Reference'),
        page('Handlers and updates', 'Handlers-and-Updates'),
        page('Event objects', 'Event-Objects'),
        page('Filters', 'Filters'),
        page('Bot API calls', 'Bot-API-Calls'),
        page('MTProto calls', 'MTProto-Calls'),
      ],
    },
    {
      type: 'folder', name: 'Build features', defaultOpen: false,
      children: [
        page('Keyboards, formatting and state', 'Keyboards-Formatting-and-State'),
        page('Sessions and authentication', 'Sessions-and-Authentication'),
        page('Polls and membership updates', 'Polling-and-Membership'),
        page('Files and media', 'Files-and-Media'),
        page('Scheduling and background work', 'Scheduling-and-Background-Work'),
      ],
    },
    {
      type: 'folder', name: 'Technical reference', defaultOpen: false,
      children: [
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
    if (node.type === 'page') return { ...node, url: `/${locale}${node.url}` };
    if (node.type === 'folder') return { ...node, children: walk(node.children) };
    return node;
  });
  return { ...tree, children: walk(tree.children) };
}

export function getSidebarTree(locale: string): PageTree.Root {
  if (locale === 'en') return sidebarTree;
  const tree = translateUrls(sidebarTree, locale);
  translateNames(tree);
  return tree;
}
