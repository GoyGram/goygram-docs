import { getSidebarTree } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/shared';
import { LocalizedRootProvider } from '@/components/LocalizedRootProvider';
import type { ReactNode } from 'react';

export default function RuDocsLayout({ children }: { children: ReactNode }) {
  const pageTree = getSidebarTree('ru');

  return (
    <LocalizedRootProvider locale="ru">
      <DocsLayout tree={pageTree} {...baseOptions}>
        {children}
      </DocsLayout>
    </LocalizedRootProvider>
  );
}
