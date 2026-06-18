import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import rehypeRaw from 'rehype-raw';

export const docs = defineDocs({
  dir: 'content/docs',
});

export default defineConfig({
  mdxOptions: {
    rehypePlugins: [rehypeRaw],
  },
});
