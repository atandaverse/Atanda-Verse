import fs from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const POST_SOURCES = [
  { id: 'school-na-scam-ep1', file: 'posts/school-na-scam-ep1.html' },
  { id: 'school-na-scam-ep2', file: 'posts/school-na-scam-ep2.html' },
  { id: 'school-na-scam-ep3', file: 'posts/school-na-scam-ep3.html' },
  { id: 'school-na-scam-ep4', file: 'posts/school-na-scam-ep4.html' },
];

const configJs = fs.existsSync('config.js') ? fs.readFileSync('config.js', 'utf8') : '';

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value = '') {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeAssetPath(value = '') {
  return value.replace(/^\.\.\//, '').replace(/\\/g, '/');
}

function getFeaturedImage(html) {
  const featuredBlock = getClassInnerHtml(html, 'featured-image', 'div');
  const src = featuredBlock.match(/<img[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '';
  return normalizeAssetPath(decodeHtml(src));
}

function getReadTime(metaItems) {
  const item = metaItems.find((value) => /min read/i.test(value)) || '';
  return item.match(/\b\d+\s+min read\b/i)?.[0] || '5 min read';
}

function getClassInnerHtml(html, className, tag = '[a-z0-9]+') {
  const pattern = new RegExp(`<${tag}[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return html.match(pattern)?.[1]?.trim() || '';
}

function extractArticleContent(html, file) {
  const startMatch = /<div[^>]*class=["'][^"']*\barticle-content\b[^"']*["'][^>]*>/i.exec(html);
  if (!startMatch) throw new Error(`Could not locate article-content in ${file}`);

  const openStart = startMatch.index;
  const openEnd = openStart + startMatch[0].length;
  const divPattern = /<\/?div\b[^>]*>/gi;
  divPattern.lastIndex = openStart;

  let depth = 0;
  let match;
  while ((match = divPattern.exec(html))) {
    const isClosing = /^<\//.test(match[0]);
    const isSelfClosing = /\/>$/.test(match[0]);
    if (isClosing) {
      depth -= 1;
      if (depth === 0) return html.slice(openEnd, match.index).trim();
    } else if (!isSelfClosing) {
      depth += 1;
    }
  }

  throw new Error(`Could not find closing article-content div in ${file}`);
}

function parseDisplayDate(value, file) {
  const clean = stripTags(value).replace(/^[^\w]+/, '');
  const match = clean.match(/\b([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b/);
  if (!match) throw new Error(`Could not parse article date in ${file}: ${clean}`);

  const month = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  }[match[1].toLowerCase()];
  if (!month) throw new Error(`Unknown article month in ${file}: ${match[1]}`);

  return `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
}

function parsePost({ id, file }) {
  const html = fs.readFileSync(file, 'utf8');
  const metaHtml = getClassInnerHtml(html, 'article-meta', 'div');
  const metaItems = [...metaHtml.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((item) => stripTags(item[1]));
  const image = getFeaturedImage(html);
  const content = extractArticleContent(html, file).replace(/\.\.\/images\//g, 'images/');

  return {
    id,
    title: stripTags(getClassInnerHtml(html, 'article-title', 'h1')),
    subtitle: stripTags(getClassInnerHtml(html, 'article-subtitle', 'p')),
    category: stripTags(getClassInnerHtml(html, 'article-category', 'div')) || 'Education & Career',
    status: 'published',
    read_time: getReadTime(metaItems),
    date: parseDisplayDate(metaItems.find((item) => /\d{4}/.test(item)) || '', file),
    excerpt: decodeHtml(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || ''),
    image,
    emoji: stripTags(getClassInnerHtml(html, 'featured-image-fallback', 'div')),
    content,
  };
}

function summarize(rows) {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    read_time: row.read_time,
    image: row.image,
    contentLength: row.content.length,
    richBlocks: (row.content.match(/class=["'][^"']+["']/g) || []).length,
  }));
}

const rows = POST_SOURCES.map(parsePost);

if (DRY_RUN) {
  console.log(JSON.stringify({ dryRun: true, source: path.normalize('posts/*.html'), posts: summarize(rows) }, null, 2));
  process.exit(0);
}

const supabaseUrl =
  process.env.SUPABASE_URL ||
  configJs.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)?.[1];
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  configJs.match(/DEFAULT_SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1];

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL and SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY');
}

const upsert = await fetch(`${supabaseUrl}/rest/v1/posts?on_conflict=id`, {
  method: 'POST',
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  },
  body: JSON.stringify(rows),
});

const upsertText = await upsert.text();
if (!upsert.ok) {
  throw new Error(`Supabase upsert failed ${upsert.status}: ${upsertText}`);
}

const verify = await fetch(
  `${supabaseUrl}/rest/v1/posts?select=id,title,date,content&id=in.(${rows.map((row) => row.id).join(',')})&order=date.asc`,
  { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
);
const verifyText = await verify.text();
if (!verify.ok) {
  throw new Error(`Supabase verify failed ${verify.status}: ${verifyText}`);
}

const restored = JSON.parse(verifyText).map((post) => ({
  id: post.id,
  title: post.title,
  date: post.date,
  contentLength: String(post.content || '').length,
}));

console.log(JSON.stringify({ upserted: rows.map((row) => row.id), restored }, null, 2));
