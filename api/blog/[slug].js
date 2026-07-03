const fs = require('fs');
const path = require('path');

const SITE_ORIGIN = 'https://verse.atanda.site';
const SUPABASE_URL = 'https://lrgpegfrewlqdqlunrml.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZ3BlZ2ZyZXdscWRxbHVucm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjgzMDIsImV4cCI6MjA4OTYwNDMwMn0.JyBdLFV7ko8aEYvlZ7a05xn6XMNsYY0COqMmGOm3RR0';

function attr(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function absoluteUrl(value) {
  const clean = String(value || '').trim();
  if (!clean) return `${SITE_ORIGIN}/images/headers.png`;
  if (/^https?:\/\//i.test(clean)) return clean;
  return `${SITE_ORIGIN}/${clean.replace(/^\/+/, '')}`;
}

function descriptionFor(post) {
  const base = post.excerpt || post.subtitle || stripHtml(post.content) || post.title || 'Read Atanda Verse clarity insights.';
  return base.length > 160 ? `${base.slice(0, 157).trimEnd()}...` : base;
}

async function fetchPost(slug) {
  const url = `${SUPABASE_URL}/rest/v1/posts?select=id,title,subtitle,excerpt,category,date,read_time,image,emoji,status,content&id=eq.${encodeURIComponent(slug)}&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function injectMeta(html, post, slug) {
  const canonical = `${SITE_ORIGIN}/blog/${encodeURIComponent(slug)}`;
  const title = post && post.title ? `${post.title} | Atanda Verse` : 'Atanda Verse Article - Clarity Insights';
  const desc = post ? descriptionFor(post) : 'Read Atanda Verse clarity insights on career growth, Nigerian life, purpose, relationships, and personal transformation.';
  const image = absoluteUrl(post && post.image);
  const category = post && post.category ? post.category : 'Clarity';
  const date = post && post.date ? post.date : new Date().toISOString();

  return html
    .replace(/<title id="pageTitle">[\s\S]*?<\/title>/, `<title id="pageTitle">${attr(title)}</title>`)
    .replace(/(<meta name="description" id="metaDesc" content=")[^"]*(")/, `$1${attr(desc)}$2`)
    .replace(/(<link rel="canonical" id="canonical" href=")[^"]*(")/, `$1${attr(canonical)}$2`)
    .replace(/(<meta property="og:title" id="ogTitle" content=")[^"]*(")/, `$1${attr(post && post.title ? post.title : 'Atanda Verse Article')}$2`)
    .replace(/(<meta property="og:description" id="ogDesc" content=")[^"]*(")/, `$1${attr(desc)}$2`)
    .replace(/(<meta property="og:image" id="ogImg" content=")[^"]*(")/, `$1${attr(image)}$2`)
    .replace(/(<meta property="og:url" id="ogUrl" content=")[^"]*(")/, `$1${attr(canonical)}$2`)
    .replace(/(<meta property="article:published_time" id="articlePublishedTime" content=")[^"]*(")/, `$1${attr(date)}$2`)
    .replace(/(<meta property="article:section" id="articleSection" content=")[^"]*(")/, `$1${attr(category)}$2`)
    .replace(/(<meta name="twitter:title" id="twTitle" content=")[^"]*(")/, `$1${attr(post && post.title ? post.title : 'Atanda Verse Article')}$2`)
    .replace(/(<meta name="twitter:description" id="twDesc" content=")[^"]*(")/, `$1${attr(desc)}$2`)
    .replace(/(<meta name="twitter:image" id="twImg" content=")[^"]*(")/, `$1${attr(image)}$2`)
    .replace('</head>', `<meta property="og:image:secure_url" content="${attr(image)}"><meta property="og:image:alt" content="${attr(post && post.title ? post.title : 'Atanda Verse article image')}"><meta name="twitter:url" content="${attr(canonical)}"></head>`);
}

module.exports = async function handler(req, res) {
  const rawSlug = Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug;
  const slug = String(rawSlug || '').trim();
  const htmlPath = path.join(process.cwd(), 'post.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  let post = null;
  if (slug) {
    try {
      post = await fetchPost(slug);
    } catch (_err) {
      post = null;
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(injectMeta(html, post, slug));
};
