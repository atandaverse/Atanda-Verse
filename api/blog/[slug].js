const fs = require('fs');
const path = require('path');

const SITE_ORIGIN = 'https://verse.atanda.site';
const SUPABASE_URL = 'https://lrgpegfrewlqdqlunrml.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZ3BlZ2ZyZXdscWRxbHVucm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjgzMDIsImV4cCI6MjA4OTYwNDMwMn0.JyBdLFV7ko8aEYvlZ7a05xn6XMNsYY0COqMmGOm3RR0';
const LEGACY_POST_ALIASES = {
  ep1: 'school-na-scam-ep1',
  ep2: 'school-na-scam-ep2',
  ep3: 'school-na-scam-ep3',
  ep4: 'school-na-scam-ep4'
};
const BRANDED_POST_ALIASES = Object.keys(LEGACY_POST_ALIASES).reduce((map, legacy) => {
  map[LEGACY_POST_ALIASES[legacy]] = legacy;
  return map;
}, {});
const FALLBACK_POSTS = {
  ep1: {
    id: 'ep1',
    title: 'Beyond "School Na Scam" Episode 1',
    subtitle: 'The New Reality of Education in Nigeria',
    excerpt: 'The new reality of education in Nigeria. We are decoding the new rules of the game and revealing the strategy that actually works.',
    category: 'Education & Career',
    date: '2025-10-01',
    read_time: '5 min read',
    image: 'images/headers.png',
    status: 'published'
  },
  ep2: {
    id: 'ep2',
    title: 'Beyond "School Na Scam" Episode 2',
    subtitle: 'The Digital Skills That Actually Pay in Nigeria',
    excerpt: 'We are diving deep into digital skills that are transforming Nigerian careers.',
    category: 'Education & Career',
    date: '2025-10-07',
    read_time: '8 min read',
    image: 'images/headers2.png',
    status: 'published'
  },
  ep3: {
    id: 'ep3',
    title: 'Beyond "School Na Scam" Episode 3: The Business Skills That Pay in Nigeria',
    subtitle: 'The Business Skills That Pay in Nigeria',
    excerpt: 'We are exploring business skills that work regardless of your technical ability.',
    category: 'Business Skills & Entrepreneurship',
    date: '2025-10-15',
    read_time: '7 min read',
    image: 'images/headers3.png',
    status: 'published'
  },
  ep4: {
    id: 'ep4',
    title: 'Beyond "School Na Scam" Episode 4: The Network Effect',
    subtitle: 'Why Your Classmates May Matter More Than Grades',
    excerpt: 'The Network component is often the most underestimated but powerful element of career success.',
    category: 'Networking & Career Strategy',
    date: '2025-10-22',
    read_time: '8 min read',
    image: 'images/headers4.png',
    status: 'published'
  }
};

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

function keywordsFor(post) {
  return [
    post && post.title,
    post && post.category,
    'Atanda Verse',
    'clarity insights',
    'Nigerian career growth',
    'personal development Nigeria'
  ].filter(Boolean).join(', ');
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

async function resolvePost(slug) {
  let post = await fetchPost(slug);
  if (post) return { post, canonicalSlug: LEGACY_POST_ALIASES[slug] || slug };
  const legacySlug = BRANDED_POST_ALIASES[slug];
  if (legacySlug) {
    post = await fetchPost(legacySlug);
    if (post) return { post, canonicalSlug: slug };
    if (FALLBACK_POSTS[legacySlug]) return { post: FALLBACK_POSTS[legacySlug], canonicalSlug: slug };
  }
  if (FALLBACK_POSTS[slug]) return { post: FALLBACK_POSTS[slug], canonicalSlug: LEGACY_POST_ALIASES[slug] || slug };
  return { post: null, canonicalSlug: LEGACY_POST_ALIASES[slug] || slug };
}

function injectMeta(html, post, slug, options) {
  const opts = options || {};
  const canonicalSlug = opts.canonicalSlug || slug;
  const canonical = `${SITE_ORIGIN}/blog/${encodeURIComponent(canonicalSlug)}`;
  const title = post && post.title ? `${post.title} | Atanda Verse` : 'Atanda Verse Article - Clarity Insights';
  const desc = post ? descriptionFor(post) : 'Read Atanda Verse clarity insights on career growth, Nigerian life, purpose, relationships, and personal transformation.';
  const image = absoluteUrl(post && post.image);
  const category = post && post.category ? post.category : 'Clarity';
  const date = post && post.date ? post.date : new Date().toISOString();
  const keywords = post ? keywordsFor(post) : 'Atanda Verse article, clarity insights, Nigerian career growth, personal transformation blog';
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post && post.title ? post.title : 'Atanda Verse Article',
    description: desc,
    image: [image],
    datePublished: date,
    dateModified: date,
    articleSection: category,
    keywords,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    author: { '@type': 'Organization', name: 'Atanda Verse' },
    publisher: {
      '@type': 'Organization',
      name: 'Atanda Verse',
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/logo%20I.png` }
    }
  };

  return html
    .replace(/<title id="pageTitle">[\s\S]*?<\/title>/, `<title id="pageTitle">${attr(title)}</title>`)
    .replace(/(<meta name="description" id="metaDesc" content=")[^"]*(")/, `$1${attr(desc)}$2`)
    .replace(/(<meta name="keywords" id="metaKeywords" content=")[^"]*(")/, `$1${attr(keywords)}$2`)
    .replace(/(<meta name="robots" content=")[^"]*(")/, `$1${opts.noindex ? 'noindex, follow, max-image-preview:large' : 'index, follow, max-image-preview:large'}$2`)
    .replace(/(<link rel="canonical" id="canonical" href=")[^"]*(")/, `$1${attr(canonical)}$2`)
    .replace(/(<link rel="alternate" hreflang="en-ng" href=")[^"]*(")/, `$1${attr(canonical)}$2`)
    .replace(/(<link rel="alternate" hreflang="x-default" href=")[^"]*(")/, `$1${attr(canonical)}$2`)
    .replace(/(<meta property="og:title" id="ogTitle" content=")[^"]*(")/, `$1${attr(post && post.title ? post.title : 'Atanda Verse Article')}$2`)
    .replace(/(<meta property="og:description" id="ogDesc" content=")[^"]*(")/, `$1${attr(desc)}$2`)
    .replace(/(<meta property="og:image" id="ogImg" content=")[^"]*(")/, `$1${attr(image)}$2`)
    .replace(/(<meta property="og:url" id="ogUrl" content=")[^"]*(")/, `$1${attr(canonical)}$2`)
    .replace(/(<meta property="article:published_time" id="articlePublishedTime" content=")[^"]*(")/, `$1${attr(date)}$2`)
    .replace(/(<meta property="article:section" id="articleSection" content=")[^"]*(")/, `$1${attr(category)}$2`)
    .replace(/(<meta name="twitter:title" id="twTitle" content=")[^"]*(")/, `$1${attr(post && post.title ? post.title : 'Atanda Verse Article')}$2`)
    .replace(/(<meta name="twitter:description" id="twDesc" content=")[^"]*(")/, `$1${attr(desc)}$2`)
    .replace(/(<meta name="twitter:image" id="twImg" content=")[^"]*(")/, `$1${attr(image)}$2`)
    .replace(/<script type="application\/ld\+json" id="ldJson">[\s\S]*?<\/script>/, `<script type="application/ld+json" id="ldJson">${JSON.stringify(articleLd).replace(/</g, '\\u003c')}</script>`)
    .replace('</head>', `<meta property="og:image:secure_url" content="${attr(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="628"><meta property="og:image:alt" content="${attr(post && post.title ? post.title : 'Atanda Verse article image')}"><meta name="twitter:url" content="${attr(canonical)}"></head>`);
}

module.exports = async function handler(req, res) {
  const rawSlug = Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug;
  const slug = String(rawSlug || '').trim();
  const htmlPath = path.join(process.cwd(), 'post.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  let post = null;
  let canonicalSlug = slug;
  if (slug) {
    try {
      const resolved = await resolvePost(slug);
      post = resolved.post;
      canonicalSlug = resolved.canonicalSlug;
    } catch (_err) {
      post = null;
    }
  }

  const isPublicPost = post && (!post.status || post.status === 'published');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
  res.status(isPublicPost ? 200 : 404).send(injectMeta(html, isPublicPost ? post : null, slug, { noindex: !isPublicPost, canonicalSlug }));
};
