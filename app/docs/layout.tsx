import { getSidebarTree } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { i18n } from '@/lib/i18n';
import { baseOptions } from '@/lib/shared';
import type { ReactNode } from 'react';

export default function EnDocsLayout({ children }: { children: ReactNode }) {
  const pageTree = getSidebarTree('en');

  return (
    <RootProvider
      i18n={i18n.provider('en')}
      theme={{
        defaultTheme: 'dark',
        enableSystem: false,
      }}
      search={{
        options: {
          type: 'static',
          api: '/search.json',
        },
      }}
    >
      <DocsLayout tree={pageTree} {...baseOptions}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
