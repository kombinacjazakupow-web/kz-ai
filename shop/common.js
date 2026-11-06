// Shared shop helpers. The key is the public publishable key, same as the packing app.
export const SUPABASE_URL = 'https://ghhatjkcgilnruluhxyr.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_pIiSGwIiJJmkNsvlZyniAw_6CQ1FlpF';

export const DELIVERY_FEE = 25;
export const DELIVERY_LABEL = 'Dostawa DPD 25 zł';
export const COD_NOTE = 'Pobranie — wpłacasz teraz tylko 28 zł, resztę kurierowi.';
export const MESSENGER_LINE = 'Dołącz potwierdzenie powyżej (najszybciej). Pytania: WhatsApp +48 792 402 881.';
export const BLIK_LINE = 'BLIK na telefon: 796 669 157 (Fikrie Ali)';
export const TRANSFER_LINE = 'Przelew: PL24 2910 0006 0000 0000 0571 2568 (Sergen Kushdan)';
export const BLIK_COPY = '796 669 157';
export const TRANSFER_COPY = 'PL24 2910 0006 0000 0000 0571 2568';

export const BASKET_KEY = 'kombi-shop-basket';
export const DRAFT_KEY = 'kombi-shop-draft';
export const THANKS_KEY = 'kombi-shop-thanks';
export const ORDERS_KEY = 'kombi-shop-orders';
export const LAUNCH_BANNER = '04.11.2026 \u2013 startujemy z nasz\u0105 pierwsz\u0105 aplikacj\u0105! \u{1F389} Ceny startowe dla pierwszych zam\u00f3wie\u0144 w aplikacji.';
export const PAY_WINDOW = 'Zap\u0142a\u0107 w ci\u0105gu 1 godziny i do\u0142\u0105cz potwierdzenie';
export const PROOF_LABEL = 'Do\u0142\u0105cz potwierdzenie p\u0142atno\u015bci';
export const PROOF_OK = 'Potwierdzenie wys\u0142ane \u2705 \u2013 sprawdzimy i potwierdzimy';
export const LUCKY_LABEL = 'Wylosuj swoje szcz\u0119\u015bcie \u{1F340}';
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const SLOGANS = [
  'Kombi szansa',
  'Elastyczne erotyczne',
  'Ca\u0142ujemy od wsz\u0119dzie',
  'Aide Dziewczyny',
  'Co robili\u015bcie dzisiaj, z kim zrobili\u015bcie, dlaczego zrobili\u015bcie, ale najwa\u017cniejsze \u2013 czy to dobrze zrobili\u015bcie?',
  'To kosztuje 1599 z\u0142 dla innych, a dla ciebie tylko 29',
  'Bia\u0142uszka, Be\u017coweszka, Granatuszka \u2013 ooo zajebuszka',
];

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

export function photoSrc(path) {
  return photoUrl(path);
}

const PROOF_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
};

export function videoSrc(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https:\/\/[^\s"'<>]+$/i.test(raw)) return raw;
  return photoUrl(raw);
}

export function slidePlan(hasFilm, photoCount) {
  const photos = Math.max(0, Math.floor(Number(photoCount)) || 0);
  const total = (hasFilm ? 1 : 0) + photos;
  return { total, controls: total > 1 };
}

export function payPopup(order) {
  const payment = String(order?.payment || '');
  if (payment !== 'blik' && payment !== 'transfer' && payment !== 'cod') return null;
  const amount = Number(order?.to_pay_now);
  if (!Number.isFinite(amount)) return null;
  const orderNo = String(order?.order_no ?? '');
  const amountText = formatZl(amount);
  return {
    title: 'Zrób przelew ze swojego banku',
    amountText,
    blik: BLIK_LINE,
    transfer: TRANSFER_LINE,
    titleLine: `W tytule wpisz numer zamówienia: ${orderNo}`,
    copies: {
      amount: amountText,
      blik: BLIK_COPY,
      transfer: TRANSFER_COPY,
      orderNo,
    },
  };
}

const FACEBOOK_REEL = /^https:\/\/www\.facebook\.com\/reel\/\d+$/;

export function facebookReel(value) {
  const raw = String(value || '').trim();
  return FACEBOOK_REEL.test(raw) ? raw : '';
}

export function facebookClip(value) {
  const raw = String(value || '').trim();
  if (facebookReel(raw)) return raw;
  let url;
  try { url = new URL(raw); } catch { return ''; }
  if (url.protocol !== 'https:' || url.username || url.password) return '';
  if (url.hostname !== 'www.facebook.com') return '';
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const ok = path === '/watch'
    || /^\/reel\/\d+$/.test(path)
    || /^\/videos\/\d+$/.test(path)
    || /^\/[^/]+\/videos\/\d+$/.test(path);
  if (!ok) return '';
  return `${url.origin}${url.pathname}${url.search}`;
}

export function soldShopLine(count) {
  if (count == null || count === '') return '';
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `Sprzedane w sklepie: ${Math.floor(n)}`;
}

export function facebookPlayer(value, autoplay) {
  const href = facebookReel(value) || facebookClip(value);
  if (!href) return '';
  const params = new URLSearchParams({ href, show_text: 'false' });
  if (autoplay) params.set('autoplay', 'true');
  return `https://www.facebook.com/plugins/video.php?${params.toString()}`;
}

export function proofKind(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  let ext = '';
  if (type === 'image/jpeg') ext = 'jpg';
  else if (type === 'image/png') ext = 'png';
  else if (type === 'image/webp') ext = 'webp';
  else if (type === 'image/heic' || type === 'image/heif') ext = 'heic';
  else if (type === 'application/pdf') ext = 'pdf';
  else {
    const match = name.match(/\.([a-z0-9]+)$/);
    ext = match ? match[1] : '';
    if (ext === 'jpeg') ext = 'jpg';
  }
  if (!PROOF_TYPES[ext]) return null;
  return { ext, contentType: PROOF_TYPES[ext] };
}

export function proofObjectPath(orderNo, ext, id) {
  const no = String(orderNo || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(no)) return '';
  if (!PROOF_TYPES[ext]) return '';
  if (!UUID_RE.test(String(id || ''))) return '';
  return `${no}/${id}.${ext}`;
}

export function mapProofResult(data) {
  let code = data;
  if (code && typeof code === 'object') {
    if ('shop_attach_proof' in code) code = code.shop_attach_proof;
    else if ('error' in code) code = code.error;
    else {
      const values = Object.values(code);
      code = values.length === 1 ? values[0] : '';
    }
  }
  code = String(code ?? '').trim();
  if (code === 'ok') return { ok: true, message: PROOF_OK };
  const table = {
    no_order: 'Nie ma zamówienia o tym numerze.',
    phone: 'Numer telefonu nie pasuje do zamówienia.',
    path: 'Nie udało się zapisać ścieżki potwierdzenia.',
  };
  return { ok: false, message: table[code] || 'Nie udało się wysłać potwierdzenia. Spróbuj jeszcze raz.' };
}

export function pickSlogan(random = Math.random) {
  const index = Math.floor(Number(random()) * SLOGANS.length);
  return SLOGANS[Math.min(SLOGANS.length - 1, Math.max(0, index))];
}

export function rememberOrder(list, order) {
  const orderNo = String(order?.order_no || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(orderNo)) return Array.isArray(list) ? list.slice(0, 20) : [];
  const phone = normalizePhone(order?.phone || '');
  const next = (Array.isArray(list) ? list : []).filter((row) => row?.order_no !== orderNo);
  const row = { order_no: orderNo, phone, at: String(order?.at || '') };
  const due = Number(order?.to_pay_now);
  if (Number.isFinite(due)) {
    row.to_pay_now = due;
    row.payment = String(order?.payment || '');
    row.cod_amount = Number(order?.cod_amount) || 0;
    row.products_total = Number(order?.products_total) || 0;
    row.delivery_fee = Number(order?.delivery_fee) || 0;
  }
  next.unshift(row);
  return next.slice(0, 20);
}

export function splitList(text) {
  return String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function settleOption(options, current) {
  const list = Array.isArray(options) ? options : [];
  if (list.length === 1) return list[0];
  return current && list.includes(current) ? current : '';
}

export function chooseOption(current, value, options) {
  const list = Array.isArray(options) ? options : [];
  if (list.length === 1) return list[0];
  const next = String(value || '');
  if (!next || !list.includes(next)) return settleOption(list, current);
  return current === next ? '' : next;
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
  if (clean === '/moje') return { name: 'orders' };
  if (clean === '/konto') return { name: 'account' };
  if (clean === '/rolki') return { name: 'reels' };
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

export function takenExcept(lines, productId, exceptKey) {
  let used = 0;
  const id = String(productId || '');
  for (const line of lines || []) {
    if (String(line?.product_id || '') !== id) continue;
    if (exceptKey && lineKey(line) === exceptKey) continue;
    used += Math.round(Number(line?.qty)) || 0;
  }
  return used;
}

export function roomFor(lines, productId, exceptKey, stock) {
  const cap = capFor(stock);
  if (!Number.isFinite(stock)) return cap;
  return Math.max(0, cap - takenExcept(lines, productId, exceptKey));
}

export function upsertLine(lines, add, stock) {
  const next = (lines || []).map((line) => ({ ...line }));
  const key = lineKey(add);
  const want = Math.round(Number(add.qty)) || 1;
  const index = next.findIndex((line) => lineKey(line) === key);
  const room = roomFor(next, add.product_id, key, stock);
  const current = index === -1 ? 0 : (Math.round(Number(next[index].qty)) || 0);
  const qty = Math.min(room, current + (want > 0 ? want : 1));
  if (qty < 1) return { lines: next, added: 0 };
  const row = { ...add, qty };
  if (index === -1) next.push(row);
  else next[index] = { ...next[index], ...row };
  return { lines: next, added: qty - current };
}

export function setLineQty(lines, key, qty, stock) {
  const q = Math.round(Number(qty));
  if (!Number.isFinite(q) || q < 1) return (lines || []).filter((line) => lineKey(line) !== key);
  const current = (lines || []).find((line) => lineKey(line) === key);
  if (!current) return lines || [];
  const room = roomFor(lines, current.product_id, key, stock);
  if (room < 1) return (lines || []).filter((line) => lineKey(line) !== key);
  return (lines || []).map((line) => (
    lineKey(line) === key ? { ...line, qty: Math.min(room, q) } : line
  ));
}

export function clampBasket(lines, products) {
  if (!Array.isArray(products)) return lines || [];
  const byId = new Map(products.map((item) => [item.id, item]));
  const next = [];
  const used = new Map();
  for (const line of lines || []) {
    const product = byId.get(line.product_id);
    if (!product) {
      next.push(line);
      continue;
    }
    if (product.active === false) continue;
    const stock = Number(product.stock);
    const cap = Number.isFinite(stock) ? capFor(stock) : 99;
    const already = used.get(line.product_id) || 0;
    const room = Math.max(0, cap - already);
    const qty = Math.min(room, Math.round(Number(line.qty)) || 0);
    if (qty < 1) continue;
    used.set(line.product_id, already + qty);
    next.push({ ...line, qty });
  }
  return next;
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

export const ORDER_UNSURE = 'Nie mamy pewności, czy zamówienie doszło. Sprawdź Moje zamówienia, zanim wyślesz je jeszcze raz.';

const ATTEMPT_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function orderAttemptKey(current, makeId = () => crypto.randomUUID()) {
  const key = String(current || '');
  if (ATTEMPT_KEY.test(key)) return key;
  return makeId();
}

export function buildOrderPayload(form, lines, clientKey) {
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
  const attempt = String(clientKey || '');
  if (ATTEMPT_KEY.test(attempt)) payload.client_key = attempt;
  return payload;
}

export function mapOrderError(code) {
  const raw = String(code || '').trim();
  const splitAt = raw.indexOf(':');
  const key = splitAt === -1 ? raw : raw.slice(0, splitAt);
  if (key === 'color') return 'Ten kolor właśnie się skończył – wybierz inny';
  if (key === 'out_of_stock') return 'Ktoś był szybszy – ten kolor jest już wyprzedany';
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

function lineLabel(line) {
  return [line?.title, line?.color, line?.size].filter(Boolean).join(' · ');
}

export function refusedLine(code, lines) {
  const raw = String(code || '').trim();
  const at = raw.indexOf(':');
  if (at < 1) return '';
  const key = raw.slice(0, at);
  if (key !== 'color' && key !== 'out_of_stock') return '';
  const productCode = raw.slice(at + 1).trim();
  const names = (lines || [])
    .filter((line) => String(line?.code || '') === productCode)
    .map(lineLabel)
    .filter(Boolean);
  if (!names.length) return '';
  const name = names.join(', ');
  if (key === 'color') return `${name}: ten kolor właśnie się skończył – wybierz inny`;
  return `${name}: ten kolor jest już wyprzedany`;
}

export function stockProblem(lines, products, variants) {
  if (!products) return '';
  const rows = Array.isArray(variants) ? variants : [];
  const totals = new Map();
  for (const line of lines || []) {
    const product = products.find((item) => item.id === line.product_id);
    if (!product || product.active === false) {
      const name = lineLabel(line);
      return name ? `${name} jest już niedostępny.` : 'W koszyku jest produkt, który jest już niedostępny.';
    }
    const mine = rows.filter((row) => row.product_id === line.product_id);
    if (mine.length && line.color) {
      const key = String(line.color).toLocaleLowerCase('pl');
      const hit = mine.find((row) => String(row.color || '').toLocaleLowerCase('pl') === key);
      const qty = Number(line.qty) || 0;
      if (!hit || hit.stock < qty) return `${lineLabel(line) || 'Ta pozycja'}: ten kolor właśnie się skończył.`;
    }
    const id = String(line.product_id);
    totals.set(id, (totals.get(id) || 0) + (Number(line.qty) || 0));
  }
  for (const [id, qty] of totals) {
    const product = products.find((item) => item.id === id);
    const stock = Number(product?.stock);
    const name = (lines || []).filter((line) => String(line.product_id) === id).map(lineLabel).filter(Boolean).join(', ');
    if (Number.isFinite(stock) && stock <= 0) {
      return name ? `${name}: ten produkt właśnie się wyprzedał.` : 'Ten produkt właśnie się wyprzedał.';
    }
    if (Number.isFinite(stock) && qty > stock) {
      return name
        ? `${name}: za duża ilość względem stanu. Zmniejsz liczbę sztuk.`
        : 'Za duża ilość względem stanu. Zmniejsz liczbę sztuk.';
    }
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
