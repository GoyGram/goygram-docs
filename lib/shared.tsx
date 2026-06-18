import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

const GoyGramLogo = () => (
  <img
    src="https://raw.githubusercontent.com/GoyGram/GoyGram/main/GoyGram.png"
    alt="GoyGram"
    style={{ height: '2rem', width: 'auto' }}
  />
);

export const baseOptions = {
  nav: {
    title: <GoyGramLogo />,
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
