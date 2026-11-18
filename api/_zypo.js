// Shared helpers for api/og.js and api/sitemap.js.
// The leading underscore keeps Vercel from exposing this file as its own endpoint.
const SITE = 'https://zypo-bd.vercel.app';

function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function pkey(p) { return String(p.id != null ? p.id : (p.slug || p.name || '')); }

// Same list-detection rule as the browser code (index.html getList)
function getList(d) {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== 'object') return [];
  const l = d.products || d.items || d.data || (d.data && (d.data.products || d.data.items));
  if (Array.isArray(l)) return l;
  for (const k in d) { if (Array.isArray(d[k]) && d[k].length && typeof d[k][0] === 'object') return d[k]; }
  return [];
}

// Same slug rule as the browser code (index.html buildSlugs) so URLs always match
function buildSlugs(list) {
  const used = {}, out = [];
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const b = slugify(p.slug) || slugify(p.name) || ('product-' + slugify(pkey(p)));
    let s = b;
    if (used[s]) s = b + '-' + (slugify(pkey(p)) || 'x');
    let n = 2;
    while (used[s]) s = b + '-' + (n++);
    used[s] = 1;
    out.push({ slug: s, p });
  }
  return out;
}

// Only drop products the API explicitly marks as deleted/inactive. Out of stock stays.
function isPublic(p) {
  if (p.deleted === true || p.isDeleted === true) return false;
  if (p.isActive === false || p.active === false) return false;
  return true;
}

async function fetchProducts(host) {
  const r = await fetch('https://' + host + '/api/products', { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('products ' + r.status);
  return getList(await r.json());
}

// Price overrides live in index.html (CUSTOM_*_PRICES). Read them so server prices == page prices.
function readOverrides(html) {
  const get = (name) => {
    const m = html.match(new RegExp('var\\s+' + name + '\\s*=\\s*(\\{[^;]*?\\})\\s*;'));
    if (!m) return {};
    try { return new Function('return (' + m[1] + ')')() || {}; } catch (e) { return {}; }
  };
  return { sell: get('CUSTOM_SELLING_PRICES'), offer: get('CUSTOM_OFFER_PRICES') };
}
function ovr(map, p) { return (p.id != null && map[p.id]) || (p.slug && map[p.slug]) || 0; }

// Mirrors getPriceInfo in index.html: the price the visitor sees on the page.
function sellingPrice(p, ov) {
  const sell = Number(ovr(ov.sell, p) || p.sellingPrice || p.suggestedPrice || p.price || p.minimumSellingPrice || 0) || 0;
  const offer = Number(ovr(ov.offer, p) || 0) || 0;
  return (offer > 0 && (sell <= 0 || offer < sell)) ? offer : sell;
}

// Mirrors stockState in index.html (no colour/size selection): 'out' | 'in' | 'unknown'
function stockState(p) {
  const hasSI = (o) => typeof o.inStock === 'boolean' || typeof o.stockQuantity === 'number';
  const vOk = (v) => !(v.inStock === false || (typeof v.stockQuantity === 'number' && v.stockQuantity <= 0));
  if (p.inStock === false) return 'out';
  if (typeof p.stockQuantity === 'number' && p.stockQuantity <= 0) return 'out';
  const vs = Array.isArray(p.variants) ? p.variants : [];
  if (vs.length && vs.some(hasSI) && !vs.some(vOk)) return 'out';
  if (hasSI(p) || vs.some(hasSI)) return 'in';
  return 'unknown';
}

function images(p) {
  const a = [];
  if (p.image) a.push(p.image);
  if (Array.isArray(p.images)) p.images.forEach((u) => { if (u && a.indexOf(u) === -1) a.push(u); });
  return a.filter((u) => /^https?:\/\//i.test(String(u)));
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = { SITE, slugify, pkey, getList, buildSlugs, isPublic, fetchProducts, readOverrides, sellingPrice, stockState, images, esc };
