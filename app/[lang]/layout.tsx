import { RootProvider } from 'fumadocs-ui/provider/next';
import { i18n } from '@/lib/i18n';
import type { ReactNode } from 'react';

export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <RootProvider
      i18n={i18n.provider(lang)}
      theme={{
        defaultTheme: 'dark',
        enableSystem: false,
      }}
      search={{
        options: {
          type: 'static',
          api: lang === 'en' ? '/search.json' : `/${lang}/search.json`,
        },
      }}
    >
      {children}
    </RootProvider>
  );
}
