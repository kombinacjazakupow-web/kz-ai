import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import {
  SUPABASE_URL, SUPABASE_KEY, BASKET_KEY, DRAFT_KEY, THANKS_KEY, ORDERS_KEY,
  DELIVERY_LABEL, COD_NOTE, MESSENGER_LINE, BLIK_COPY, TRANSFER_COPY,
  LAUNCH_BANNER, PAY_WINDOW, PROOF_LABEL, PROOF_OK, PROOF_MAX_BYTES, LUCKY_LABEL,
  esc, formatZl, formatWhen, photoUrl, photoSrc, videoSrc, hangerSrc, slidePlan, splitList, settleOption, chooseOption, parseRoute, sanitizeBasket, FACEBOOK_LOGIN,
  upsertLine, setLineQty, lineKey, previewTotals, validateCheckout, buildOrderPayload,
  clampBasket, proofKind, proofObjectPath, mapProofResult, pickSlogan, rememberOrder, orderAttemptKey, ORDER_UNSURE, refusedLine,
  mapOrderError, thanksLines, stockProblem, sortProducts, coerceOrder, normalizePostcode, normalizePhone, phoneOk, payPopup, facebookReel, facebookClip, facebookPlayer, soldShopLine,
  META_PIXEL_ID, META_CHOICE_KEY, metaOn, metaPayload, metaPurchase,
} from '#common';
import {
  cleanVariants, colorBasket, colorMoment, colorViews, colorsShareStock, freshBadge, isSoldOut, lineStock, liveStockText, modelPhoto, orderCatalog, roomForColor, stockForColor, variantError,
} from '#variants';
import { dropRail, dotPaint, newestDrop, visibleDots } from '#window';
import { buyLabel } from '#buy';
import { buyerLine, savedBuyerOk, storedBuyer } from '#checkout';
import { LOS_HOME_KEY, keepSlogan, openHomeSurprise } from '#los';
import { reelItems, reelOnScreen } from '#rolki';
import { INSTALL_HIDE_KEY, installKind } from '#install';
import { INTEREST_KEY, SOON, toggleInterest } from '#soon';
import {
  AUTH_STORAGE_KEY, PROMO_SEEN_KEY,
  accountEmptyText, claimCode, claimMessage, emailOk, ignoreSameSignIn, mergeAccountOrders, orderSourceLabel, promoProduct, OTHER_BROWSER_NOTE, SERVICE_LINE, shouldShowPromo,
} from '#account';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: AUTH_STORAGE_KEY,
  },
});

const returnFromEmail = /(?:^|[?&])(code|error|error_description)=/.test(location.search);

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
  variants: [],
  session: null,
  accountLoading: false,
  accountLoaded: false,
  accountLinks: [],
  accountOrders: [],
  accountNote: '',
  accountFailed: false,
  accountDraft: { email: '', phone: '', orderNo: '' },
  accountBusy: false,
  magicSent: false,
  promoOpen: false,
  promoDismissed: false,
  losLine: { home: '', thanks: '' },
  checkoutKey: '',
  payModal: false,
  soldCounts: null,
  soldAsked: false,
  metaView: '',
  metaCheckout: false,
  hangerMuted: true,
  modelHold: '',
  hangerAt: null,
};

let accountGen = 0;
let booted = false;

function emptyDraft() {
  return {
    name: '', phone: '', email: '', street: '', postcode: '', city: '',
    delivery: '', point_code: '', payment: '', note: '', terms: false, remember: false,
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
  const remember = !!draft?.remember;
  state.draft = { ...emptyDraft(), ...draft, remember };
  if (remember) writeJson(DRAFT_KEY, state.draft);
  else {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
  }
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

function thumbHtml(path, alt, eager, width) {
  const full = photoSrc(path, width || (eager ? 800 : 400));
  const tiny = photoSrc(path, 32);
  if (!full) return `<span class="ph" aria-hidden="true">${esc(letter(alt))}</span>`;
  const loading = eager ? 'eager' : 'lazy';
  const priority = eager ? ' fetchpriority="high"' : '';
  return `<span class="blurup"${tiny ? ` style="background-image:url('${esc(tiny)}')"` : ''}>
    <img src="${esc(full)}" alt="${esc(alt)}" loading="${loading}" decoding="async"${priority} data-fallback="${esc(photoUrl(path))}" referrerpolicy="no-referrer">
  </span>`;
}

function colourGone(line) {
  const product = productById(line?.product_id);
  if (!product || !line?.color) return false;
  const views = colorViews(product, state.variants);
  if (!views.length || views.some((view) => view.stock == null)) return false;
  return !views.some((view) => view.name === String(line.color) && view.stock > 0);
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
  const matched = !q ? list : list.filter((item) => {
    const hay = [item.title, item.code, item.description, item.sizes, item.colors]
      .map((part) => String(part || '').toLocaleLowerCase('pl'))
      .join(' ');
    return hay.includes(q);
  });
  return orderCatalog(matched, state.variants);
}

function stockOf(product, color) {
  return stockForColor(product, state.variants, color ?? state.pick.color);
}

function addRoom(product, color = state.pick.color) {
  const held = colorBasket(state.basket, product?.id, color);
  const used = colorsShareStock(product, state.variants) ? held.same + held.other : held.same;
  return roomForColor(stockOf(product, color), used);
}

function allowanceFor(product, color) {
  const held = colorBasket(state.basket, product?.id, color);
  const other = colorsShareStock(product, state.variants) ? 0 : held.other;
  return lineStock(stockOf(product, color), other);
}

function toast(msg, action) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.hidden = false;
  el.replaceChildren(document.createTextNode(msg));
  if (action?.href && action?.label) {
    const link = document.createElement('a');
    link.href = action.href;
    link.textContent = action.label;
    el.append(document.createTextNode(' '));
    el.append(link);
  }
  el.classList.remove('bounce');
  void el.offsetWidth;
  el.classList.add('bounce');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2800);
}

function paint(opts = {}) {
  const root = document.getElementById('app');
  if (!root) return;
  if (parseRoute(location.hash).name !== 'catalog') state.losHold = false;
  const y = opts.keep ? window.scrollY : 0;
  syncPromo();
  document.title = pageTitle();
  root.innerHTML = shell();
  afterPaint();
  window.scrollTo(0, y);
  if (parseRoute(location.hash).name === 'product' && !state.soldAsked) {
    state.soldAsked = true;
    loadSoldCounts();
  }
  noteCommerce();
  if (parseRoute(location.hash).name === 'account' && state.session && !state.accountLoaded && !state.accountLoading) {
    loadAccount();
  }
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
  if (route.name === 'account') return state.session ? 'Twoje zamówienia · KOMBI Sklep' : 'Moje konto · KOMBI Sklep';
  if (route.name === 'reels') return 'Rolki · KOMBI Sklep';
  return 'KOMBI Sklep';
}

function shell() {
  const body = mainView();
  const reels = parseRoute(location.hash).name === 'reels';
  if (reels) return `${body}<div id="toast" class="toast" role="status" hidden></div>`;
  return `${topbar()}<p class="launch">${esc(LAUNCH_BANNER)}</p>${promoHtml()}${body}${footer()}<div id="toast" class="toast" role="status" hidden></div>${cookieBar()}`;
}

function topbar() {
  const n = countPieces();
  return `<header class="top">
    <a class="mark" href="#/">KS</a>
    <div class="top-title"><b>KOMBI</b><small>Sklep</small></div>
    <a class="accountlink" href="#/konto">Moje konto</a>
    <a class="cartlink" href="#/koszyk" aria-label="Koszyk, ${n} szt.">Koszyk <span id="cart-count">${n ? esc(String(n)) : ''}</span></a>
  </header>`;
}

function footer() {
  return `<footer class="footer">
    <button type="button" class="install" id="install" data-act="install"${state.installReady ? '' : ' hidden'}>Zainstaluj aplikację</button>
    <a href="#/rolki">Rolki</a>
    <a href="#/moje">Moje zamówienia</a>
    <a href="regulamin.html">Regulamin</a>
    <a href="prywatnosc.html">Polityka prywatności</a>
    <a href="zwroty.html">Zwroty i reklamacje</a>
    <button type="button" data-act="reload">Odśwież</button>
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
  if (route.name === 'account') return accountMain();
  if (route.name === 'reels') return reelsMain();
  return catalogMain();
}

function catalogMain() {
  return `<main>
    ${heroHtml()}
    ${railHtml()}
    ${installCard()}
    <h2 id="kolekcja">Kolekcja</h2>
    ${homeSurpriseHtml()}
    <input id="q" class="search" type="search" enterkeyhint="search" placeholder="Szukaj" value="${esc(state.query)}" aria-label="Szukaj produktu" autocomplete="off">
    <p id="result-note" class="hint">${esc(resultNoteText())}</p>
    <div id="grid" class="grid">${gridHtml()}</div>
    ${soonHtml()}
  </main>`;
}

function heroHtml() {
  const product = newestDrop(state.products, state.variants);
  if (!product) return '';
  const film = videoSrc(product.video_url);
  const media = film
    ? `<video class="hero-video" autoplay muted loop playsinline src="${esc(film)}"></video>`
    : `<div class="hero-photo">${thumbHtml(photoList(product)[0], product.title || 'Nowość', true, 800)}</div>`;
  return `<section class="hero">
    ${media}
    <p class="eyebrow">NOWOŚCI JUŻ SĄ</p>
    <h1>${esc(product.title || 'Nowości')}</h1>
    <p class="price">${esc(formatZl(product.price))}</p>
    <button type="button" class="btn primary" data-act="kolekcja">Zobacz kolekcję</button>
  </section>`;
}

function railHtml() {
  const list = dropRail(state.products, state.variants);
  if (!list.length) return '';
  const cards = list.map((product) => {
    const code = encodeURIComponent(String(product.code || ''));
    return `<a class="rail-card" href="#/p/${code}">
      <span class="thumb">${thumbHtml(photoList(product)[0], product.title || 'Produkt', false, 400)}</span>
      <span class="card-title">${esc(product.title || 'Produkt')}</span>
      <span class="price">${esc(formatZl(product.price))}</span>
    </a>`;
  }).join('');
  return `<section class="rail" aria-label="Nowość dnia"><h2>Nowość dnia</h2><div class="rail-row">${cards}</div></section>`;
}

function dotHtml(product) {
  const dots = visibleDots(colorViews(product, state.variants));
  if (!dots.length) return '';
  return `<span class="dots-row">${dots.map((view) => `<i class="dot" style="background:${esc(dotPaint(view.name))}" title="${esc(view.name)}"></i>`).join('')}</span>`;
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
    const badge = freshBadge(product, state.variants);
    const sold = isSoldOut(product, state.variants);
    const badgeHtml = badge
      ? `<span class="badge${sold ? ' sold' : ''}">${esc(badge)}</span>`
      : '';
    const code = encodeURIComponent(String(product.code || ''));
    return `<a class="card${sold ? ' sold' : ''}" href="#/p/${code}">
      <span class="thumb">${thumbHtml(photoList(product)[0], product.title || 'Produkt', index < 2)}${badgeHtml}</span>
      <span class="card-title">${esc(product.title || 'Produkt')}</span>
      ${dotHtml(product)}
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
  const hanger = hangerSrc(product.hanger_video_url);
  const reel = hanger ? '' : facebookReel(product.reel_url);
  const film = hanger || reel ? '' : videoSrc(product.video_url);
  const filmSlide = reel
    ? reelPoster(product, photos[0], reel)
    : film
      ? `<video class="product-video" autoplay muted loop playsinline src="${esc(film)}"></video>`
      : '';
  const realSlides = filmSlide + (photos.length
    ? photos.map((path) => thumbHtml(path, product.title || 'Produkt', true, 800)).join('')
    : '');
  const slides = realSlides || (hanger ? '' : `<span class="ph">${esc(letter(product.title))}</span>`);
  const plan = slidePlan(Boolean(reel || film), photos.length);
  const labels = [...(reel || film ? ['Film'] : []), ...photos.map((_, i) => `Zdjęcie ${i + 1}`)];
  const nav = plan.controls
    ? `<button type="button" class="gal-nav prev" data-act="gal" data-dir="-1" aria-label="Poprzednie zdjęcie">‹</button>
       <button type="button" class="gal-nav next" data-act="gal" data-dir="1" aria-label="Następne zdjęcie">›</button>`
    : '';
  const dots = plan.controls
    ? `<div class="dots" id="dots">${labels.map((label, i) => `<button type="button" data-act="dot" data-idx="${i}" aria-label="${label}"${i === 0 ? ' class="on"' : ''}></button>`).join('')}</div><p id="gal-live" class="sr" aria-live="polite"></p>`
    : '';
  const badge = freshBadge(product, state.variants);
  const sold = isSoldOut(product, state.variants);
  const sizes = splitList(product.sizes);
  const left = addRoom(product);
  if (left > 0 && state.pick.qty > left) state.pick.qty = left;
  const max = Math.max(left, 1);
  const heldHere = !sold && left < 1;
  const buy = sold
    ? '<p class="badge sold" style="position:static;display:inline-block">WYPRZEDANE</p>'
    : `${chips('size', 'Rozmiar', sizes, state.pick.size)}${colorChips(product)}
      ${heldHere ? '<p>W koszyku jest już cały dostępny stan.</p>' : `<div class="stepper" aria-label="Ilość">
        <button type="button" data-act="pqty" data-dir="-1" aria-label="Mniej" ${state.pick.qty <= 1 ? 'disabled' : ''}>−</button>
        <span id="pqty">${esc(String(state.pick.qty))}</span>
        <button type="button" data-act="pqty" data-dir="1" aria-label="Więcej" ${state.pick.qty >= max ? 'disabled' : ''}>+</button>
      </div>`}`;
  const desc = String(product.description || '').trim();
  const gallery = slides
    ? `<div class="gal-wrap">
      <div class="gallery${reel ? ' reel-gallery' : ''}" id="gallery" tabindex="0" aria-label="Zdjęcia produktu">${slides}</div>
      ${nav}
    </div>
    ${dots}`
    : '';
  return `<main class="product-page">
    <p><a class="back" href="#/">← Sklep</a></p>
    ${hanger ? hangerPair(product, hanger) : ''}
    ${gallery}
    ${liveSection(product)}
    <h1>${esc(product.title || 'Produkt')}</h1>
    <p class="price">${esc(formatZl(product.price))}</p>
    ${badge && !sold ? `<p><span class="badge" style="position:static">${esc(badge)}</span></p>` : ''}
    ${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
    ${buy}
    <div class="buybar"><button type="button" class="btn primary block" data-act="add" ${sold || heldHere ? 'disabled' : ''}>${esc(buyLabel(formatZl(product.price), sold))}</button></div>
  </main>`;
}

function hangerPair(product, src) {
  const shot = modelPhoto(product, state.pick.color, state.variants, state.modelHold);
  state.modelHold = shot.hold;
  const left = shot.photo
    ? `<div class="hanger-panel"><h2>Modelka AI</h2><div class="hanger-photo" id="model-photo">${thumbHtml(shot.photo, 'Modelka AI', true, 800)}</div></div>`
    : '';
  const quiet = state.hangerMuted !== false;
  return `<section class="hanger-pair${left ? '' : ' solo'}" aria-label="Modelka i film z wieszaka">
    ${left}
    <div class="hanger-panel">
      <h2>Film z wieszaka</h2>
      <button type="button" class="hanger-sound" data-act="hanger-sound" aria-pressed="${quiet ? 'false' : 'true'}" aria-label="${quiet ? 'Włącz dźwięk' : 'Wycisz'}">
        <video class="hanger-video" ${quiet ? 'muted' : ''} playsinline loop preload="metadata" src="${esc(src)}"></video>
      </button>
    </div>
  </section>`;
}

function liveSection(product) {
  const stock = liveStockText(product, state.variants);
  const sold = state.soldCounts ? soldShopLine(state.soldCounts[String(product.code || '')]) : '';
  const reel = facebookReel(product.reel_url);
  const clip = facebookClip(product.live_clip_url);
  if (!stock && !sold && !reel && !clip) return '';
  return `<section class="live-note" aria-labelledby="live-heading">
    <h2 id="live-heading">Jak na live</h2>
    ${stock ? `<p>${esc(stock)}</p>` : ''}
    ${sold ? `<p>${esc(sold)}</p>` : ''}
    ${reel ? `<p><a href="${esc(reel)}" target="_blank" rel="noopener noreferrer">Zobacz film i komentarze na Facebooku</a></p>` : ''}
    ${clip ? `<div class="clip-slide" data-embed="${esc(clip)}"><button type="button" class="btn ghost block" data-act="clip-play">Fragment z live</button></div>` : ''}
  </section>`;
}

function reelPoster(product, photo, reel) {
  const poster = photo
    ? thumbHtml(photo, product.title || 'Produkt', true, 800)
    : `<span class="ph">${esc(letter(product.title))}</span>`;
  return `<div class="reel-slide" data-embed="${esc(reel)}">
    <button type="button" class="reel-poster" data-act="reel-play" aria-label="Odtwórz rolkę">
      ${poster}
      <span class="reel-play" aria-hidden="true">▶</span>
    </button>
  </div>`;
}

function mountFacebook(host, title) {
  if (!host || host.querySelector('iframe')) return;
  const autoplay = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const src = facebookPlayer(host.dataset.embed, autoplay);
  if (!src) return;
  const frame = document.createElement('iframe');
  frame.src = src;
  frame.title = title;
  frame.setAttribute('allow', 'autoplay; fullscreen');
  frame.setAttribute('allowfullscreen', '');
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  host.replaceChildren(frame);
}

function colorChips(product) {
  const views = colorViews(product, state.variants);
  if (!views.length) return '';
  const buttons = views.map((view) => {
    const gone = view.stock === 0;
    const on = !gone && view.name === state.pick.color;
    if (gone) {
      return `<button type="button" class="chip gone" disabled aria-pressed="false"><s>${esc(view.name)}</s> wyprzedane</button>`;
    }
    return `<button type="button" class="chip${on ? ' on' : ''}" data-act="pick" data-kind="color" data-val="${esc(view.name)}" aria-pressed="${on ? 'true' : 'false'}">${esc(view.name)}</button>`;
  }).join('');
  return `<fieldset class="chips"><legend>Kolor</legend><div class="chip-row">${buttons}</div></fieldset>`;
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
  const open = lines.filter((line) => !colourGone(line));
  const totals = previewTotals(open);
  const rows = lines.map((line) => {
    const meta = [line.size, line.color].filter(Boolean).join(' · ');
    const gone = colourGone(line);
    const product = productById(line.product_id);
    const stock = product ? stockOf(product, line.color) : null;
    const cap = stock == null ? 99 : Math.max(0, stock);
    return `<article class="line">
      <div class="thumb">${thumbHtml(line.photo, line.title, false)}</div>
      <div>
        <h2>${esc(line.title)}</h2>
        ${meta ? `<p class="muted">${esc(meta)}</p>` : ''}
        ${gone ? '<p class="badge sold" style="position:static">Ten kolor jest wyprzedany</p>' : `<p class="price">${esc(formatZl(line.price))} · ${esc(formatZl(line.price * line.qty))}</p>`}
        <div class="line-actions">
          ${gone ? '' : `<div class="stepper">
            <button type="button" data-act="lqty" data-key="${esc(lineKey(line))}" data-dir="-1" aria-label="Mniej">−</button>
            <span>${esc(String(line.qty))}</span>
            <button type="button" data-act="lqty" data-key="${esc(lineKey(line))}" data-dir="1" aria-label="Więcej" ${line.qty >= cap ? 'disabled' : ''}>+</button>
          </div>`}
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
  const totals = previewTotals(lines.filter((line) => !colourGone(line)));
  const summary = lines.map((line) => {
    const meta = [line.size, line.color].filter(Boolean).join(' · ');
    const gone = colourGone(line);
    const problem = gone || (state.problemCode && line.code === state.problemCode);
    const note = gone ? ' — Ten kolor jest wyprzedany' : (problem ? ' — Ten produkt właśnie się wyprzedał.' : '');
    return `<p class="${problem ? 'problem' : ''}">${esc(line.title)}${meta ? ` · ${esc(meta)}` : ''} × ${esc(String(line.qty))} — ${esc(formatZl((Number(line.price) || 0) * line.qty))}${esc(note)}</p>`;
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
      ${buyerFields(draft, err)}
      <label class="check">
        <input id="remember" name="remember" type="checkbox"${draft.remember ? ' checked' : ''}>
        <span>Zapamiętaj imię, telefon i adres na tym telefonie</span>
      </label>
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

function buyerFields(draft, err) {
  if (savedBuyerOk(draft) && draft.remember && !state.editBuyer) {
    const hidden = ['name', 'phone', 'email', 'street', 'postcode', 'city']
      .map((key) => `<input type="hidden" name="${key}" value="${esc(draft[key] || '')}">`)
      .join('');
    return `<div class="note-box remembered">
      <p>${esc(buyerLine(draft))}</p>
      <button type="button" class="btn ghost" data-act="edit-buyer">Popraw</button>
      <button type="button" class="btn ghost" data-act="not-me">to nie ja</button>
      ${hidden}
    </div>`;
  }
  return `${field('name', 'Imię i nazwisko', draft.name, 'text', err.name, 'autocomplete="name"')}
      ${field('phone', 'Telefon', draft.phone, 'tel', err.phone, 'autocomplete="tel" inputmode="tel"')}
      ${field('email', 'E-mail (nieobowiązkowy)', draft.email, 'email', err.email, 'autocomplete="email" inputmode="email"')}
      ${field('street', 'Ulica i numer', draft.street, 'text', err.street, 'autocomplete="street-address"')}
      ${field('postcode', 'Kod pocztowy', draft.postcode, 'text', err.postcode, 'autocomplete="postal-code" inputmode="numeric" maxlength="6" placeholder="00-000"')}
      ${field('city', 'Miasto', draft.city, 'text', err.city, 'autocomplete="address-level2"')}`;
}

function readInterest() {
  if (Array.isArray(state.interest)) return state.interest;
  const stored = readJson(INTEREST_KEY, []);
  state.interest = Array.isArray(stored) ? stored : [];
  return state.interest;
}

function soonHtml() {
  const saved = readInterest();
  const cards = SOON.map((item) => {
    const on = saved.includes(item.id);
    return `<article class="soon-card">
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.text)}</p>
      <button type="button" class="btn" data-act="interest" data-id="${esc(item.id)}" aria-pressed="${on ? 'true' : 'false'}">${on ? 'Zapisane tylko na tym telefonie' : 'Zapisz na tym telefonie'}</button>
    </article>`;
  }).join('');
  return `<section class="soon"><h2>Wkrótce</h2><p class="hint">Nie wysyłamy tego nikomu. Zapis zostaje tylko na tym telefonie.</p>${cards}</section>`;
}

function installCard() {
  if (state.installHide || inStandalone()) return '';
  const kind = installKind({
    ua: navigator.userAgent,
    standalone: inStandalone(),
    promptReady: state.installReady,
  });
  if (kind === 'installed' || kind === 'other') return '';
  const hide = '<button type="button" class="btn ghost" data-act="install-hide">Nie teraz</button>';
  if (kind === 'ios') {
    return `<aside class="install-card"><p>Dodaj sklep na telefon</p><ol><li>Stuknij Udostępnij</li><li>Wybierz Do ekranu początkowego</li></ol>${hide}</aside>`;
  }
  if (kind === 'android') {
    return `<aside class="install-card"><p>Dodaj sklep na telefon</p><button type="button" class="btn primary" data-act="install">Zainstaluj</button>${hide}</aside>`;
  }
  return `<aside class="install-card"><p>W Chrome otwórz menu i wybierz Dodaj do ekranu głównego.</p>${hide}</aside>`;
}

function reelsMain() {
  const films = reelItems(state.products);
  if (!films.length) {
    return `<main class="center"><h1>Rolki</h1><p>Nie ma jeszcze filmów.</p><p><a class="btn primary" href="#/">Wróć do sklepu</a></p></main>`;
  }
  const cards = films.map((item) => {
    const code = encodeURIComponent(String(item.code || ''));
    return `<section class="reel">
      <video muted playsinline loop src="${esc(videoSrc(item.video_url))}"></video>
      <a class="reel-back" href="#/">← Sklep</a>
      <div class="reel-bar">
        <p class="reel-title">${esc(item.title || 'Produkt')}</p>
        <a class="btn primary" href="#/p/${code}">Kup teraz</a>
        <button type="button" class="btn" data-act="sound">Włącz dźwięk</button>
      </div>
    </section>`;
  }).join('');
  return `<main class="reels">${cards}</main>`;
}

function homeSurpriseHtml() {
  let seen = '';
  try { seen = sessionStorage.getItem(LOS_HOME_KEY) || ''; } catch { seen = '1'; }
  const next = openHomeSurprise(seen, !!state.losHold);
  state.losHold = next.hold;
  if (next.mark) {
    try { sessionStorage.setItem(LOS_HOME_KEY, '1'); } catch { /* private mode still shows it in this paint */ }
  }
  return next.show ? losCard('home') : '';
}

function losCard(place) {
  const line = state.losLine?.[place] || '';
  return `<button type="button" class="los${line ? ' flipped' : ''}" data-act="los" data-place="${place}" aria-pressed="${line ? 'true' : 'false'}" aria-label="${esc(LUCKY_LABEL)}">
    <span class="los-inner">
      <span class="los-face los-front"><small>Niespodzianka</small><b>${esc(LUCKY_LABEL)}</b></span>
      <span class="los-face los-back">${esc(line)}</span>
    </span>
  </button>`;
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
    ${losCard('thanks')}
    <p>${esc(MESSENGER_LINE)}</p>
    <p><a class="btn primary block" href="#/">Wróć do sklepu</a></p>
  </main>${state.payModal ? payModalHtml(order) : ''}`;
}

function payModalHtml(order) {
  const popup = payPopup(order);
  if (!popup) return '';
  const row = (text, copy, label) => `<div class="copyline"><p>${esc(text)}</p><button type="button" class="btn ghost" data-act="copy" data-copy="${esc(copy)}" aria-label="${esc(label)}">Kopiuj</button></div>`;
  return `<div class="pay-shade" id="pay-modal" role="dialog" aria-modal="true" aria-labelledby="pay-title">
    <div class="pay-card">
      <h2 id="pay-title">${esc(popup.title)}</h2>
      ${row(`Do zapłaty teraz: ${popup.amountText}`, popup.copies.amount, 'Kopiuj kwotę')}
      ${row(popup.blik, popup.copies.blik, 'Kopiuj numer BLIK')}
      ${row(popup.transfer, popup.copies.transfer, 'Kopiuj numer konta')}
      ${row(popup.titleLine, popup.copies.orderNo, 'Kopiuj numer zamówienia')}
      <button type="button" class="btn primary block" data-act="pay-close">Rozumiem</button>
    </div>
  </div>`;
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

function syncPromo() {
  const route = parseRoute(location.hash).name;
  const homeish = route === 'catalog' || route === 'account';
  if (!homeish || state.promoDismissed) {
    state.promoOpen = false;
    return;
  }
  if (state.promoOpen) return;
  let seen = false;
  try { seen = sessionStorage.getItem(PROMO_SEEN_KEY) === '1'; } catch { seen = false; }
  if (!shouldShowPromo(route, state.products, seen)) return;
  try { sessionStorage.setItem(PROMO_SEEN_KEY, '1'); } catch { /* private mode still shows it once in memory */ }
  state.promoOpen = true;
}

function promoHtml() {
  if (!state.promoOpen) return '';
  const product = promoProduct(state.products);
  if (!product) return '';
  const photo = photoList(product)[0];
  const code = encodeURIComponent(String(product.code || ''));
  return `<aside class="promo" id="promo">
    ${thumbHtml(photo, product.title || 'Paczka', true)}
    <span class="promo-copy">
      <strong>${esc(product.title || 'Paczka')}</strong>
      <span class="price">${esc(formatZl(product.price))}</span>
      <a class="btn primary" href="#/p/${code}">Zobacz</a>
    </span>
    <button type="button" class="promo-x" data-act="promo-close" aria-label="Zamknij">×</button>
  </aside>`;
}

function accountMain() {
  if (!state.session) return accountLogin();
  return accountOrdersView();
}

function accountNoteHtml() {
  if (!state.accountNote) return '';
  return `<p class="note-box" role="status">${esc(state.accountNote)}</p>`;
}

function accountLogin() {
  return `<main>
    <h1>Moje konto</h1>
    <p class="hint">Wyślemy link do logowania na e-mail. Hasło nie jest potrzebne.</p>
    ${accountNoteHtml()}
    <p class="service">${esc(SERVICE_LINE)}</p>
    ${FACEBOOK_LOGIN ? '<p><button type="button" class="btn block" data-act="facebook">Zaloguj przez Facebooka</button></p>' : ''}
    <form id="magic-link">
      ${field('email', 'E-mail', state.accountDraft.email, 'email', '', 'autocomplete="email" inputmode="email" maxlength="200"')}
      <button type="submit" class="btn primary block" ${state.accountBusy ? 'disabled' : ''}>Wyślij link logowania</button>
    </form>
  </main>`;
}

function accountOrdersView() {
  if (!state.accountLoaded) {
    return `<main>
      <h1>Twoje zamówienia</h1>
      <p><button type="button" class="btn ghost" data-act="logout">Wyloguj</button></p>
      <p>Ładowanie…</p>
    </main>`;
  }
  const claim = state.accountLinks.length
    ? ''
    : `<form id="claim-order">
        <p class="hint">Podaj telefon i numer jednego zamówienia (KS albo Selmo), żeby pokazać resztę.</p>
        ${field('claim-phone', 'Telefon', state.accountDraft.phone, 'tel', '', 'inputmode="tel" autocomplete="tel"')}
        ${field('claim-no', 'Numer zamówienia', state.accountDraft.orderNo, 'text', '', 'autocapitalize="characters" spellcheck="false" maxlength="40"')}
        <button type="submit" class="btn primary block" ${state.accountBusy ? 'disabled' : ''}>Pokaż zamówienia</button>
      </form>`;
  return `<main>
    <h1>Twoje zamówienia</h1>
    <p><button type="button" class="btn ghost" data-act="logout">Wyloguj</button></p>
    ${accountNoteHtml()}
    ${claim}
    ${state.accountFailed ? '' : (state.accountLinks.length ? accountOrderCards() : `<p>${esc(accountEmptyText(0))}</p>`)}
    <p class="service">${esc(SERVICE_LINE)}</p>
  </main>`;
}

function accountOrderCards() {
  if (!state.accountOrders.length) return `<p>${esc(accountEmptyText(0))}</p>`;
  return state.accountOrders.map((order) => {
    const lines = order.lines.map((line) => `<li>${esc(line)}</li>`).join('');
    const track = order.track
      ? `<p><a class="btn" href="${esc(order.track)}" target="_blank" rel="noopener noreferrer">Śledź paczkę</a></p>`
      : '';
    return `<article class="order">
      <p class="order-source">${esc(orderSourceLabel(order.source))}</p>
      <header>
        <time>${esc(formatWhen(order.created_at))}</time>
        <strong class="price">${esc(order.order_no)}</strong>
        <span class="status">${esc(order.status)}</span>
      </header>
      ${lines ? `<ul class="order-lines">${lines}</ul>` : ''}
      <p class="price">${esc(formatZl(order.amount))}</p>
      ${track}
    </article>`;
  }).join('');
}

function clearAccount() {
  accountGen += 1;
  state.accountLoading = false;
  state.accountLoaded = false;
  state.accountLinks = [];
  state.accountOrders = [];
  state.accountBusy = false;
  state.accountFailed = false;
}

async function loadAccount() {
  if (!state.session) return;
  const gen = ++accountGen;
  state.accountLoading = true;
  state.accountLoaded = false;
  try {
    const links = await sb.from('shop_customer_links').select('phone9');
    if (gen !== accountGen) return;
    if (links.error) throw links.error;
    state.accountLinks = links.data || [];
    if (!state.accountLinks.length) {
      state.accountOrders = [];
      state.accountLoaded = true;
      state.accountLoading = false;
      state.accountFailed = false;
      paint({ keep: true });
      return;
    }
    const [shopRes, extRes] = await Promise.all([
      sb.from('shop_orders').select('id,order_no,created_at,status,products_total,delivery_fee').order('created_at', { ascending: false }),
      sb.from('ext_orders').select('order_no,created_at,status,products_total,items,dpd_waybill,dpd_state').order('created_at', { ascending: false }),
    ]);
    if (gen !== accountGen) return;
    if (shopRes.error) throw shopRes.error;
    if (extRes.error) throw extRes.error;
    const ids = (shopRes.data || []).map((order) => order.id).filter(Boolean);
    let shopItems = [];
    if (ids.length) {
      const itemsRes = await sb.from('shop_order_items').select('order_id,title,size,color,qty').in('order_id', ids);
      if (gen !== accountGen) return;
      if (itemsRes.error) throw itemsRes.error;
      shopItems = itemsRes.data || [];
    }
    state.accountOrders = mergeAccountOrders(shopRes.data || [], shopItems, extRes.data || []);
    state.accountLoaded = true;
    state.accountFailed = false;
    state.accountNote = state.accountNote && state.accountNote.startsWith('Numer dopisany') ? state.accountNote : '';
  } catch {
    if (gen !== accountGen) return;
    state.accountOrders = [];
    state.accountLoaded = true;
    state.accountFailed = true;
    state.accountNote = 'Nie udało się pobrać zamówień.';
  }
  state.accountLoading = false;
  paint({ keep: true });
}

function rememberAccount(form) {
  if (!form) return;
  if (form.id === 'magic-link') state.accountDraft.email = String(form.elements.namedItem('email')?.value || '');
  if (form.id === 'claim-order') {
    state.accountDraft.phone = String(form.elements.namedItem('claim-phone')?.value || '');
    state.accountDraft.orderNo = String(form.elements.namedItem('claim-no')?.value || '');
  }
}

async function sendMagic(form) {
  if (state.accountBusy) return;
  rememberAccount(form);
  const email = state.accountDraft.email.trim();
  if (!emailOk(email)) {
    state.accountNote = 'Podaj adres e-mail.';
    state.magicSent = false;
    paint({ keep: true });
    return;
  }
  state.accountBusy = true;
  state.accountNote = '';
  paint({ keep: true });
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  state.accountBusy = false;
  state.magicSent = !error;
  state.accountNote = error
    ? 'Nie udało się wysłać linku. Spróbuj jeszcze raz.'
    : 'Wysłaliśmy link. Otwórz go na tym telefonie.';
  paint({ keep: true });
}

async function claimOrders(form) {
  if (state.accountBusy) return;
  rememberAccount(form);
  const phone = state.accountDraft.phone;
  const orderNo = state.accountDraft.orderNo.trim();
  if (!phoneOk(phone) || !orderNo) {
    state.accountNote = claimMessage('input');
    paint({ keep: true });
    return;
  }
  state.accountBusy = true;
  state.accountNote = '';
  paint({ keep: true });
  let code = '';
  try {
    const { data, error } = await sb.rpc('shop_claim_orders', {
      p_phone: normalizePhone(phone),
      p_order_no: orderNo,
    });
    if (!error) code = claimCode(data);
  } catch {
    code = '';
  }
  state.accountBusy = false;
  state.accountNote = claimMessage(code);
  if (code === 'ok') {
    state.accountLoaded = false;
    state.accountLinks = [];
  }
  paint({ keep: true });
}

async function logout() {
  clearAccount();
  state.magicSent = false;
  state.accountNote = '';
  state.editBuyer = false;
  saveDraft(emptyDraft());
  try { await sb.auth.signOut({ scope: 'local' }); } catch { /* listener clears the screen */ }
  state.session = null;
  paint();
}

function ordersMain() {
  const cards = state.mine.filter((order) => Number.isFinite(Number(order.to_pay_now))).map((order) => {
    const rows = thanksLines(order).map((line, index) => {
      const copy = copyValue(line, order, index);
      return `<div class="copyline"><p>${esc(line)}</p><button type="button" class="btn ghost" data-act="copy" data-copy="${esc(copy)}">Kopiuj</button></div>`;
    }).join('');
    return `<article class="order">
      <header><strong class="price">${esc(order.order_no)}</strong></header>
      <div class="paybox">${rows}</div>
      ${proofBox(order.order_no, order.phone)}
    </article>`;
  }).join('');
  return `<main>
    <h1>Moje zamówienia</h1>
    <p class="hint">Kwota i dane do przelewu zostają w tym telefonie razem z zamówieniem złożonym tutaj.</p>
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
  focusPayModal();
  watchReels();
  watchHanger();
  const gallery = document.getElementById('gallery');
  const dots = document.getElementById('dots');
  if (!gallery || !dots) return;
  const mark = () => {
    const index = Math.round(gallery.scrollLeft / Math.max(gallery.clientWidth, 1));
    dots.querySelectorAll('button').forEach((button, i) => button.classList.toggle('on', i === index));
    const live = document.getElementById('gal-live');
    if (live) {
      const label = dots.children[index]?.getAttribute('aria-label') || '';
      live.textContent = label ? `${label}, ${index + 1} z ${dots.children.length}` : '';
    }
  };
  gallery.addEventListener('scroll', mark, { passive: true });
  mark();
}

function focusPayModal() {
  const dialog = document.getElementById('pay-modal');
  if (!dialog) return;
  document.querySelectorAll('#app > :not(#pay-modal)').forEach((el) => { el.inert = true; });
  const items = () => [...dialog.querySelectorAll('button')];
  items()[items().length - 1]?.focus();
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      state.payModal = false;
      paint({ keep: true });
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = items();
    if (!buttons.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function watchHanger() {
  const video = document.querySelector('.hanger-video');
  if (!video) return;
  video.muted = state.hangerMuted !== false;
  seekHanger(video);
  const play = () => video.play().catch(() => {});
  if (typeof IntersectionObserver !== 'function') {
    play();
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) entry.target.play().catch(() => {});
      else entry.target.pause();
    }
  }, { threshold: [0, 0.6, 1] });
  observer.observe(video);
}

function seekHanger(video) {
  const route = parseRoute(location.hash);
  const product = route.name === 'product' ? findProduct(route.code) : null;
  if (!product) return;
  const seconds = colorMoment(product, state.pick.color, state.variants);
  const at = seconds == null ? state.hangerAt : seconds;
  if (at == null || !Number.isFinite(Number(at))) return;
  const apply = () => {
    try { video.currentTime = Number(at); } catch { /* the film is not ready yet */ }
    video.play().catch(() => {});
  };
  if (video.readyState >= 1) apply();
  else video.addEventListener('loadedmetadata', apply, { once: true });
}

function watchReels() {
  const root = document.querySelector('main.reels');
  if (!root) return;
  const videos = [...root.querySelectorAll('video')];
  if (!videos.length) return;
  if (typeof IntersectionObserver !== 'function') {
    videos[0].play().catch(() => {});
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target;
      if (reelOnScreen(entry.intersectionRatio) && entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }
  }, { root, threshold: [0, 0.6, 1] });
  videos.forEach((video) => observer.observe(video));
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
    remember: !!form.elements.namedItem('remember')?.checked,
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
  const checked = validateCheckout(input, lines.filter((line) => !colourGone(line)));
  const stockMsg = state.loaded ? stockProblem(lines, state.products, state.variants) : '';
  if (!checked.ok || stockMsg) {
    if (['name', 'phone', 'email', 'street', 'postcode', 'city'].some((key) => checked.errors[key])) {
      state.editBuyer = true;
    }
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
  state.checkoutKey = orderAttemptKey(state.checkoutKey);
  const payload = buildOrderPayload(input, lines, state.checkoutKey);
  let failed = '';
  try {
    const { data, error } = await sb.rpc('shop_place_order', { p: payload });
    if (error) {
      failed = /failed to fetch|network|load failed/i.test(`${error.message || ''}`)
        ? ORDER_UNSURE
        : 'Nie udało się złożyć zamówienia. Spróbuj jeszcze raz.';
    } else {
      const body = coerceOrder(data);
      if (body?.error) {
        failed = refusedLine(body.error, lines) || variantError(body.error) || mapOrderError(body.error);
        state.problemCode = '';
        const raw = String(body.error);
        if (raw.startsWith('color:') || raw.startsWith('out_of_stock:')) loadVariants();
      } else if (!body?.order_no) {
        failed = ORDER_UNSURE;
      } else {
        state.checkoutKey = '';
        const thanks = {
          order_no: body.order_no,
          products_total: body.products_total,
          delivery_fee: body.delivery_fee,
          to_pay_now: body.to_pay_now,
          cod_amount: body.cod_amount,
          payment: payload.payment,
          phone: payload.phone,
        };
        saveThanks(thanks);
        state.payModal = !!payPopup(thanks);
        const purchase = metaPurchase(body.to_pay_now, body.order_no);
        if (purchase) trackMeta(purchase.event, purchase.params, purchase.eventID);
        setBasket([]);
        saveDraft({ ...state.draft, note: '', terms: false });
      }
    }
  } catch {
    failed = ORDER_UNSURE;
  }
  state.busy = false;
  state.formError = failed;
  paint();
  if (failed) focusError();
}

function syncPick(product) {
  const sizes = splitList(product.sizes);
  const available = colorViews(product, state.variants)
    .filter((view) => view.stock == null || view.stock > 0)
    .map((view) => view.name);
  if (state.pick.code !== String(product.code)) {
    state.pick = { code: String(product.code), size: '', color: '', qty: 1 };
    state.modelHold = '';
    state.hangerAt = null;
  }
  state.pick.size = settleOption(sizes, state.pick.size);
  state.pick.color = settleOption(available, state.pick.color);
}

function addCurrent() {
  const route = parseRoute(location.hash);
  const product = findProduct(route.code);
  if (!product) return;
  syncPick(product);
  const sizes = splitList(product.sizes);
  const colors = colorViews(product, state.variants).filter((view) => view.stock == null || view.stock > 0);
  if (sizes.length && !state.pick.size) { toast('Wybierz rozmiar.'); return; }
  if (colors.length && !state.pick.color) { toast('Wybierz kolor.'); return; }
  const stock = stockOf(product, state.pick.color);
  if (stock != null && stock <= 0) { toast('Wyprzedane.'); return; }
  const allowance = allowanceFor(product, state.pick.color);
  const result = upsertLine(state.basket, {
    product_id: product.id,
    code: String(product.code || ''),
    title: String(product.title || 'Produkt'),
    price: Number(product.price) || 0,
    qty: state.pick.qty || 1,
    size: state.pick.size || '',
    color: state.pick.color || '',
    photo: photoList(product)[0] || '',
  }, allowance);
  setBasket(result.lines);
  paint({ keep: true });
  const count = document.getElementById('cart-count');
  const n = countPieces();
  if (count) count.textContent = n ? String(n) : '';
  const link = document.querySelector('.cartlink');
  if (link) link.setAttribute('aria-label', `Koszyk, ${n} szt.`);
  if (result.added > 0) {
    trackMeta('AddToCart', {
      content_ids: [String(product.code || '')],
      content_type: 'product',
      value: (Number(product.price) || 0) * result.added,
      currency: 'PLN',
    });
    toast('Dodano.', { href: '#/koszyk', label: 'Do kasy' });
  }
  else toast('W koszyku jest już cały dostępny stan.');
}

function onClick(event) {
  const target = event.target.closest('[data-act]');
  if (!target) return;
  const act = target.dataset.act;
  if (act === 'reload') { loadProducts(); return; }
  if (act === 'kolekcja') {
    document.getElementById('kolekcja')?.scrollIntoView({ block: 'start' });
    return;
  }
  if (act === 'edit-buyer') {
    state.editBuyer = true;
    paint({ keep: true });
    return;
  }
  if (act === 'not-me') {
    state.editBuyer = true;
    saveDraft({
      ...emptyDraft(),
      delivery: state.draft.delivery,
      point_code: state.draft.point_code,
      payment: state.draft.payment,
      note: state.draft.note,
    });
    paint({ keep: true });
    return;
  }
  if (act === 'sound') {
    const video = target.closest('.reel')?.querySelector('video');
    if (!video) return;
    video.muted = !video.muted;
    target.textContent = video.muted ? 'Włącz dźwięk' : 'Wyłącz dźwięk';
    if (!video.muted) video.play().catch(() => {});
    return;
  }
  if (act === 'los') {
    const card = target.closest('.los');
    const place = card?.dataset.place === 'thanks' ? 'thanks' : 'home';
    state.losLine[place] = keepSlogan(state.losLine[place], pickSlogan());
    paint({ keep: true });
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
  if (act === 'interest') {
    state.interest = toggleInterest(readInterest(), target.dataset.id || '');
    writeJson(INTEREST_KEY, state.interest);
    paint({ keep: true });
    return;
  }
  if (act === 'install-hide') {
    state.installHide = true;
    try { localStorage.setItem(INSTALL_HIDE_KEY, '1'); } catch { /* the card stays hidden for this visit */ }
    paint({ keep: true });
    return;
  }
  if (act === 'promo-close') {
    state.promoDismissed = true;
    state.promoOpen = false;
    try { sessionStorage.setItem(PROMO_SEEN_KEY, '1'); } catch { /* already counted for this visit */ }
    paint({ keep: true });
    return;
  }
  if (act === 'logout') { logout(); return; }
  if (act === 'pick') {
    const kind = target.dataset.kind;
    const product = findProduct(state.pick.code);
    if (!product || (kind !== 'size' && kind !== 'color')) return;
    const options = kind === 'size'
      ? splitList(product.sizes)
      : colorViews(product, state.variants).filter((view) => view.stock == null || view.stock > 0).map((view) => view.name);
    const chosen = chooseOption(state.pick[kind], target.dataset.val || '', options);
    if (kind === 'size') state.pick.size = chosen;
    else {
      const video = document.querySelector('.hanger-video');
      const seconds = colorMoment(product, chosen, state.variants);
      if (seconds == null) {
        if (video && Number.isFinite(video.currentTime)) state.hangerAt = video.currentTime;
      } else state.hangerAt = seconds;
      state.pick.color = chosen;
      paint({ keep: true });
      return;
    }
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
    const allowance = product ? allowanceFor(product, line.color) : undefined;
    if (act === 'drop') setBasket(setLineQty(state.basket, key, 0, allowance));
    else setBasket(setLineQty(state.basket, key, (line?.qty || 1) + (Number(target.dataset.dir) || 0), allowance));
    paint({ keep: true });
    return;
  }
  if (act === 'meta-yes' || act === 'meta-no') {
    saveMetaChoice(act === 'meta-yes' ? 'yes' : 'no');
    if (act === 'meta-yes') ensurePixel();
    paint({ keep: true });
    return;
  }
  if (act === 'facebook') {
    if (!FACEBOOK_LOGIN) return;
    sb.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: location.origin + location.pathname },
    });
    return;
  }
  if (act === 'hanger-sound') {
    const video = target.querySelector('video');
    if (!video) return;
    video.muted = !video.muted;
    state.hangerMuted = video.muted;
    target.setAttribute('aria-pressed', video.muted ? 'false' : 'true');
    target.setAttribute('aria-label', video.muted ? 'Włącz dźwięk' : 'Wycisz');
    if (video.paused) video.play().catch(() => {});
    return;
  }
  if (act === 'reel-play') {
    mountFacebook(target.closest('[data-embed]'), 'Rolka na Facebooku');
    return;
  }
  if (act === 'clip-play') {
    mountFacebook(target.closest('[data-embed]'), 'Fragment z live');
    return;
  }
  if (act === 'pay-close') {
    state.payModal = false;
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
  if (form && (form.id === 'magic-link' || form.id === 'claim-order')) rememberAccount(form);
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
  if (form.id === 'magic-link') {
    event.preventDefault();
    sendMagic(form);
    return;
  }
  if (form.id === 'claim-order') {
    event.preventDefault();
    claimOrders(form);
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

async function loadSoldCounts() {
  try {
    const { data, error } = await sb.rpc('shop_sold_counts');
    if (error || !Array.isArray(data)) {
      state.soldCounts = null;
      return;
    }
    const map = {};
    for (const row of data) {
      const code = String(row?.code || '');
      const sold = Number(row?.sold);
      if (!code || !Number.isFinite(sold)) continue;
      map[code] = Math.floor(sold);
    }
    state.soldCounts = map;
    if (booted) paint({ keep: true });
  } catch {
    state.soldCounts = null;
  }
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
    loadVariants();
  }
  paint({ keep: true });
  if (error && hadCatalog) toast('Nie udało się odświeżyć.');
}

async function loadVariants() {
  const { data, error } = await sb.from('shop_variants').select('product_id,color,stock,video_seconds,ai_photo');
  if (error) return;
  state.variants = cleanVariants(data);
  paint({ keep: true });
}

function metaChoice() {
  try { return localStorage.getItem(META_CHOICE_KEY) || ''; } catch { return ''; }
}

function saveMetaChoice(value) {
  try { localStorage.setItem(META_CHOICE_KEY, value); } catch { /* the choice stays for this view only */ }
}

function cookieBar() {
  if (!metaOn() || metaChoice()) return '';
  return `<div class="cookiebar" role="dialog" aria-label="Ciasteczka">
    <p>Możemy zapisać, które strony oglądasz, żeby mierzyć sklep.</p>
    <div class="cookie-actions">
      <button type="button" class="btn primary" data-act="meta-yes">Akceptuję</button>
      <button type="button" class="btn ghost" data-act="meta-no">Odrzucam</button>
    </div>
  </div>`;
}

let pixelStarted = false;

function ensurePixel() {
  if (!metaOn() || metaChoice() !== 'yes' || pixelStarted) return;
  pixelStarted = true;
  if (!window.fbq) {
    const queue = function () {
      queue.callMethod ? queue.callMethod.apply(queue, arguments) : queue.queue.push(arguments);
    };
    queue.queue = [];
    queue.loaded = true;
    queue.version = '2.0';
    window.fbq = queue;
  }
  window.fbq('init', String(META_PIXEL_ID).trim());
  window.fbq('track', 'PageView');
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);
}

function trackMeta(event, params, eventID) {
  if (!metaOn() || metaChoice() !== 'yes') return;
  ensurePixel();
  const clean = metaPayload(event, params, eventID);
  if (typeof window.fbq !== 'function') return;
  if (clean.eventID) window.fbq('track', clean.event, clean.params, { eventID: clean.eventID });
  else window.fbq('track', clean.event, clean.params);
}

function noteCommerce() {
  if (!metaOn() || metaChoice() !== 'yes') return;
  const route = parseRoute(location.hash);
  if (route.name === 'product') {
    const product = findProduct(route.code);
    const code = String(product?.code || '');
    if (code && state.metaView !== code) {
      state.metaView = code;
      trackMeta('ViewContent', { content_ids: [code], content_type: 'product' });
    }
  } else state.metaView = '';
  if (route.name === 'checkout' && state.basket.length) {
    if (!state.metaCheckout) {
      state.metaCheckout = true;
      const open = pricedLines().filter((line) => !colourGone(line));
      const totals = previewTotals(open);
      trackMeta('InitiateCheckout', {
        content_ids: open.map((line) => String(line.code || '')).filter(Boolean),
        content_type: 'product',
        value: totals.total,
        currency: 'PLN',
      });
    }
  } else state.metaCheckout = false;
}

function start() {
  state.basket = sanitizeBasket(readJson(BASKET_KEY, []));
  const storedMine = readJson(ORDERS_KEY, []);
  const storedRows = Array.isArray(storedMine) ? storedMine : [];
  state.mine = storedRows.slice().reverse().reduce((list, row) => rememberOrder(list, row), []);
  const storedDraft = storedBuyer(readJson(DRAFT_KEY, {}));
  state.draft = storedDraft ? { ...emptyDraft(), ...storedDraft } : emptyDraft();
  state.thanks = loadThanks();
  try { state.installHide = localStorage.getItem(INSTALL_HIDE_KEY) === '1'; } catch { state.installHide = false; }
  ensurePixel();
  const root = document.getElementById('app');
  root.addEventListener('load', (event) => {
    const img = event.target;
    if (img?.tagName === 'IMG') img.classList.add('in');
  }, true);
  root.addEventListener('error', (event) => {
    const img = event.target;
    if (img?.tagName !== 'IMG') return;
    const fallback = img.dataset.fallback || '';
    if (fallback && img.getAttribute('src') !== fallback) img.src = fallback;
  }, true);
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
  const authError = new URLSearchParams(location.search);
  if (authError.get('error') || authError.get('error_description')) {
    state.accountNote = 'Link logowania wygasł albo jest niepoprawny. Wyślij nowy.';
    if (parseRoute(location.hash).name !== 'account') location.hash = '#/konto';
  }
  state.loading = true;
  booted = true;
  paint();
  loadProducts();
  if (authError.get('code') && !authError.get('error') && !authError.get('error_description')) {
    sb.auth.getSession().then(({ data }) => {
      if (!booted || data?.session) return;
      state.accountNote = OTHER_BROWSER_NOTE;
      if (parseRoute(location.hash).name !== 'account') location.hash = '#/konto';
      else paint({ keep: true });
    }).catch(() => {});
  }
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' || ignoreSameSignIn(event, state.session?.user?.id, session?.user?.id)) {
      state.session = session;
      return;
    }
    const had = !!state.session;
    state.session = session;
    if (!session) {
      clearAccount();
    } else if (!had || event === 'SIGNED_IN') {
      state.accountLoaded = false;
      if (returnFromEmail && parseRoute(location.hash).name !== 'account') {
        location.hash = '#/konto';
        return;
      }
    }
    if (booted) paint();
  });
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
    if (booted) paint({ keep: true });
  });
  window.addEventListener('appinstalled', () => {
    state.installEvent = null;
    state.installReady = false;
    const button = document.getElementById('install');
    if (button) button.hidden = true;
    if (booted) paint({ keep: true });
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=14', { scope: './' }).catch(() => {});
    });
  }
}

if (typeof document !== 'undefined' && document.getElementById('app')) start();
