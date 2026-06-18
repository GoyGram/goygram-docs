import { create, insertMultiple, save } from '@orama/orama';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const CONTENT_DIR = 'content/docs';
const OUTPUT_FILE = 'public/search.json';

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
  // Deduplicate by trimming and taking only distinct meaningful sections
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

const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));

const docs = [];
for (const file of files) {
  const raw = readFileSync(join(CONTENT_DIR, file), 'utf-8');
  const { title, description, body } = extractFrontmatter(raw);
  const pageTitle = title || basename(file, '.md').replace(/-/g, ' ');
  const pageId = file.replace('.md', '');
  const url = `/docs/${pageId}`;
  const headings = extractHeadings(body);
  const sections = extractContentSections(body);
  const tags = [];
  const breadcrumbs = [];

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

const db = await create({
  schema: {
    id: 'string',
    page_id: 'string',
    type: 'string',
    content: 'string',
    breadcrumbs: 'string[]',
    tags: 'string[]',
    url: 'string',
  },
  language: 'english',
});

await insertMultiple(db, docs);
const saved = save(db);

mkdirSync('public', { recursive: true });
writeFileSync(OUTPUT_FILE, JSON.stringify({ ...saved, type: 'advanced' }));
console.log(`Generated search index: ${docs.length} documents from ${files.length} pages`);
