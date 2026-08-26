'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { i18n } from '@/lib/i18n';

type Locale = 'en' | 'ru';

export function LocalizedRootProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const provider = i18n.provider(locale);

  provider.onLocaleChange = (nextLocale) => {
    const englishPath = pathname.startsWith('/ru') ? pathname.slice(3) || '/docs' : pathname;
    const nextPath = nextLocale === 'ru'
      ? englishPath.startsWith('/ru') ? englishPath : `/ru${englishPath}`
      : englishPath;
    router.push(nextPath);
  };

  return (
    <RootProvider
      {...provider}
      theme={{
        defaultTheme: 'dark',
        enableSystem: false,
      }}
      search={{
        options: {
          type: 'static',
          api: locale === 'ru' ? '/ru/search.json' : '/search.json',
        },
      }}
    >
      {children}
    </RootProvider>
  );
}
