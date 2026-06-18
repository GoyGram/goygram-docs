import { create, insertMultiple, save } from '@orama/orama';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { title: '', description: '', body: content };
  const fm = match[1];
  const title = (fm.match(/^title:\s*(.+)/m) || [])[1] || '';
  const description = (fm.match(/^description:\s*(.+)/m) || [])[1] || '';
  const body = content.slice(match[0].length);
  return { title, description, body };
}

function extractHeadings(content) {
  const headings = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const m = line.match(/^(#{2,4})\s+(.+)/);
    if (m) {
      const text = m[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      headings.push({ level: m[1].length, content: text, id });
    }
  }
  return headings;
}

function extractContentSections(body) {
  const sections = body.split(/\n\n+/).filter(s => s.trim() && !s.match(/^#{1,4}\s/));
  const seen = new Set();
  const result = [];
  for (const s of sections) {
    const clean = s.trim();
    if (clean && !seen.has(clean.slice(0, 80)) && clean.length > 30 && !clean.match(/^[|\-+]+$/)) {
      seen.add(clean.slice(0, 80));
      result.push({
        content: clean.slice(0, 600),
        heading: null,
      });
    }
  }
  return result.slice(0, 10);
}

async function buildLocaleIndex(contentDir, outputFile, localePrefix, language) {
  const files = readdirSync(contentDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log(`  No .md files in ${contentDir}`);
    return 0;
  }

  const docs = [];
  for (const file of files) {
    const raw = readFileSync(join(contentDir, file), 'utf-8');
    const { title, description, body } = extractFrontmatter(raw);
    const pageTitle = title || basename(file, '.md').replace(/-/g, ' ');
    const pageId = file.replace('.md', '');
    const url = `${localePrefix}/docs/${pageId}`;
    const headings = extractHeadings(body);
    const sections = extractContentSections(body);
    const breadcrumbs = [];
    const tags = [];

    docs.push({
      id: pageId,
      page_id: pageId,
      type: 'page',
      content: pageTitle,
      breadcrumbs,
      tags,
      url,
    });

    if (description) {
      docs.push({
        id: `${pageId}-desc`,
        page_id: pageId,
        type: 'text',
        content: description,
        breadcrumbs,
        tags,
        url,
      });
    }

    for (let hi = 0; hi < headings.length; hi++) {
      const h = headings[hi];
      docs.push({
        id: `${pageId}-h-${hi}`,
        page_id: pageId,
        type: 'heading',
        content: h.content,
        breadcrumbs,
        tags,
        url: `${url}#${h.id}`,
      });
    }

    for (let i = 0; i < sections.length; i++) {
      docs.push({
        id: `${pageId}-c-${i}`,
        page_id: pageId,
        type: 'text',
        content: sections[i].content,
        breadcrumbs,
        tags,
        url,
      });
    }
  }

  // No document count guard — let all through
  if (docs.length === 0) {
    console.log(`  No searchable content in ${contentDir}`);
    return 0;
  }

  // @orama/orama v3 uses more flexible schemas
  const schema = {
    id: 'string',
    page_id: 'string',
    type: 'string',
    content: 'string',
    breadcrumbs: 'string[]',
    tags: 'string[]',
    url: 'string',
  };

  try {
    const db = await create({ schema, language });
    await insertMultiple(db, docs);
    const saved = save(db);

    mkdirSync(outputFile.substring(0, outputFile.lastIndexOf('/')), { recursive: true });
    // Fumadocs static expects "type" and the index data at top level
    writeFileSync(outputFile, JSON.stringify(saved, null, 2));
    return docs.length;
  } catch (err) {
    console.error(`  Build error for ${localePrefix}:`, err.message);
    return 0;
  }
}

async function main() {
  mkdirSync('public', { recursive: true });
  mkdirSync('public/ru', { recursive: true });

  console.log('Building EN search index...');
  const enCount = await buildLocaleIndex('content/docs/en', 'public/search.json', '', 'english');

  console.log('Building RU search index...');
  const ruCount = await buildLocaleIndex('content/docs/ru', 'public/ru/search.json', '/ru', 'russian');

  console.log(`Done: EN=${enCount} docs, RU=${ruCount} docs`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
