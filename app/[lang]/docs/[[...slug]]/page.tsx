import { source, getPage } from '@/lib/source';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsPage, DocsBody } from 'fumadocs-ui/page';
import { notFound, redirect } from 'next/navigation';

export default async function Page(props: {
  params: Promise<{ slug?: string[]; lang: string }>;
}) {
  const params = await props.params;
  const { slug, lang } = params;

  if (slug === undefined || slug.length === 0) {
    redirect(lang === 'en' ? '/docs/Home' : `/${lang}/docs/Home`);
  }

  const page = getPage(slug, lang);
  if (!page) notFound();

  const MDX = (page.data as any).body;
  const toc = (page.data as any).toc;

  return (
    <DocsPage toc={toc}>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
          }}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[]; lang: string }>;
}) {
  const params = await props.params;
  const { slug, lang } = params;
  if (!slug?.length) return { title: 'Docs' };

  const page = getPage(slug, lang);
  if (!page) notFound();
  return { title: page.data.title };
}
