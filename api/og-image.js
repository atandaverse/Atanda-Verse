const SITE_ORIGIN = 'https://verse.atanda.site';
const FALLBACK_IMAGE = `${SITE_ORIGIN}/social-preview.png`;

function safeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return FALLBACK_IMAGE;
  try {
    const url = new URL(raw, SITE_ORIGIN);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return FALLBACK_IMAGE;
    return url.href;
  } catch (_err) {
    return FALLBACK_IMAGE;
  }
}

module.exports = async function handler(req, res) {
  const src = safeImageUrl(req.query && req.query.src);
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
    const contentType = response.headers.get('content-type') || 'image/png';
    if (!/^image\//i.test(contentType)) throw new Error('Not an image');
    const body = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
    res.status(200).send(body);
  } catch (_err) {
    res.writeHead(302, { Location: FALLBACK_IMAGE, 'Cache-Control': 'public, max-age=3600' });
    res.end();
  }
};
