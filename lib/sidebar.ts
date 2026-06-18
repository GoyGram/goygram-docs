import type * as PageTree from 'fumadocs-core/page-tree';

const sidebarTree: PageTree.Root = {
  name: 'GoyGram Docs',
  children: [
    {
      type: 'folder',
      name: 'Getting Started',
      defaultOpen: true,
      children: [
        { type: 'page', name: 'Home', url: '/docs/Home' },
        { type: 'page', name: 'Quick Start (Bot API)', url: '/docs/Quick-Start-Bot-API' },
        { type: 'page', name: 'Quick Start (MTProto)', url: '/docs/Quick-Start-MTProto-Userbot' },
        { type: 'page', name: 'Installation', url: '/docs/Installation' },
        { type: 'page', name: 'Migration Guide', url: '/docs/Migration-Guide' },
      ],
    },
    {
      type: 'folder',
      name: 'Core Architecture',
      defaultOpen: false,
      children: [
        { type: 'page', name: 'Architecture Overview', url: '/docs/Architecture-Overview' },
        { type: 'page', name: 'Split-Brain Design', url: '/docs/Split-Brain-Design' },
        { type: 'page', name: 'Rust Extension Core', url: '/docs/Rust-Extension-Core' },
        { type: 'page', name: 'Event Bus System', url: '/docs/Event-Bus-System' },
        { type: 'page', name: 'Dispatcher & Handler Pipeline', url: '/docs/Dispatcher-and-Handler-Pipeline' },
        { type: 'page', name: 'Dynamic Method Resolution', url: '/docs/Dynamic-Method-Resolution' },
        { type: 'page', name: 'Transport Selection Logic', url: '/docs/Transport-Selection-Logic' },
        { type: 'page', name: 'Type System', url: '/docs/Type-System' },
        { type: 'page', name: 'FSM State Machine', url: '/docs/FSM-State-Machine' },
        { type: 'page', name: 'StopPropagation', url: '/docs/StopPropagation' },
      ],
    },
    {
      type: 'folder',
      name: 'Networking',
      defaultOpen: false,
      children: [
        { type: 'page', name: 'Bot API Transport', url: '/docs/Bot-API-Transport' },
        { type: 'page', name: 'MTProto Transport', url: '/docs/MTProto-Transport' },
        { type: 'page', name: 'MTProto Encryption (AES-IGE)', url: '/docs/MTProto-Encryption-AES-IGE' },
        { type: 'page', name: 'DH Key Exchange', url: '/docs/DH-Key-Exchange' },
        { type: 'page', name: 'MTProto Message Format', url: '/docs/MTProto-Message-Format' },
        { type: 'page', name: 'DC Routing System', url: '/docs/DC-Routing-System' },
        { type: 'page', name: 'Proxy Support', url: '/docs/Proxy-Support' },
        { type: 'page', name: 'Connection Lifecycle', url: '/docs/Connection-Lifecycle' },
      ],
    },
    {
      type: 'folder',
      name: 'Authentication & Security',
      defaultOpen: false,
      children: [
        { type: 'page', name: 'Session Vault (AES-256-GCM)', url: '/docs/Session-Vault-AES-256-GCM' },
        { type: 'page', name: 'Interactive Auth Flow', url: '/docs/Interactive-Auth-Flow' },
        { type: 'page', name: 'Phone Number Login', url: '/docs/Phone-Number-Login' },
        { type: 'page', name: 'QR Code Login', url: '/docs/QR-Code-Login' },
        { type: 'page', name: '2FA / SRP Password', url: '/docs/2FA-SRP-Password' },
        { type: 'page', name: 'Session Migration', url: '/docs/Session-Migration' },
        { type: 'page', name: 'Memory Zeroize Strategy', url: '/docs/Memory-Zeroize-Strategy' },
        { type: 'page', name: 'Vault Key Derivation', url: '/docs/Vault-Key-Derivation' },
      ],
    },
    {
      type: 'folder',
      name: 'Client API Reference',
      defaultOpen: false,
      children: [
        { type: 'page', name: 'GoyGram Client – Full Reference', url: '/docs/Client-Full-Reference' },
        { type: 'page', name: 'Message Handling', url: '/docs/Message-Handling' },
        { type: 'page', name: 'Callback Query Handling', url: '/docs/Callback-Query-Handling' },
        { type: 'page', name: 'Poll Handling', url: '/docs/Poll-Handling' },
        { type: 'page', name: 'Member/Admin Events', url: '/docs/Member-Admin-Events' },
        { type: 'page', name: 'Command System', url: '/docs/Command-System' },
        { type: 'page', name: 'Filter System', url: '/docs/Filter-System' },
        { type: 'page', name: 'Keyboard System', url: '/docs/Keyboard-System' },
        { type: 'page', name: 'HTML to MTProto Entities', url: '/docs/HTML-to-MTProto-Entities' },
      ],
    },
    {
      type: 'folder',
      name: 'Bot API Layer',
      defaultOpen: false,
      children: [
        { type: 'page', name: 'Bot API Methods', url: '/docs/Bot-API-Methods' },
        { type: 'page', name: 'Bot API Types', url: '/docs/Bot-API-Types' },
        { type: 'page', name: 'Bot API Dynamic Dispatch', url: '/docs/Bot-API-Dynamic-Dispatch' },
        { type: 'page', name: 'Webhook Management', url: '/docs/Webhook-Management' },
      ],
    },
    {
      type: 'folder',
      name: 'MTProto Layer',
      defaultOpen: false,
      children: [
        { type: 'page', name: 'MTProto Actions Reference', url: '/docs/MTProto-Actions-Reference' },
        { type: 'page', name: 'MTProto Raw Calls', url: '/docs/MTProto-Raw-Calls' },
        { type: 'page', name: 'Peer Resolution', url: '/docs/Peer-Resolution' },
        { type: 'page', name: 'Channel Management', url: '/docs/Channel-Management' },
        { type: 'page', name: 'Forum/Topic Management', url: '/docs/Forum-Topic-Management' },
      ],
    },
    {
      type: 'folder',
      name: 'Advanced',
      defaultOpen: false,
      children: [
        { type: 'page', name: 'Multi-Session Architecture', url: '/docs/Multi-Session-Architecture' },
        { type: 'page', name: 'Error Handling', url: '/docs/Error-Handling' },
        { type: 'page', name: 'Logging System', url: '/docs/Logging-System' },
        { type: 'page', name: 'Developer Tooling', url: '/docs/Developer-Tooling' },
        { type: 'page', name: 'Code Generation Tools', url: '/docs/Code-Generation-Tools' },
        { type: 'page', name: 'CI/CD Pipeline', url: '/docs/CI-CD-Pipeline' },
      ],
    },
    {
      type: 'folder',
      name: 'Configuration Models',
      defaultOpen: false,
      children: [
        { type: 'page', name: 'AppCfg / BotCfg / MtCfg', url: '/docs/AppCfg-BotCfg-MtCfg' },
        { type: 'page', name: 'Transport Interfaces', url: '/docs/Transport-Interfaces' },
      ],
    },
    {
      type: 'folder',
      name: 'Event Objects',
      defaultOpen: false,
      children: [
        { type: 'page', name: 'MsgObj Reference', url: '/docs/MsgObj-Reference' },
        { type: 'page', name: 'CbObj Reference', url: '/docs/CbObj-Reference' },
        { type: 'page', name: 'MemberObj Reference', url: '/docs/MemberObj-Reference' },
        { type: 'page', name: 'PollObj Reference', url: '/docs/PollObj-Reference' },
      ],
    },
    {
      type: 'folder',
      name: 'Internals',
      defaultOpen: false,
      children: [
        { type: 'page', name: 'MTCodec – TL Codec', url: '/docs/MTCodec-TL-Codec' },
        { type: 'page', name: 'RSA Public Key Registry', url: '/docs/RSA-Public-Key-Registry' },
        { type: 'page', name: 'Intermediate Transport Format', url: '/docs/Intermediate-Transport-Format' },
        { type: 'page', name: 'TL Schema Generator', url: '/docs/TL-Schema-Generator' },
        { type: 'page', name: 'Bot API Code Generator', url: '/docs/Bot-API-Code-Generator' },
        { type: 'page', name: 'Vault Wire Format', url: '/docs/Vault-Wire-Format' },
        { type: 'page', name: 'Proxy URL Parsing', url: '/docs/Proxy-URL-Parsing' },
      ],
    },
  ],
};

function translateUrls(tree: PageTree.Root, locale: string): PageTree.Root {
  const prefix = `/${locale}`;
  function walkChildren(nodes: PageTree.Node[]): PageTree.Node[] {
    return nodes.map((node) => {
      if (node.type === 'page') {
        return { ...node, url: `${prefix}${node.url}` };
      }
      if (node.type === 'folder') {
        return {
          ...node,
          children: walkChildren(node.children),
        };
      }
      return node;
    });
  }
  return {
    ...tree,
    children: tree.children ? walkChildren(tree.children) : [],
  };
}

export function getSidebarTree(locale: string): PageTree.Root {
  if (locale === 'en') return sidebarTree;
  return translateUrls(sidebarTree, locale);
}
