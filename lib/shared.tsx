import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions = {
  nav: {
    title: 'GoyGram',
  },
  githubUrl: 'https://github.com/GoyGram/GoyGram',
  links: [
    {
      type: 'main' as const,
      text: 'GitHub',
      url: 'https://github.com/GoyGram/GoyGram',
      active: 'nested-url' as const,
    },
  ],
  sidebar: {
    collapsible: false,
  },
};
