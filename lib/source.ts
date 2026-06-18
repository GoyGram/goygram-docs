import { docs } from 'fumadocs-mdx:collections/server';
import { loader } from 'fumadocs-core/source';
import { i18n } from '@/lib/i18n';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  i18n,
});

export function getPage(slug: string[], lang: string) {
  return source.getPage(slug, lang);
}

export { getSidebarTree } from '@/lib/sidebar';
