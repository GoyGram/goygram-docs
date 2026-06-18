import { getPage } from '@/lib/source';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsPage, DocsBody } from 'fumadocs-ui/page';
import { notFound, redirect } from 'next/navigation';
import fs from 'fs';
import path from 'path';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const { slug } = params;

  if (slug === undefined || slug.length === 0) {
    redirect('/docs/Home');
  }

  const page = getPage(slug, 'en');
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

export async function generateStaticParams() {
  const contentDir = path.join(process.cwd(), 'content/docs');
  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));
  return files.map(f => ({
    slug: [f.replace('.md', '')],
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const { slug } = params;
  if (!slug?.length) return { title: 'Docs' };

  const page = getPage(slug, 'en');
  if (!page) notFound();
  return { title: page.data.title };
}
