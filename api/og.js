// Vercel serverless: /product/:slug -> index.html with product-specific title, description,
// canonical, Open Graph, Twitter Card and Product JSON-LD in the server response.
// Crawlers (Facebook, WhatsApp, Googlebot) therefore see correct tags without running JavaScript.
const fs = require('fs');
const path = require('path');
const Z = require('./_zypo.js');

function setAttr(html, id, attr, value) {
  const re = new RegExp('(<[^>]*\\bid="' + id + '"[^>]*\\b' + attr + '=")[^"]*(")');
  return html.replace(re, (m, a, b) => a + Z.esc(value) + b);
}

module.exports = async function handler(req, res) {
  let html;
  try {
    html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  } catch (e) {
    res.statusCode = 500;
    res.end('index.html not found');
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  let status = 200;
  let cache = 'public, s-maxage=300, stale-while-revalidate=600';
  try {
    const slug = Z.slugify(String((req.query && req.query.slug) || '').split('/')[0]);
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'zypo-bd.vercel.app';
    const found = Z.buildSlugs((await Z.fetchProducts(host)).filter(Z.isPublic)).find((x) => x.slug === slug);
    if (!found) {
      // Product really does not exist: tell crawlers (404 + noindex); the page itself still shows "not found".
      status = 404;
      html = html.replace('</head>', '<meta name="robots" content="noindex"></head>');
    } else {
      const p = found.p;
      const name = String(p.name || 'Zypo Product');
      const title = name + ' | Zypo';
      const desc = (String(p.description || '').replace(/\s+/g, ' ').trim().slice(0, 155)) || (name + ' - Zypo Bangladesh');
      const url = Z.SITE + '/product/' + slug;
      const out = Z.stockState(p) === 'out';
      const imgs = Z.images(p);
      // Same rule as the site: out-of-stock products never expose their image or price publicly.
      const ogImg = (!out && imgs[0]) || (Z.SITE + '/logo.png');

      html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + Z.esc(title) + '</title>');
      html = setAttr(html, 'meta-desc', 'content', desc);
      html = setAttr(html, 'canon', 'href', url);
      html = setAttr(html, 'og-title', 'content', title);
      html = setAttr(html, 'og-desc', 'content', desc);
      html = setAttr(html, 'og-url', 'content', url);
      html = setAttr(html, 'og-img', 'content', ogImg);
      html = setAttr(html, 'og-type', 'content', 'product');
      html = setAttr(html, 'tw-title', 'content', title);
      html = setAttr(html, 'tw-desc', 'content', desc);
      html = setAttr(html, 'tw-img', 'content', ogImg);

      // Product JSON-LD: only with a confirmed public selling price, never for out-of-stock
      // (the site hides prices for those). Brand is omitted because it is not verified.
      const price = Z.sellingPrice(p, Z.readOverrides(html));
      if (!out && price > 0) {
        const ld = {
          '@context': 'https://schema.org', '@type': 'Product', name, description: desc, url,
          offers: { '@type': 'Offer', price: String(price), priceCurrency: 'BDT', url }
        };
        if (imgs.length) ld.image = imgs;
        if (p.sku || p.id != null) ld.sku = String(p.sku || p.id);
        if (Z.stockState(p) === 'in') ld.offers.availability = 'https://schema.org/InStock';
        const json = JSON.stringify(ld).replace(/</g, '\\u003c');
        html = html.replace('</head>', '<script type="application/ld+json" id="ld-json">' + json + '</script></head>');
      }
    }
  } catch (e) {
    // API hiccup: serve the normal page (browser code still sets meta) and do not cache the fallback.
    cache = 'no-store';
  }
  res.setHeader('Cache-Control', cache);
  res.statusCode = status;
  res.end(html);
};
