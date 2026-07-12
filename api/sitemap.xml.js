const SITE_ORIGIN = 'https://verse.atanda.site';
const SUPABASE_URL = 'https://lrgpegfrewlqdqlunrml.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZ3BlZ2ZyZXdscWRxbHVucm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjgzMDIsImV4cCI6MjA4OTYwNDMwMn0.JyBdLFV7ko8aEYvlZ7a05xn6XMNsYY0COqMmGOm3RR0';

const LEGACY_POST_ALIASES = {
  ep1: 'school-na-scam-ep1',
  ep2: 'school-na-scam-ep2',
  ep3: 'school-na-scam-ep3',
  ep4: 'school-na-scam-ep4'
};

const CORE_URLS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0', image: '/images/headers.png', imageTitle: 'Atanda Verse clarity sessions and resources' },
  { loc: '/sessions', changefreq: 'weekly', priority: '0.95' },
  { loc: '/register', changefreq: 'weekly', priority: '0.9' },
  { loc: '/blog', changefreq: 'daily', priority: '0.9', image: '/images/headers.png', imageTitle: 'Atanda Verse Blog' },
  { loc: '/library', changefreq: 'weekly', priority: '0.85' },
  { loc: '/about', changefreq: 'monthly', priority: '0.8' },
  { loc: '/events', changefreq: 'weekly', priority: '0.88', image: '/social-preview.png', imageTitle: 'Atanda Verse events and campaigns' },
  { loc: '/pause001', changefreq: 'weekly', priority: '0.9', image: '/images/pause001-hero.png', imageTitle: 'PAUSE001 Atanda Verse Live' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.75' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.5' },
  { loc: '/legal', changefreq: 'yearly', priority: '0.5' }
];

const FALLBACK_POSTS = [
  { id: 'school-na-scam-ep1', title: 'Beyond School Na Scam Episode 1', date: '2025-10-01', image: '/images/headers.png' },
  { id: 'school-na-scam-ep2', title: 'Beyond School Na Scam Episode 2', date: '2025-10-07', image: '/images/headers2.png' },
  { id: 'school-na-scam-ep3', title: 'Beyond School Na Scam Episode 3', date: '2025-10-15', image: '/images/headers3.png' },
  { id: 'school-na-scam-ep4', title: 'Beyond School Na Scam Episode 4', date: '2025-10-22', image: '/images/headers4.png' }
];

function xml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteUrl(value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return clean;
  return `${SITE_ORIGIN}/${clean.replace(/^\/+/, '')}`;
}

function canonicalPostId(id) {
  return LEGACY_POST_ALIASES[id] || id;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function renderUrl(item) {
  const loc = absoluteUrl(item.loc);
  const image = absoluteUrl(item.image);
  return [
    '  <url>',
    `    <loc>${xml(loc)}</loc>`,
    `    <lastmod>${xml(item.lastmod || today())}</lastmod>`,
    `    <changefreq>${xml(item.changefreq || 'monthly')}</changefreq>`,
    `    <priority>${xml(item.priority || '0.7')}</priority>`,
    image ? '    <image:image>' : '',
    image ? `      <image:loc>${xml(image)}</image:loc>` : '',
    image && item.imageTitle ? `      <image:title>${xml(item.imageTitle)}</image:title>` : '',
    image ? '    </image:image>' : '',
    '  </url>'
  ].filter(Boolean).join('\n');
}

async function fetchPublishedPosts() {
  const url = `${SUPABASE_URL}/rest/v1/posts?select=id,title,date,image,status&status=eq.published&order=date.desc,id.asc`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!response.ok) return [];
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

module.exports = async function handler(_req, res) {
  let posts = [];
  try {
    posts = await fetchPublishedPosts();
  } catch (_err) {
    posts = [];
  }

  if (!posts.length) posts = FALLBACK_POSTS;

  const seen = new Set();
  const postUrls = posts
    .map((post) => ({
      loc: `/blog/${encodeURIComponent(canonicalPostId(post.id))}`,
      lastmod: post.date || today(),
      changefreq: 'monthly',
      priority: '0.8',
      image: post.image || '/images/headers.png',
      imageTitle: post.title || 'Atanda Verse article'
    }))
    .filter((item) => {
      if (seen.has(item.loc)) return false;
      seen.add(item.loc);
      return true;
    });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    CORE_URLS.map(renderUrl).join('\n'),
    postUrls.map(renderUrl).join('\n'),
    '</urlset>'
  ].filter(Boolean).join('\n');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=86400');
  res.status(200).send(body);
};
