// Client account helpers. No network calls here, so the status rules can be tested alone.

export const PROMO_CODE = 'PACZKA-5';
export const PROMO_SEEN_KEY = 'kombi-shop-promo-paczka-5';
export const AUTH_STORAGE_KEY = 'kombi-shop-auth';

const CLAIM_TEXT = {
  ok: 'Numer dopisany. Oto Twoje zamówienia.',
  nomatch: 'Nie znaleźliśmy zamówienia z tym telefonem i numerem.',
  limit: 'Za dużo prób. Spróbuj za godzinę.',
  input: 'Podaj telefon (9 cyfr) i numer zamówienia.',
  login: 'Zaloguj się jeszcze raz.',
};

export function claimCode(data) {
  let code = data;
  if (code && typeof code === 'object') {
    if ('shop_claim_orders' in code) code = code.shop_claim_orders;
    else {
      const values = Object.values(code);
      code = values.length === 1 ? values[0] : '';
    }
  }
  return String(code ?? '').trim();
}

export function claimMessage(code) {
  return CLAIM_TEXT[claimCode(code)] || 'Nie udało się sprawdzić. Spróbuj jeszcze raz.';
}

export function emailOk(value) {
  const email = String(value || '').trim();
  return email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function fold(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replaceAll('ą', 'a')
    .replaceAll('ć', 'c')
    .replaceAll('ę', 'e')
    .replaceAll('ł', 'l')
    .replaceAll('ń', 'n')
    .replaceAll('ó', 'o')
    .replaceAll('ś', 's')
    .replaceAll('ź', 'z')
    .replaceAll('ż', 'z');
}

function hasWord(text, words) {
  return words.some((word) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(text));
}

function delivered(text) {
  return hasWord(text, ['doreczona', 'doreczone', 'dostarczona', 'dostarczone', 'delivered']);
}

function shipped(text) {
  return hasWord(text, ['wyslana', 'wyslane', 'sent', 'shipped']) || /w drodze|in transit/.test(text);
}

function packing(text) {
  return hasWord(text, ['pakujemy', 'pakowanie', 'packed', 'spakowane', 'spakowany']);
}

// Client-facing label. DPD delivery wins over the shop or Selmo status.
export function clientStatus(status, dpdState) {
  const dpd = fold(dpdState);
  const raw = fold(status);
  if (dpd && delivered(dpd)) return 'Doręczona';
  if (delivered(raw)) return 'Doręczona';
  if (dpd && shipped(dpd)) return 'Wysłana';
  if (shipped(raw)) return 'Wysłana';
  if (packing(raw) || packing(dpd)) return 'Pakujemy';
  if (hasWord(raw, ['anulowane', 'anulowana', 'anulowany', 'cancelled', 'canceled'])) return 'Anulowane';
  return 'Przyjęte';
}

export function safeWaybill(value) {
  const raw = String(value || '').trim();
  return /^[A-Za-z0-9]{6,32}$/.test(raw) ? raw : '';
}

export function trackUrl(waybill) {
  const value = safeWaybill(waybill);
  if (!value) return '';
  return `https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=${encodeURIComponent(value)}`;
}

export function shopAmount(order) {
  const products = Number(order?.products_total);
  const delivery = Number(order?.delivery_fee);
  const sum = (Number.isFinite(products) ? products : 0) + (Number.isFinite(delivery) ? delivery : 0);
  return sum;
}

function lineQty(item) {
  const qty = Number(item?.qty ?? item?.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

export function shopLine(item) {
  const name = String(item?.title || item?.name || 'Pozycja');
  const bits = [name];
  if (item?.size) bits.push(String(item.size));
  if (item?.color) bits.push(String(item.color));
  const text = bits.join(' · ');
  const qty = lineQty(item);
  return qty ? `${text} × ${qty}` : text;
}

export function extLine(item) {
  const name = String(item?.name || 'Pozycja');
  const qty = lineQty(item);
  return qty ? `${name} × ${qty}` : name;
}

export function mergeAccountOrders(shopOrders, shopItems, extOrders) {
  const itemsByOrder = new Map();
  for (const item of Array.isArray(shopItems) ? shopItems : []) {
    const id = item?.order_id;
    if (!id) continue;
    if (!itemsByOrder.has(id)) itemsByOrder.set(id, []);
    itemsByOrder.get(id).push(shopLine(item));
  }
  const shop = (Array.isArray(shopOrders) ? shopOrders : []).map((order) => ({
    order_no: String(order?.order_no || ''),
    created_at: String(order?.created_at || ''),
    amount: shopAmount(order),
    status: clientStatus(order?.status, ''),
    track: '',
    lines: itemsByOrder.get(order?.id) || [],
  }));
  const ext = (Array.isArray(extOrders) ? extOrders : []).map((order) => ({
    order_no: String(order?.order_no || ''),
    created_at: String(order?.created_at || ''),
    amount: Number(order?.products_total) || 0,
    status: clientStatus(order?.status, order?.dpd_state),
    track: trackUrl(order?.dpd_waybill),
    lines: (Array.isArray(order?.items) ? order.items : []).map(extLine),
  }));
  return [...shop, ...ext].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function promoProduct(products) {
  const list = Array.isArray(products) ? products : [];
  return list.find((item) => String(item?.code || '') === PROMO_CODE && item?.active !== false) || null;
}

export function shouldShowPromo(routeName, products, seen) {
  if (seen) return false;
  if (routeName !== 'catalog' && routeName !== 'account') return false;
  return !!promoProduct(products);
}
