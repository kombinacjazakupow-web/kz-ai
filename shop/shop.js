import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import {
  SUPABASE_URL, SUPABASE_KEY, BASKET_KEY, DRAFT_KEY, THANKS_KEY, ORDERS_KEY,
  DELIVERY_LABEL, COD_NOTE, MESSENGER_LINE, BLIK_COPY, TRANSFER_COPY,
  LAUNCH_BANNER, PAY_WINDOW, PROOF_LABEL, PROOF_OK, PROOF_MAX_BYTES, LUCKY_LABEL,
  esc, formatZl, photoUrl, videoSrc, splitList, settleOption, chooseOption, parseRoute, stockBadge, sanitizeBasket,
  upsertLine, setLineQty, lineKey, previewTotals, validateCheckout, buildOrderPayload,
  clampBasket, proofKind, proofObjectPath, mapProofResult, pickSlogan, rememberOrder,
  mapOrderError, thanksLines, stockProblem, sortProducts, coerceOrder, normalizePostcode, normalizePhone, phoneOk,
} from './common.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const state = {
  products: [],
  loaded: false,
  loading: false,
  error: '',
  query: '',
  basket: [],
  pick: { code: '', size: '', color: '', qty: 1 },
  draft: emptyDraft(),
  thanks: null,
  fieldErrors: {},
  formError: '',
  problemCode: '',
  busy: false,
  mine: [],
  proofNote: {},
  proofBusy: '',
  installReady: false,
  installEvent: null,
};

function emptyDraft() {
  return {
    name: '', phone: '', email: '', street: '', postcode: '', city: '',
    delivery: '', point_code: '', payment: '', note: '', terms: false,
  };
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode or full disk */ }
}

function setBasket(lines) {
  state.basket = sanitizeBasket(lines);
  writeJson(BASKET_KEY, state.basket);
}

function saveDraft(draft) {
  state.draft = { ...emptyDraft(), ...draft };
  writeJson(DRAFT_KEY, state.draft);
}

function saveThanks(order) {
  state.thanks = order;
  try {
    if (order) sessionStorage.setItem(THANKS_KEY, JSON.stringify(order));
    else sessionStorage.removeItem(THANKS_KEY);
  } catch { /* ignore */ }
  if (order?.order_no) {
    state.mine = rememberOrder(state.mine, order);
    writeJson(ORDERS_KEY, state.mine);
  }
}

function loadThanks() {
  try {
    const raw = sessionStorage.getItem(THANKS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.order_no ? data : null;
  } catch {
    return null;
  }
}

function countPieces() {
  return state.basket.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
}

function findProduct(code) {
  const want = String(code || '').trim().toLocaleLowerCase('pl');
  return state.products.find((item) => String(item.code || '').trim().toLocaleLowerCase('pl') === want) || null;
}

function productById(id) {
  return state.products.find((item) => item.id === id) || null;
}

function photoList(product) {
  return Array.isArray(product?.photos) ? product.photos.filter(Boolean) : [];
}

function letter(title) {
  const ch = String(title || '').trim().charAt(0).toLocaleUpperCase('pl');
  return ch || '·';
}

function thumbHtml(path, alt, eager) {
  const url = photoUrl(path);
  if (!url) return `<span class="ph" aria-hidden="true">${esc(letter(alt))}</span>`;
  const loading = eager ? 'eager' : 'lazy';
  const priority = eager ? ' fetchpriority="high"' : '';
  return `<img src="${esc(url)}" alt="${esc(alt)}" loading="${loading}" decoding="async"${priority} referrerpolicy="no-referrer">`;
}

function pricedLines() {
  return state.basket.map((line) => {
    const product = productById(line.product_id);
    return {
      ...line,
      title: product?.title || line.title,
      code: product?.code || line.code,
      price: product && product.price != null ? Number(product.price) || 0 : Number(line.price) || 0,
      photo: photoList(product)[0] || line.photo,
    };
  });
}

function visibleProducts() {
  const q = state.query.trim().toLocaleLowerCase('pl');
  const list = state.products.filter((item) => item.active !== false);
  if (!q) return list;
  return list.filter((item) => {
    const hay = [item.title, item.code, item.description, item.sizes, item.colors]
      .map((part) => String(part || '').toLocaleLowerCase('pl'))
      .join(' ');
    return hay.includes(q);
  });
}

function stockOf(product) {
  const n = Number(product?.stock);
  return Number.isFinite(n) ? n : null;
}

function heldQty(productId) {
  return state.basket.reduce((sum, line) => (
    String(line.product_id) === String(productId) ? sum + (Number(line.qty) || 0) : sum
  ), 0);
}

function addRoom(product) {
  const stock = stockOf(product);
  if (stock == null) return 99;
  return Math.max(0, Math.min(99, Math.floor(stock)) - heldQty(product?.id));
}

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.hidden = false;
  el.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2800);
}

function paint(opts = {}) {
  const root = document.getElementById('app');
  if (!root) return;
  const y = opts.keep ? window.scrollY : 0;
  document.title = pageTitle();
  root.innerHTML = shell();
  afterPaint();
  window.scrollTo(0, y);
}

function pageTitle() {
  const route = parseRoute(location.hash);
  if (route.name === 'basket') return 'Koszyk · KOMBI Sklep';
  if (route.name === 'checkout') {
    return state.basket.length ? 'Zamówienie · KOMBI Sklep' : 'Dziękujemy · KOMBI Sklep';
  }
  if (route.name === 'product') {
    const product = findProduct(route.code);
    return product ? `${product.title} · KOMBI Sklep` : 'Produkt · KOMBI Sklep';
  }
  if (route.name === 'orders') return 'Moje zamówienia · KOMBI Sklep';
  return 'KOMBI Sklep';
}

function shell() {
  const body = mainView();
  return `${topbar()}<p class="launch">${esc(LAUNCH_BANNER)}</p>${body}${footer()}<div id="toast" class="toast" role="status" hidden></div>`;
}

function topbar() {
  const n = countPieces();
  return `<header class="top">
    <a class="mark" href="#/">KS</a>
    <div class="top-title"><b>KOMBI</b><small>Sklep</small></div>
    <a class="cartlink" href="#/koszyk" aria-label="Koszyk, ${n} szt.">Koszyk <span id="cart-count">${n ? esc(String(n)) : ''}</span></a>
  </header>`;
}

function footer() {
  return `<footer class="footer">
    <button type="button" class="install" id="install" data-act="install"${state.installReady ? '' : ' hidden'}>Zainstaluj aplikację</button>
    <a href="#/moje">Moje zamówienia</a>
    <a href="regulamin.html">Regulamin</a>
    <a href="prywatnosc.html">Polityka prywatności</a>
    <a href="zwroty.html">Zwroty i reklamacje</a>
    <button type="button" data-act="reload">Odśwież</button>
    <a href="admin.html">Panel</a>
  </footer>`;
}

function mainView() {
  if (!state.loaded && state.loading) return '<main class="center"><p>Ładowanie…</p></main>';
  if (!state.loaded && state.error) {
    return `<main class="center"><h1>Chwila przerwy</h1><p>${esc(state.error)}</p><button type="button" class="btn primary" data-act="reload">Spróbuj ponownie</button></main>`;
  }
  const route = parseRoute(location.hash);
  if (route.name === 'product') return productMain(route.code);
  if (route.name === 'basket') return basketMain();
  if (route.name === 'checkout') return checkoutMain();
  if (route.name === 'orders') return ordersMain();
  return catalogMain();
}

function catalogMain() {
  return `<main>
    <h1>Produkty</h1>
    <button type="button" class="btn luck" data-act="luck">${esc(LUCKY_LABEL)}</button>
    <p id="slogan" class="slogan" hidden></p>
    <input id="q" class="search" type="search" enterkeyhint="search" placeholder="Szukaj" value="${esc(state.query)}" aria-label="Szukaj produktu" autocomplete="off">
    <p id="result-note" class="hint">${esc(resultNoteText())}</p>
    <div id="grid" class="grid">${gridHtml()}</div>
  </main>`;
}

function resultNoteText() {
  const shown = visibleProducts();
  if (!state.products.length) return 'Jeszcze nic nie wystawiliśmy.';
  if (!shown.length) return `Nic nie pasuje do „${state.query.trim()}”.`;
  return '';
}

function gridHtml() {
  const list = visibleProducts();
  if (!list.length) return '';
  return list.map((product, index) => {
    const badge = stockBadge(product.stock);
    const sold = badge === 'Wyprzedane';
    const badgeHtml = badge
      ? `<span class="badge${sold ? ' sold' : ''}">${esc(badge)}</span>`
      : '';
    const code = encodeURIComponent(String(product.code || ''));
    return `<a class="card${sold ? ' sold' : ''}" href="#/p/${code}">
      <span class="thumb">${thumbHtml(photoList(product)[0], product.title || 'Produkt', index < 2)}${badgeHtml}</span>
      <span class="card-title">${esc(product.title || 'Produkt')}</span>
      <span class="price">${esc(formatZl(product.price))}</span>
    </a>`;
  }).join('');
}

function productMain(code) {
  const product = findProduct(code);
  if (!product) {
    return `<main class="center"><h1>Nie ma takiego produktu</h1><p><a class="btn primary" href="#/">Wróć do sklepu</a></p></main>`;
  }
  syncPick(product);
  const photos = photoList(product);
  const slides = photos.length
    ? photos.map((path) => thumbHtml(path, product.title || 'Produkt', true)).join('')
    : `<span class="ph">${esc(letter(product.title))}</span>`;
  const nav = photos.length > 1
    ? `<button type="button" class="gal-nav prev" data-act="gal" data-dir="-1" aria-label="Poprzednie zdjęcie">‹</button>
       <button type="button" class="gal-nav next" data-act="gal" data-dir="1" aria-label="Następne zdjęcie">›</button>`
    : '';
  const dots = photos.length > 1
    ? `<div class="dots" id="dots">${photos.map((_, i) => `<button type="button" data-act="dot" data-idx="${i}" aria-label="Zdjęcie ${i + 1}"${i === 0 ? ' class="on"' : ''}></button>`).join('')}</div><p id="gal-live" class="sr" aria-live="polite"></p>`
    : '';
  const badge = stockBadge(product.stock);
  const sold = badge === 'Wyprzedane';
  const sizes = splitList(product.sizes);
  const colors = splitList(product.colors);
  const left = addRoom(product);
  if (left > 0 && state.pick.qty > left) state.pick.qty = left;
  const max = Math.max(left, 1);
  const buy = sold
    ? '<p class="badge sold" style="position:static;display:inline-block">Wyprzedane</p>'
    : left < 1
    ? '<p>W koszyku jest już cały dostępny stan.</p>'
    : `${chips('size', 'Rozmiar', sizes, state.pick.size)}${chips('color', 'Kolor', colors, state.pick.color)}
      <div class="stepper" aria-label="Ilość">
        <button type="button" data-act="pqty" data-dir="-1" aria-label="Mniej" ${state.pick.qty <= 1 ? 'disabled' : ''}>−</button>
        <span id="pqty">${esc(String(state.pick.qty))}</span>
        <button type="button" data-act="pqty" data-dir="1" aria-label="Więcej" ${state.pick.qty >= max ? 'disabled' : ''}>+</button>
      </div>
      <button type="button" class="btn primary block" data-act="add">Dodaj do koszyka</button>`;
  const desc = String(product.description || '').trim();
  const film = videoSrc(product.video_url);
  const video = film
    ? `<video class="product-video" autoplay muted loop playsinline src="${esc(film)}"></video>`
    : '';
  return `<main>
    <p><a class="back" href="#/">← Sklep</a></p>
    ${video}
    <div class="gal-wrap">
      <div class="gallery" id="gallery" tabindex="0" aria-label="Zdjęcia produktu">${slides}</div>
      ${nav}
    </div>
    ${dots}
    <h1>${esc(product.title || 'Produkt')}</h1>
    <p class="price">${esc(formatZl(product.price))}</p>
    ${badge && !sold ? `<p><span class="badge" style="position:static">${esc(badge)}</span></p>` : ''}
    ${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
    ${buy}
  </main>`;
}

function chips(kind, label, options, selected) {
  if (!options.length) return '';
  const buttons = options.map((option) => {
    const on = option === selected;
    return `<button type="button" class="chip${on ? ' on' : ''}" data-act="pick" data-kind="${kind}" data-val="${esc(option)}" aria-pressed="${on ? 'true' : 'false'}">${esc(option)}</button>`;
  }).join('');
  return `<fieldset class="chips"><legend>${label}</legend><div class="chip-row">${buttons}</div></fieldset>`;
}

function basketMain() {
  if (!state.basket.length) {
    return `<main class="center"><h1>Koszyk</h1><p>Koszyk jest pusty.</p><p><a class="btn primary" href="#/">Zobacz produkty</a></p></main>`;
  }
  const lines = pricedLines();
  const totals = previewTotals(lines);
  const rows = lines.map((line) => {
    const meta = [line.size, line.color].filter(Boolean).join(' · ');
    const product = productById(line.product_id);
    const stock = product ? stockOf(product) : null;
    const cap = stock == null ? 99 : Math.max(0, stock);
    return `<article class="line">
      <div class="thumb">${thumbHtml(line.photo, line.title, false)}</div>
      <div>
        <h2>${esc(line.title)}</h2>
        ${meta ? `<p class="muted">${esc(meta)}</p>` : ''}
        <p class="price">${esc(formatZl(line.price))} · ${esc(formatZl(line.price * line.qty))}</p>
        <div class="line-actions">
          <div class="stepper">
            <button type="button" data-act="lqty" data-key="${esc(lineKey(line))}" data-dir="-1" aria-label="Mniej">−</button>
            <span>${esc(String(line.qty))}</span>
            <button type="button" data-act="lqty" data-key="${esc(lineKey(line))}" data-dir="1" aria-label="Więcej" ${line.qty >= cap ? 'disabled' : ''}>+</button>
          </div>
          <button type="button" class="btn ghost" data-act="drop" data-key="${esc(lineKey(line))}">Usuń</button>
        </div>
      </div>
    </article>`;
  }).join('');
  return `<main>
    <h1>Koszyk</h1>
    ${rows}
    <div class="sums">
      <div><span>Towary</span><b>${esc(formatZl(totals.goods))}</b></div>
      <div><span>${esc(DELIVERY_LABEL)}</span><span></span></div>
      <div class="big"><span>Podgląd razem</span><b>${esc(formatZl(totals.preview))}</b></div>
    </div>
    <p class="hint">To jest podgląd. Kwotę do zapłaty potwierdza sklep przy zamówieniu.</p>
    <a class="btn primary block" href="#/zamowienie">Dalej do zamówienia</a>
  </main>`;
}

function checkoutMain() {
  if (!state.basket.length && state.thanks) return thanksMain(state.thanks);
  if (!state.basket.length) {
    return `<main class="center"><h1>Zamówienie</h1><p>Koszyk jest pusty.</p><p><a class="btn primary" href="#/">Zobacz produkty</a></p></main>`;
  }
  const draft = state.draft;
  const err = state.fieldErrors;
  const lines = pricedLines();
  const totals = previewTotals(lines);
  const summary = lines.map((line) => {
    const meta = [line.size, line.color].filter(Boolean).join(' · ');
    const problem = state.problemCode && line.code === state.problemCode;
    return `<p class="${problem ? 'problem' : ''}">${esc(line.title)}${meta ? ` · ${esc(meta)}` : ''} × ${esc(String(line.qty))} — ${esc(formatZl((Number(line.price) || 0) * line.qty))}${problem ? ` — ${esc('Ten produkt właśnie się wyprzedał.')}` : ''}</p>`;
  }).join('');
  const alert = state.formError || err.items || '';
  return `<main>
    <h1>Zamówienie</h1>
    <p><a class="back" href="#/koszyk">← Koszyk</a></p>
    ${alert ? `<div class="alert" role="alert">${esc(alert)}</div>` : ''}
    <div class="sums">
      ${summary}
      <div><span>Towary</span><b>${esc(formatZl(totals.goods))}</b></div>
      <div><span>${esc(DELIVERY_LABEL)}</span><span></span></div>
      <div class="big"><span>Podgląd razem</span><b>${esc(formatZl(totals.preview))}</b></div>
    </div>
    <p class="hint">To jest podgląd. Kwotę do zapłaty potwierdza sklep przy zamówieniu.</p>
    <form id="checkout" novalidate>
      ${field('name', 'Imię i nazwisko', draft.name, 'text', err.name, 'autocomplete="name"')}
      ${field('phone', 'Telefon', draft.phone, 'tel', err.phone, 'autocomplete="tel" inputmode="tel"')}
      ${field('email', 'E-mail (nieobowiązkowy)', draft.email, 'email', err.email, 'autocomplete="email" inputmode="email"')}
      ${field('street', 'Ulica i numer', draft.street, 'text', err.street, 'autocomplete="street-address"')}
      ${field('postcode', 'Kod pocztowy', draft.postcode, 'text', err.postcode, 'autocomplete="postal-code" inputmode="numeric" maxlength="6" placeholder="00-000"')}
      ${field('city', 'Miasto', draft.city, 'text', err.city, 'autocomplete="address-level2"')}
      <p class="group-label">Dostawa</p>
      ${choice('delivery', 'dpd_home', 'Kurier DPD pod drzwi', draft.delivery)}
      ${choice('delivery', 'dpd_point', 'Punkt lub automat DPD', draft.delivery)}
      ${err.delivery ? `<small class="field-error">${esc(err.delivery)}</small>` : ''}
      <div id="point-wrap"${draft.delivery === 'dpd_point' ? '' : ' hidden'}>
        ${field('point_code', 'Kod punktu', draft.point_code, 'text', err.point_code, 'autocapitalize="characters" autocomplete="off"')}
      </div>
      <p class="group-label">Płatność</p>
      ${choice('payment', 'blik', 'BLIK na telefon', draft.payment)}
      ${choice('payment', 'transfer', 'Przelew', draft.payment)}
      ${choice('payment', 'cod', 'Pobranie — wpłacasz teraz tylko 28 zł, resztę kurierowi', draft.payment)}
      ${err.payment ? `<small class="field-error">${esc(err.payment)}</small>` : ''}
      <div id="cod-note" class="note-box"${draft.payment === 'cod' ? '' : ' hidden'}>${esc(COD_NOTE)}</div>
      <label class="field" for="note"><span>Uwagi</span>
        <textarea id="note" name="note" maxlength="800">${esc(draft.note)}</textarea>
        ${err.note ? `<small class="field-error">${esc(err.note)}</small>` : ''}
      </label>
      <label class="check">
        <input id="terms" name="terms" type="checkbox"${draft.terms ? ' checked' : ''}>
        <span>Akceptuję <a href="regulamin.html" target="_blank" rel="noopener">regulamin</a></span>
      </label>
      ${err.terms ? `<small class="field-error">${esc(err.terms)}</small>` : ''}
      <button type="submit" class="btn primary block" id="place">Zamawiam</button>
    </form>
  </main>`;
}

function field(id, label, value, type, error, extra) {
  return `<label class="field" for="${id}"><span>${label}</span>
    <input id="${id}" name="${id}" type="${type}" value="${esc(value || '')}" ${error ? 'aria-invalid="true"' : ''} ${extra || ''}>
    ${error ? `<small class="field-error">${esc(error)}</small>` : ''}
  </label>`;
}

function choice(name, value, label, current) {
  const on = current === value;
  return `<label class="choice${on ? ' on' : ''}"><input type="radio" name="${name}" value="${value}"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
}

function thanksMain(order) {
  const lines = thanksLines(order);
  const rows = lines.map((line, index) => {
    const copy = copyValue(line, order, index);
    return `<div class="copyline"><p>${esc(line)}</p><button type="button" class="btn ghost" data-act="copy" data-copy="${esc(copy)}">Kopiuj</button></div>`;
  }).join('');
  return `<main>
    <p class="eyebrow">Numer zamówienia</p>
    <p class="orderno" id="orderno">${esc(order.order_no)}</p>
    <p><button type="button" class="btn ghost" data-act="copy" data-copy="${esc(order.order_no)}">Kopiuj numer</button></p>
    <div class="paybox">${rows}</div>
    ${proofBox(order.order_no, order.phone)}
    <p>${esc(MESSENGER_LINE)}</p>
    <p><a class="btn primary block" href="#/">Wróć do sklepu</a></p>
  </main>`;
}

function proofBox(orderNo, phone) {
  const note = state.proofNote[orderNo];
  const busy = state.proofBusy === orderNo;
  const done = note?.ok ? `<p class="note-box" role="status">${esc(PROOF_OK)}</p>` : '';
  const err = note && !note.ok ? `<p class="alert" role="alert">${esc(note.message || '')}</p>` : '';
  return `<section class="proof">
    <p class="pay-window">${esc(PAY_WINDOW)}</p>
    ${done}
    ${err}
    <p class="group-label">${esc(PROOF_LABEL)}</p>
    <label class="file">Aparat
      <input type="file" accept="image/*" capture="environment" data-proof="1" data-order="${esc(orderNo)}" data-phone="${esc(phone || '')}" ${busy ? 'disabled' : ''}>
    </label>
    <label class="file">Plik
      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,.heic,.jpg,.jpeg,.png,.webp,application/pdf,.pdf" data-proof="1" data-order="${esc(orderNo)}" data-phone="${esc(phone || '')}" ${busy ? 'disabled' : ''}>
    </label>
  </section>`;
}

function ordersMain() {
  const cards = state.mine.map((order) => `<article class="order">
      <header><strong class="price">${esc(order.order_no)}</strong></header>
      ${proofBox(order.order_no, order.phone)}
    </article>`).join('');
  return `<main>
    <h1>Moje zamówienia</h1>
    <p class="hint">Numer i telefon zostają w tym telefonie, żeby dołączyć potwierdzenie.</p>
    <form id="find-order">
      ${field('find-no', 'Numer zamówienia', '', 'text', '', 'autocapitalize="characters" spellcheck="false" maxlength="20"')}
      ${field('find-phone', 'Telefon', '', 'tel', '', 'inputmode="tel" autocomplete="tel"')}
      <button type="submit" class="btn">Pokaż zamówienie</button>
    </form>
    ${cards || '<p>Nie ma tu jeszcze zamówień z tego telefonu.</p>'}
  </main>`;
}

function copyValue(line, order, index) {
  if (index === 0) return formatZl(order.to_pay_now);
  if (line.startsWith('BLIK')) return BLIK_COPY;
  if (line.startsWith('Przelew')) return TRANSFER_COPY;
  if (line.startsWith('W tytule')) return String(order.order_no ?? '');
  if (line.startsWith('Przy odbiorze')) return formatZl(order.cod_amount);
  return line;
}

function afterPaint() {
  const gallery = document.getElementById('gallery');
  const dots = document.getElementById('dots');
  if (!gallery || !dots) return;
  const mark = () => {
    const index = Math.round(gallery.scrollLeft / Math.max(gallery.clientWidth, 1));
    dots.querySelectorAll('button').forEach((button, i) => button.classList.toggle('on', i === index));
    const live = document.getElementById('gal-live');
    if (live) live.textContent = `Zdjęcie ${index + 1} z ${dots.children.length}`;
  };
  gallery.addEventListener('scroll', mark, { passive: true });
  mark();
}

function scrollGallery(dir) {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  gallery.scrollBy({ left: dir * gallery.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
}

function syncChoices() {
  document.querySelectorAll('.choice').forEach((el) => {
    const input = el.querySelector('input');
    el.classList.toggle('on', !!input?.checked);
  });
  const delivery = document.querySelector('input[name="delivery"]:checked')?.value || '';
  const payment = document.querySelector('input[name="payment"]:checked')?.value || '';
  const point = document.getElementById('point-wrap');
  const cod = document.getElementById('cod-note');
  if (point) point.hidden = delivery !== 'dpd_point';
  if (cod) cod.hidden = payment !== 'cod';
}

function readCheckout(form) {
  const data = new FormData(form);
  return {
    name: String(data.get('name') || ''),
    phone: String(data.get('phone') || ''),
    email: String(data.get('email') || ''),
    street: String(data.get('street') || ''),
    postcode: normalizePostcode(data.get('postcode') || ''),
    city: String(data.get('city') || ''),
    delivery: String(data.get('delivery') || ''),
    point_code: String(data.get('point_code') || ''),
    payment: String(data.get('payment') || ''),
    note: String(data.get('note') || ''),
    terms: !!form.elements.namedItem('terms')?.checked,
  };
}

function focusError() {
  const el = document.querySelector('[aria-invalid="true"]');
  if (el) {
    el.focus();
    el.scrollIntoView({ block: 'center' });
    return;
  }
  document.querySelector('.alert')?.scrollIntoView({ block: 'center' });
}

async function placeOrder(form) {
  if (state.busy) return;
  const input = readCheckout(form);
  if (form.elements.postcode) form.elements.postcode.value = input.postcode;
  saveDraft({ ...input, terms: input.terms });
  const lines = pricedLines();
  const checked = validateCheckout(input, lines);
  const stockMsg = state.loaded ? stockProblem(lines, state.products) : '';
  if (!checked.ok || stockMsg) {
    state.fieldErrors = checked.errors;
    state.formError = stockMsg || '';
    if (stockMsg) state.fieldErrors = { ...checked.errors, items: checked.errors.items || stockMsg };
    paint();
    focusError();
    return;
  }
  state.busy = true;
  state.fieldErrors = {};
  state.formError = '';
  state.problemCode = '';
  const button = document.getElementById('place');
  if (button) {
    button.disabled = true;
    button.textContent = 'Wysyłam zamówienie…';
  }
  const payload = buildOrderPayload(input, lines);
  let failed = '';
  try {
    const { data, error } = await sb.rpc('shop_place_order', { p: payload });
    if (error) {
      failed = /failed to fetch|network|load failed/i.test(`${error.message || ''}`)
        ? 'Brak sieci. Sprawdź połączenie i spróbuj jeszcze raz.'
        : 'Nie udało się złożyć zamówienia. Spróbuj jeszcze raz.';
    } else {
      const body = coerceOrder(data);
      if (body?.error) {
        failed = mapOrderError(body.error);
        const raw = String(body.error);
        state.problemCode = raw.startsWith('out_of_stock:') ? raw.split(':').slice(1).join(':') : '';
      } else if (!body?.order_no) {
        failed = 'Nie udało się złożyć zamówienia. Spróbuj jeszcze raz.';
      } else {
        saveThanks({
          order_no: body.order_no,
          products_total: body.products_total,
          delivery_fee: body.delivery_fee,
          to_pay_now: body.to_pay_now,
          cod_amount: body.cod_amount,
          payment: payload.payment,
          phone: payload.phone,
        });
        setBasket([]);
        saveDraft({ ...state.draft, note: '', terms: false });
      }
    }
  } catch {
    failed = 'Brak sieci. Sprawdź połączenie i spróbuj jeszcze raz.';
  }
  state.busy = false;
  state.formError = failed;
  paint();
  if (failed) focusError();
}

function syncPick(product) {
  const sizes = splitList(product.sizes);
  const colors = splitList(product.colors);
  if (state.pick.code !== String(product.code)) {
    state.pick = { code: String(product.code), size: '', color: '', qty: 1 };
  }
  state.pick.size = settleOption(sizes, state.pick.size);
  state.pick.color = settleOption(colors, state.pick.color);
}

function addCurrent() {
  const route = parseRoute(location.hash);
  const product = findProduct(route.code);
  if (!product) return;
  syncPick(product);
  const sizes = splitList(product.sizes);
  const colors = splitList(product.colors);
  if (sizes.length && !state.pick.size) { toast('Wybierz rozmiar.'); return; }
  if (colors.length && !state.pick.color) { toast('Wybierz kolor.'); return; }
  const stock = stockOf(product);
  if (stock != null && stock <= 0) { toast('Wyprzedane.'); return; }
  const result = upsertLine(state.basket, {
    product_id: product.id,
    code: String(product.code || ''),
    title: String(product.title || 'Produkt'),
    price: Number(product.price) || 0,
    qty: state.pick.qty || 1,
    size: state.pick.size || '',
    color: state.pick.color || '',
    photo: photoList(product)[0] || '',
  }, stock == null ? undefined : stock);
  setBasket(result.lines);
  const count = document.getElementById('cart-count');
  const n = countPieces();
  if (count) count.textContent = n ? String(n) : '';
  const link = document.querySelector('.cartlink');
  if (link) link.setAttribute('aria-label', `Koszyk, ${n} szt.`);
  toast(result.added > 0 ? 'Dodano do koszyka.' : 'W koszyku jest już cały dostępny stan.');
}

function onClick(event) {
  const target = event.target.closest('[data-act]');
  if (!target) return;
  const act = target.dataset.act;
  if (act === 'reload') { loadProducts(); return; }
  if (act === 'luck') {
    const el = document.getElementById('slogan');
    if (!el) return;
    el.textContent = pickSlogan();
    el.hidden = false;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    return;
  }
  if (act === 'gal') { scrollGallery(Number(target.dataset.dir) || 1); return; }
  if (act === 'dot') {
    const gallery = document.getElementById('gallery');
    const idx = Number(target.dataset.idx) || 0;
    if (gallery) gallery.scrollTo({ left: idx * gallery.clientWidth, behavior: 'smooth' });
    return;
  }
  if (act === 'install') { offerInstallPrompt(); return; }
  if (act === 'pick') {
    const kind = target.dataset.kind;
    const product = findProduct(state.pick.code);
    if (!product || (kind !== 'size' && kind !== 'color')) return;
    const options = splitList(kind === 'size' ? product.sizes : product.colors);
    const chosen = chooseOption(state.pick[kind], target.dataset.val || '', options);
    if (kind === 'size') state.pick.size = chosen;
    else state.pick.color = chosen;
    document.querySelectorAll('[data-act="pick"]').forEach((button) => {
      const selected = button.dataset.kind === 'size' ? state.pick.size : state.pick.color;
      const on = button.dataset.kind === kind ? button.dataset.val === chosen : button.dataset.val === selected;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    return;
  }
  if (act === 'pqty') {
    const product = findProduct(state.pick.code);
    const max = addRoom(product);
    if (max < 1) return;
    state.pick.qty = Math.min(max, Math.max(1, state.pick.qty + (Number(target.dataset.dir) || 0)));
    const label = document.getElementById('pqty');
    if (label) label.textContent = String(state.pick.qty);
    document.querySelectorAll('[data-act="pqty"]').forEach((button) => {
      const dir = Number(button.dataset.dir);
      button.disabled = (dir < 0 && state.pick.qty <= 1) || (dir > 0 && state.pick.qty >= max);
    });
    return;
  }
  if (act === 'add') { addCurrent(); return; }
  if (act === 'lqty' || act === 'drop') {
    const key = target.dataset.key || '';
    const line = state.basket.find((item) => lineKey(item) === key);
    const product = line ? productById(line.product_id) : null;
    const stock = product ? stockOf(product) : null;
    if (act === 'drop') setBasket(setLineQty(state.basket, key, 0, stock == null ? undefined : stock));
    else setBasket(setLineQty(state.basket, key, (line?.qty || 1) + (Number(target.dataset.dir) || 0), stock == null ? undefined : stock));
    paint({ keep: true });
    return;
  }
  if (act === 'copy') { copyFrom(target); }
}

function onInput(event) {
  const el = event.target;
  if (el.id === 'q') {
    state.query = el.value;
    const grid = document.getElementById('grid');
    if (grid) grid.innerHTML = gridHtml();
    const note = document.getElementById('result-note');
    if (note) note.textContent = resultNoteText();
    return;
  }
  const form = el.form;
  if (form && form.id === 'checkout') saveDraft(readCheckout(form));
}

function onChange(event) {
  const input = event.target;
  if (input?.dataset?.proof) {
    const file = input.files && input.files[0];
    input.value = '';
    if (file) sendProof(input.dataset.order, input.dataset.phone, file);
    return;
  }
  const form = input.form;
  if (!form || form.id !== 'checkout') return;
  saveDraft(readCheckout(form));
  syncChoices();
}

function onSubmit(event) {
  const form = event.target;
  if (form.id === 'find-order') {
    event.preventDefault();
    const orderNo = String(form.elements.namedItem('find-no')?.value || '').trim();
    const phone = String(form.elements.namedItem('find-phone')?.value || '');
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(orderNo) || !phoneOk(phone)) {
      toast('Podaj numer zamówienia i telefon — 9 cyfr.');
      return;
    }
    state.mine = rememberOrder(state.mine, { order_no: orderNo, phone, at: new Date().toISOString() });
    writeJson(ORDERS_KEY, state.mine);
    form.reset();
    paint({ keep: true });
    return;
  }
  if (form.id !== 'checkout') return;
  event.preventDefault();
  placeOrder(form);
}

async function sendProof(orderNo, phone, file) {
  if (state.proofBusy) return;
  const kind = proofKind(file);
  if (!kind) {
    state.proofNote[orderNo] = { ok: false, message: 'Wybierz zdjęcie JPG, PNG, WEBP, HEIC albo PDF.' };
    paint({ keep: true });
    return;
  }
  if (file.size > PROOF_MAX_BYTES) {
    state.proofNote[orderNo] = { ok: false, message: 'Plik jest za duży. Maksymalnie 5 MB.' };
    paint({ keep: true });
    return;
  }
  if (!phoneOk(phone)) {
    state.proofNote[orderNo] = { ok: false, message: 'Numer telefonu nie pasuje do zamówienia.' };
    paint({ keep: true });
    return;
  }
  const path = proofObjectPath(orderNo, kind.ext, crypto.randomUUID());
  if (!path) {
    state.proofNote[orderNo] = { ok: false, message: 'Nie udało się zapisać ścieżki potwierdzenia.' };
    paint({ keep: true });
    return;
  }
  state.proofBusy = orderNo;
  paint({ keep: true });
  try {
    const uploaded = await sb.storage.from('shop-proofs').upload(path, file, {
      contentType: kind.contentType,
      upsert: false,
    });
    if (uploaded.error) throw uploaded.error;
    const { data, error } = await sb.rpc('shop_attach_proof', {
      p_order_no: orderNo,
      p_phone: normalizePhone(phone),
      p_path: path,
    });
    if (error) throw error;
    state.proofNote[orderNo] = mapProofResult(data);
  } catch {
    state.proofNote[orderNo] = { ok: false, message: 'Nie udało się wysłać potwierdzenia. Spróbuj jeszcze raz.' };
  }
  state.proofBusy = '';
  paint({ keep: true });
}

export async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

async function copyFrom(button) {
  const ok = await copyText(button.dataset.copy || '');
  const previous = button.dataset.label || button.textContent;
  button.dataset.label = previous === 'Skopiowano' || previous === 'Nie skopiowano' ? 'Kopiuj' : previous;
  button.textContent = ok ? 'Skopiowano' : 'Nie skopiowano';
  setTimeout(() => { button.textContent = button.dataset.label || 'Kopiuj'; }, 2000);
}

async function loadProducts() {
  state.loading = true;
  state.error = '';
  if (!state.loaded) paint({ keep: true });
  const { data, error } = await sb.from('shop_products')
    .select('*')
    .eq('active', true)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: false });
  state.loading = false;
  const hadCatalog = state.loaded;
  if (error) {
    if (!hadCatalog) state.error = 'Nie udało się pobrać produktów.';
  } else {
    state.products = sortProducts(data || []).filter((item) => item.active !== false);
    setBasket(clampBasket(state.basket, state.products));
    state.loaded = true;
    state.error = '';
  }
  paint({ keep: true });
  if (error && hadCatalog) toast('Nie udało się odświeżyć.');
}

function start() {
  state.basket = sanitizeBasket(readJson(BASKET_KEY, []));
  const storedMine = readJson(ORDERS_KEY, []);
  const storedRows = Array.isArray(storedMine) ? storedMine : [];
  state.mine = storedRows.slice().reverse().reduce((list, row) => rememberOrder(list, row), []);
  const storedDraft = readJson(DRAFT_KEY, {});
  state.draft = { ...emptyDraft(), ...(storedDraft && typeof storedDraft === 'object' ? storedDraft : {}) };
  state.thanks = loadThanks();
  const root = document.getElementById('app');
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  window.addEventListener('hashchange', () => paint());
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (!document.getElementById('gallery')) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    event.preventDefault();
    scrollGallery(event.key === 'ArrowRight' ? 1 : -1);
  });
  state.loading = true;
  paint();
  loadProducts();
}

function offerInstallPrompt() {
  const promptEvent = state.installEvent;
  if (!promptEvent) return;
  state.installEvent = null;
  state.installReady = false;
  const button = document.getElementById('install');
  if (button) button.hidden = true;
  promptEvent.prompt();
}

function inStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (inStandalone()) return;
    event.preventDefault();
    state.installEvent = event;
    state.installReady = true;
    const button = document.getElementById('install');
    if (button) button.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    state.installEvent = null;
    state.installReady = false;
    const button = document.getElementById('install');
    if (button) button.hidden = true;
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    });
  }
}

if (typeof document !== 'undefined' && document.getElementById('app')) start();
