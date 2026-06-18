import { source } from '@/lib/source';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsPage, DocsBody } from 'fumadocs-ui/page';
import { notFound, redirect } from 'next/navigation';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const slug = params.slug;

  if (slug === undefined || slug.length === 0) {
    redirect('/docs/Home');
  }

  const page = source.getPage(slug);
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
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const slug = params.slug;
  if (!slug?.length) return { title: 'Docs' };

  const page = source.getPage(slug);
  if (!page) notFound();
  return { title: page.data.title };
}
