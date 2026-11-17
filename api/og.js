// Vercel serverless: /product/:slug  ->  index.html with product-specific OG / Twitter meta.
// Facebook / WhatsApp crawlers do not run JavaScript, so the tags must be in the HTML we return.
const fs = require('fs');
const path = require('path');

const SITE = 'https://zypo-bd.vercel.app';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// same rules as the browser code, so slugs match
function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function pkey(p) { return String(p.id != null ? p.id : (p.slug || p.name || '')); }
function getList(d) {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== 'object') return [];
  const l = d.products || d.items || d.data || (d.data && (d.data.products || d.data.items));
  if (Array.isArray(l)) return l;
  for (const k in d) { if (Array.isArray(d[k]) && d[k].length && typeof d[k][0] === 'object') return d[k]; }
  return [];
}
function findBySlug(list, want) {
  const used = {};
  for (const p of list) {
    const b = slugify(p.slug) || slugify(p.name) || ('product-' + slugify(pkey(p)));
    let s = b;
    if (used[s]) s = b + '-' + (slugify(pkey(p)) || 'x');
    let n = 2;
    while (used[s]) s = b + '-' + (n++);
    used[s] = 1;
    if (s === want) return p;
  }
  return null;
}
function setAttr(html, id, attr, value) {
  const re = new RegExp('(<[^>]*\\bid="' + id + '"[^>]*\\b' + attr + '=")[^"]*(")');
  return html.replace(re, (m, a, b) => a + esc(value) + b);
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
  try {
    const slug = slugify(String((req.query && req.query.slug) || '').split('/')[0]);
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'zypo-bd.vercel.app';
    const r = await fetch('https://' + host + '/api/products', { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('products ' + r.status);
    const p = findBySlug(getList(await r.json()), slug);
    if (p) {
      const name = String(p.name || 'Zypo Product');
      const title = name + ' | Zypo';
      const desc = (String(p.description || '').replace(/\s+/g, ' ').trim().slice(0, 155)) || (name + ' - Zypo Bangladesh');
      const img = (p.image || (Array.isArray(p.images) && p.images[0]) || SITE + '/logo.png');
      const url = SITE + '/product/' + slug;
      html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>');
      html = setAttr(html, 'meta-desc', 'content', desc);
      html = setAttr(html, 'canon', 'href', url);
      html = setAttr(html, 'og-title', 'content', title);
      html = setAttr(html, 'og-desc', 'content', desc);
      html = setAttr(html, 'og-url', 'content', url);
      html = setAttr(html, 'og-img', 'content', img);
      html = setAttr(html, 'og-type', 'content', 'product');
      html = setAttr(html, 'tw-title', 'content', title);
      html = setAttr(html, 'tw-desc', 'content', desc);
      html = setAttr(html, 'tw-img', 'content', img);
    }
  } catch (e) { /* fall back to the normal page; the browser code still sets meta */ }
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.statusCode = 200;
  res.end(html);
};
