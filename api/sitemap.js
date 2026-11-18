// Vercel serverless: /sitemap.xml  (rewritten to /api/sitemap in vercel.json)
// Homepage + every public product page, built from the live Business Koro product data.
const Z = require('./_zypo.js');

function lastmod(p) {
  const raw = p.updatedAt || p.updated_at || p.modifiedAt; // only a real "updated" date; createdAt is not a modification date
  if (!raw) return '';
  const d = new Date(raw);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'zypo-bd.vercel.app';
    const items = Z.buildSlugs((await Z.fetchProducts(host)).filter(Z.isPublic));
    const seen = {};
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += '  <url><loc>' + Z.SITE + '/</loc></url>\n';
    for (const it of items) {
      const loc = Z.SITE + '/product/' + it.slug;
      if (seen[loc]) continue;
      seen[loc] = 1;
      const lm = lastmod(it.p);
      xml += '  <url><loc>' + Z.esc(loc) + '</loc>' + (lm ? '<lastmod>' + lm + '</lastmod>' : '') + '</url>\n';
    }
    xml += '</urlset>\n';
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.statusCode = 200;
    res.end(xml);
  } catch (e) {
    // Never serve a half-empty sitemap: tell crawlers to retry later.
    res.setHeader('Retry-After', '3600');
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 503;
    res.end('Sitemap temporarily unavailable');
  }
};
