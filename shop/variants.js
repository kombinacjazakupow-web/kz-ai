import { splitList } from '#common';

export const COLOR_GONE = 'Ten kolor właśnie się skończył – wybierz inny';
export const COLOR_SOLD = 'Ktoś był szybszy – ten kolor jest już wyprzedany';

export function cleanVariants(rows) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const productId = String(row?.product_id || '');
    const color = String(row?.color || '').trim();
    const stock = Number(row?.stock);
    if (!productId || !color || !Number.isFinite(stock)) continue;
    const seconds = Number(row?.video_seconds);
    out.push({
      product_id: productId,
      color,
      stock: Math.max(0, Math.floor(stock)),
      video_seconds: Number.isFinite(seconds) && seconds >= 0 ? seconds : null,
      ai_photo: safePhoto(row?.ai_photo),
    });
  }
  return out;
}

function safePhoto(value) {
  const raw = String(value || '').trim().replace(/^\/+/, '');
  if (!raw || /[\\:?#]/.test(raw) || raw.includes('://')) return '';
  if (raw.split('/').some((part) => !part || part === '.' || part === '..')) return '';
  return raw;
}

export function modelPhoto(product, color, variants, hold = '') {
  const mine = (Array.isArray(variants) ? variants : []).filter((row) => row.product_id === product?.id && row.ai_photo);
  if (!mine.length) return { photo: '', hold: '' };
  const want = String(color || '').trim().toLocaleLowerCase('pl');
  if (want) {
    const hit = mine.find((row) => row.color.toLocaleLowerCase('pl') === want);
    if (hit) return { photo: hit.ai_photo, hold: hit.ai_photo };
    const kept = safePhoto(hold);
    return { photo: kept, hold: kept };
  }
  return { photo: mine[0].ai_photo, hold: mine[0].ai_photo };
}

export function colorMoment(product, color, variants) {
  const want = String(color || '').trim().toLocaleLowerCase('pl');
  if (!want) return null;
  const hit = (Array.isArray(variants) ? variants : []).find((row) => row.product_id === product?.id && row.color.toLocaleLowerCase('pl') === want);
  if (hit?.video_seconds == null || hit.video_seconds === '') return null;
  const seconds = Number(hit.video_seconds);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function momentText(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) return '';
  const whole = Math.floor(n);
  const tenth = Math.min(9, Math.floor((n - whole) * 10));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')},${tenth}`;
}

export function colorViews(product, variants) {
  const names = splitList(product?.colors);
  const mine = (Array.isArray(variants) ? variants : []).filter((row) => row.product_id === product?.id);
  const known = mine.length > 0;
  const stockOf = (name) => {
    const key = name.toLocaleLowerCase('pl');
    const hit = mine.find((row) => row.color.toLocaleLowerCase('pl') === key);
    if (hit) return hit.stock;
    return known ? 0 : null;
  };
  const base = names.length ? names : mine.map((row) => row.color);
  const seen = new Set();
  const out = [];
  for (const name of base) {
    const key = name.toLocaleLowerCase('pl');
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, stock: stockOf(name) });
  }
  return out;
}

export function isSoldOut(product, variants) {
  const views = colorViews(product, variants);
  if (views.length && views.every((view) => view.stock != null)) {
    return views.every((view) => view.stock <= 0);
  }
  const stock = Number(product?.stock);
  return Number.isFinite(stock) && stock <= 0;
}

export function stockPhrase(stock) {
  if (stock == null || stock === '') return '';
  const n = Number(stock);
  if (!Number.isFinite(n) || n < 0) return '';
  const whole = Math.floor(n);
  return whole > 20 ? 'dużo sztuk' : String(whole);
}

export function liveStockText(product, variants) {
  const views = colorViews(product, variants);
  if (views.length && views.every((view) => view.stock != null)) {
    const total = views.reduce((sum, view) => sum + view.stock, 0);
    const parts = views.map((view) => `${view.name}: ${stockPhrase(view.stock)}`);
    return `Zostało: ${stockPhrase(total)}. ${parts.join('. ')}.`;
  }
  const phrase = stockPhrase(product?.stock);
  return phrase ? `Zostało: ${phrase}.` : '';
}

export function freshBadge(product, variants) {
  if (isSoldOut(product, variants)) return 'WYPRZEDANE';
  const views = colorViews(product, variants);
  if (!views.length || views.some((view) => view.stock == null)) return '';
  const pieces = views.reduce((sum, view) => sum + Math.max(0, Number(view.stock) || 0), 0);
  if (pieces > 0 && pieces <= 2) return 'ostatnie sztuki';
  return '';
}

export function orderCatalog(products, variants) {
  const open = [];
  const sold = [];
  for (const product of Array.isArray(products) ? products : []) {
    if (isSoldOut(product, variants)) sold.push(product);
    else open.push(product);
  }
  return [...open, ...sold];
}

export function colorBasket(lines, productId, color) {
  let same = 0;
  let other = 0;
  const id = String(productId || '');
  const want = String(color || '');
  for (const line of lines || []) {
    if (String(line?.product_id || '') !== id) continue;
    const qty = Math.round(Number(line?.qty)) || 0;
    if (String(line?.color || '') === want) same += qty;
    else other += qty;
  }
  return { same, other };
}

export function roomForColor(stock, sameQty) {
  if (stock == null || !Number.isFinite(Number(stock))) return 99;
  return Math.max(0, Math.min(99, Math.floor(Number(stock))) - (Math.round(Number(sameQty)) || 0));
}

export function lineStock(stock, otherQty) {
  if (stock == null || !Number.isFinite(Number(stock))) return undefined;
  return Math.floor(Number(stock)) + (Math.round(Number(otherQty)) || 0);
}

export function colorsShareStock(product, variants) {
  if (!splitList(product?.colors).length) return false;
  const id = String(product?.id || '');
  return !(Array.isArray(variants) ? variants : []).some((row) => String(row?.product_id || '') === id);
}

export function stockForColor(product, variants, color) {
  const views = colorViews(product, variants);
  const hit = views.find((view) => view.name === String(color || ''));
  if (hit && hit.stock != null) return hit.stock;
  const stock = Number(product?.stock);
  return Number.isFinite(stock) ? stock : null;
}

export function variantError(code) {
  const raw = String(code || '').trim();
  if (raw.startsWith('color:')) return COLOR_GONE;
  if (raw.startsWith('out_of_stock:')) return COLOR_SOLD;
  return '';
}
