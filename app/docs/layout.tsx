import { getSidebarTree } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/shared';
import { LocalizedRootProvider } from '@/components/LocalizedRootProvider';
import type { ReactNode } from 'react';

export default function EnDocsLayout({ children }: { children: ReactNode }) {
  const pageTree = getSidebarTree('en');

  return (
    <LocalizedRootProvider locale="en">
      <DocsLayout tree={pageTree} {...baseOptions}>
        {children}
      </DocsLayout>
    </LocalizedRootProvider>
  );
}
