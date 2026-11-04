// Shared shop helpers. The key is the public publishable key, same as the packing app.
export const SUPABASE_URL = 'https://ghhatjkcgilnruluhxyr.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_pIiSGwIiJJmkNsvlZyniAw_6CQ1FlpF';

export const DELIVERY_FEE = 25;
export const DELIVERY_LABEL = 'Dostawa DPD 25 zł';
export const COD_NOTE = 'Pobranie — wpłacasz teraz tylko 28 zł, resztę kurierowi.';
export const MESSENGER_LINE = 'Po wpłacie wyślij potwierdzenie na Messenger Kombinacja Zakupów';
export const BLIK_LINE = 'BLIK na telefon: 796 669 157 (Fikrie Ali)';
export const TRANSFER_LINE = 'Przelew: PL24 2910 0006 0000 0000 0571 2568 (Sergen Kushdan)';
export const BLIK_COPY = '796 669 157';
export const TRANSFER_COPY = 'PL24 2910 0006 0000 0000 0571 2568';

export const BASKET_KEY = 'kombi-shop-basket';
export const DRAFT_KEY = 'kombi-shop-draft';
export const THANKS_KEY = 'kombi-shop-thanks';

export const ORDER_STATUS = {
  new: 'Nowe',
  paid: 'Opłacone',
  packed: 'Spakowane',
  sent: 'Wysłane',
  cancelled: 'Anulowane',
};
export const STATUS_NEXT = { new: 'paid', paid: 'packed', packed: 'sent' };
export const STATUS_ACTION = {
  paid: 'Oznacz: opłacone',
  packed: 'Oznacz: spakowane',
  sent: 'Oznacz: wysłane',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function formatZl(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const formatted = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(x);
  return `${formatted} zł`;
}

export function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function photoUrl(path) {
  const raw = String(path || '').trim().replace(/^\/+/, '');
  if (!raw || /[\\:?#]/.test(raw) || raw.includes('://')) return '';
  const parts = raw.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return '';
  const encoded = parts.map((part) => encodeURIComponent(part)).join('/');
  return `${SUPABASE_URL}/storage/v1/object/public/shop-photos/${encoded}`;
}

export function splitList(text) {
  return String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function normalizeList(text) {
  return splitList(text).join(',');
}

export function normalizePhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('48') && digits.length === 11) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) digits = digits.slice(1);
  return digits;
}

export function phoneOk(raw) {
  return /^\d{9}$/.test(normalizePhone(raw));
}

export function normalizePostcode(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length !== 5) return String(raw ?? '').trim();
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function postcodeOk(raw) {
  return /^\d{2}-\d{3}$/.test(normalizePostcode(raw));
}

export function stockBadge(stock) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return '';
  if (n <= 0) return 'Wyprzedane';
  if (n <= 2) return 'Ostatnie sztuki';
  return '';
}

export function parseRoute(hash) {
  let raw = String(hash || '').replace(/^#/, '');
  if (!raw || raw === '/') return { name: 'catalog' };
  if (!raw.startsWith('/')) raw = `/${raw}`;
  const clean = raw.split('?')[0].replace(/\/+$/, '') || '/';
  if (clean === '/') return { name: 'catalog' };
  if (clean === '/koszyk') return { name: 'basket' };
  if (clean === '/zamowienie') return { name: 'checkout' };
  const match = clean.match(/^\/p\/([^/]+)$/);
  if (!match) return { name: 'catalog' };
  let code = match[1];
  try { code = decodeURIComponent(code); } catch { /* keep the raw segment */ }
  return { name: 'product', code };
}

export function lineKey(line) {
  return `${line?.product_id || ''}|${line?.size || ''}|${line?.color || ''}`;
}

export function sanitizeBasket(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const qty = Math.round(Number(row.qty));
    const id = String(row.product_id || '');
    if (!UUID_RE.test(id) || !Number.isFinite(qty) || qty < 1) continue;
    out.push({
      product_id: id,
      code: String(row.code || ''),
      title: String(row.title || 'Produkt'),
      price: Number(row.price) || 0,
      qty: Math.min(99, qty),
      size: String(row.size || ''),
      color: String(row.color || ''),
      photo: String(row.photo || ''),
    });
  }
  return out.slice(0, 40);
}

export function capFor(stock) {
  if (!Number.isFinite(stock)) return 99;
  return Math.min(99, Math.max(0, Math.floor(stock)));
}

export function upsertLine(lines, add, stock) {
  const next = (lines || []).map((line) => ({ ...line }));
  const key = lineKey(add);
  const cap = capFor(stock);
  const want = Math.round(Number(add.qty)) || 1;
  const index = next.findIndex((line) => lineKey(line) === key);
  if (index === -1) {
    const qty = Math.min(cap, want);
    if (qty < 1) return { lines: next, added: 0 };
    next.push({ ...add, qty });
    return { lines: next, added: qty };
  }
  const qty = Math.min(cap, next[index].qty + want);
  const added = Math.max(0, qty - next[index].qty);
  next[index] = { ...next[index], ...add, qty };
  return { lines: next, added };
}

export function setLineQty(lines, key, qty, stock) {
  const q = Math.round(Number(qty));
  if (!Number.isFinite(q) || q < 1) return (lines || []).filter((line) => lineKey(line) !== key);
  const cap = capFor(stock);
  if (cap < 1) return (lines || []).filter((line) => lineKey(line) !== key);
  return (lines || []).map((line) => (
    lineKey(line) === key ? { ...line, qty: Math.min(cap, q) } : line
  ));
}

export function previewTotals(lines) {
  const goods = (lines || []).reduce((sum, line) => {
    const price = Number(line?.price) || 0;
    const qty = Number(line?.qty) || 0;
    return sum + price * qty;
  }, 0);
  const rounded = Math.round(goods * 100) / 100;
  return {
    goods: rounded,
    delivery: DELIVERY_FEE,
    preview: Math.round((rounded + DELIVERY_FEE) * 100) / 100,
  };
}

export function validateCheckout(form, lines) {
  const errors = {};
  const name = String(form?.name || '').trim();
  const street = String(form?.street || '').trim();
  const city = String(form?.city || '').trim();
  const email = String(form?.email || '').trim();
  const note = String(form?.note || '').trim();
  if (name.length < 3) errors.name = 'Podaj imię i nazwisko.';
  if (!phoneOk(form?.phone)) errors.phone = 'Podaj numer telefonu — 9 cyfr.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Ten e-mail wygląda niepoprawnie.';
  if (street.length < 3) errors.street = 'Podaj ulicę i numer.';
  if (!postcodeOk(form?.postcode)) errors.postcode = 'Kod pocztowy w formacie 00-000.';
  if (city.length < 2) errors.city = 'Podaj miasto.';
  if (form?.delivery !== 'dpd_home' && form?.delivery !== 'dpd_point') errors.delivery = 'Wybierz sposób dostawy.';
  if (form?.delivery === 'dpd_point' && String(form?.point_code || '').trim().length < 3) {
    errors.point_code = 'Podaj kod punktu albo automatu DPD.';
  }
  if (!['blik', 'transfer', 'cod'].includes(form?.payment)) errors.payment = 'Wybierz sposób płatności.';
  if (note.length > 800) errors.note = 'Skróć uwagi — maksymalnie 800 znaków.';
  if (!form?.terms) errors.terms = 'Zaznacz akceptację regulaminu.';
  if (!Array.isArray(lines) || !lines.length) errors.items = 'Koszyk jest pusty.';
  else if (lines.some((line) => !UUID_RE.test(String(line?.product_id || '')) || !Number.isInteger(Number(line?.qty)) || Number(line.qty) < 1)) {
    errors.items = 'Popraw pozycje w koszyku.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function buildOrderPayload(form, lines) {
  const payload = {
    name: String(form.name || '').trim(),
    phone: normalizePhone(form.phone),
    email: String(form.email || '').trim(),
    street: String(form.street || '').trim(),
    postcode: normalizePostcode(form.postcode),
    city: String(form.city || '').trim(),
    delivery: form.delivery,
    payment: form.payment,
    note: String(form.note || '').trim(),
    items: (lines || []).map((line) => ({
      product_id: line.product_id,
      qty: Math.round(Number(line.qty)),
      size: String(line.size || ''),
      color: String(line.color || ''),
    })),
  };
  if (form.delivery === 'dpd_point') payload.point_code = String(form.point_code || '').trim();
  return payload;
}

export function mapOrderError(code) {
  const raw = String(code || '').trim();
  const splitAt = raw.indexOf(':');
  const key = splitAt === -1 ? raw : raw.slice(0, splitAt);
  const rest = splitAt === -1 ? '' : raw.slice(splitAt + 1).trim().slice(0, 40);
  if (key === 'out_of_stock') {
    const base = 'Ten produkt właśnie się wyprzedał.';
    return rest ? `${base} (${rest})` : base;
  }
  const table = {
    phone: 'Sprawdź numer telefonu — potrzebujemy 9 cyfr.',
    postcode: 'Sprawdź kod pocztowy. Poprawny format to 00-000.',
    address: 'Sprawdź imię i nazwisko, ulicę i miasto.',
    choice: 'Wybierz dostawę i płatność jeszcze raz.',
    point: 'Podaj kod punktu albo automatu DPD.',
    items: 'Koszyk jest pusty albo ma niepoprawne pozycje.',
    too_many: 'Za dużo sztuk w jednym zamówieniu. Zmniejsz ilość.',
    product_unavailable: 'Ten produkt jest już niedostępny. Usuń go z koszyka.',
  };
  return table[key] || 'Nie udało się złożyć zamówienia. Spróbuj jeszcze raz.';
}

export function thanksLines(order) {
  const lines = [
    `Do zapłaty teraz: ${formatZl(order?.to_pay_now)}`,
    BLIK_LINE,
    TRANSFER_LINE,
    `W tytule wpisz numer zamówienia: ${String(order?.order_no ?? '')}`,
  ];
  if (order?.payment === 'cod' || Number(order?.cod_amount) > 0) {
    lines.push(`Przy odbiorze zapłacisz kurierowi: ${formatZl(order?.cod_amount)}`);
  }
  return lines;
}

export function stockProblem(lines, products) {
  if (!products) return '';
  for (const line of lines || []) {
    const product = products.find((item) => item.id === line.product_id);
    if (!product || product.active === false) return 'W koszyku jest produkt, który jest już niedostępny.';
    const stock = Number(product.stock);
    if (Number.isFinite(stock) && stock <= 0) return 'Ten produkt właśnie się wyprzedał.';
    if (Number.isFinite(stock) && Number(line.qty) > stock) return 'Za duża ilość względem stanu. Zmniejsz liczbę sztuk.';
  }
  return '';
}

export function nextProductCode(codes) {
  let max = 0;
  for (const code of codes || []) {
    const match = String(code || '').trim().match(/^K-(\d+)$/i);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `K-${String(max + 1).padStart(3, '0')}`;
}

export function ownerFlag(data) {
  if (data === true || data === 1) return true;
  if (data === false || data == null) return false;
  if (typeof data === 'string') return ['true', 't', '1'].includes(data.trim().toLowerCase());
  if (Array.isArray(data)) return data.length === 1 ? ownerFlag(data[0]) : false;
  if (typeof data === 'object') {
    if ('pak_is_owner' in data) return ownerFlag(data.pak_is_owner);
    const values = Object.values(data);
    if (values.length === 1) return ownerFlag(values[0]);
  }
  return false;
}

export function parseAdminRoute(hash) {
  let raw = String(hash || '').replace(/^#/, '');
  if (!raw.startsWith('/')) raw = `/${raw}`;
  const path = raw.split('?')[0].replace(/\/+$/, '') || '/produkty';
  if (path === '/zamowienia') return { name: 'orders' };
  if (path === '/produkt/nowy') return { name: 'edit', id: 'new' };
  const match = path.match(/^\/produkt\/([0-9a-f-]{16,64})$/i);
  if (match) return { name: 'edit', id: match[1] };
  return { name: 'products' };
}

export function sortProducts(rows) {
  return (rows || []).slice().sort((a, b) => {
    const bySort = (Number(a.sort) || 0) - (Number(b.sort) || 0);
    if (bySort) return bySort;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

export function coerceOrder(data) {
  if (data == null) return null;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return { error: data }; }
  }
  return data;
}
