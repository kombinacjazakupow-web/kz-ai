import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import {
  SUPABASE_URL, SUPABASE_KEY, esc, formatZl, formatWhen, photoUrl, normalizeList, splitList, facebookReel, facebookClip, hangerSrc,
  nextProductCode, ownerFlag, parseAdminRoute, sortProducts, ORDER_STATUS, STATUS_NEXT, STATUS_ACTION,
} from '#common';
import { momentReady, momentSliderValue, momentText } from '#variants';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.85;

const state = {
  screen: 'boot',
  session: null,
  loginError: '',
  gateError: '',
  products: [],
  orders: [],
  items: [],
  ordersError: '',
  productsError: '',
  statusFilter: 'all',
  banner: '',
  flash: new Set(),
  live: '',
  listening: false,
  formDraft: null,
  busyId: '',
  confirmId: '',
  productErrors: {},
  productError: '',
  saving: false,
  dropPhotos: new Set(),
  variantRows: [],
  momentColor: '',
  momentTick: {},
};

let pendingFiles = [];
let formKey = '';
let authGen = 0;
let ordersGen = 0;
let refreshTimer = 0;

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.hidden = false;
  el.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 3600);
}

function clearPending() {
  for (const file of pendingFiles) {
    if (file._url) URL.revokeObjectURL(file._url);
  }
  pendingFiles = [];
}

function fileUrl(file) {
  if (!file._url) file._url = URL.createObjectURL(file);
  return file._url;
}

let saveHash = '';

function captureProductForm() {
  const form = document.getElementById('product-form');
  if (!form || state.saving) return;
  state.formDraft = {
    code: form.code?.value ?? '',
    title: form.title?.value ?? '',
    description: form.description?.value ?? '',
    price: form.price?.value ?? '',
    sizes: form.sizes?.value ?? '',
    colors: form.colors?.value ?? '',
    stock: form.stock?.value ?? '',
    sort: form.sort?.value ?? '',
    video_url: form.video_url?.value ?? '',
    hanger_video_url: form.hanger_video_url?.value ?? '',
    reel_url: form.reel_url?.value ?? '',
    live_clip_url: form.live_clip_url?.value ?? '',
    active: !!form.elements.namedItem('active')?.checked,
  };
}

function syncForm() {
  if (state.saving) return;
  const route = parseAdminRoute(location.hash);
  const key = `${route.name}:${route.id || ''}`;
  if (key === formKey) return;
  formKey = key;
  clearPending();
  state.dropPhotos = new Set();
  state.productErrors = {};
  state.productError = '';
  state.formDraft = null;
  state.confirmId = '';
}

function paint(opts = {}) {
  const root = document.getElementById('admin');
  if (!root) return;
  if (state.screen === 'app') syncForm();
  const y = opts.keep ? window.scrollY : 0;
  document.title = 'Panel · KOMBI Sklep';
  root.innerHTML = shell();
  bindMoments();
  window.scrollTo(0, y);
}

function shell() {
  if (state.screen === 'boot') return '<main class="center"><p>Sprawdzam dostęp…</p></main>';
  if (state.screen === 'login') return loginView();
  if (state.screen === 'denied') return deniedView();
  if (state.screen === 'error') return errorView();
  return appView();
}

function loginView() {
  const err = state.loginError ? `<p class="alert" role="alert">${esc(state.loginError)}</p>` : '';
  return `<main class="center">
    <div class="mark" style="width:88px;height:88px;font-size:32px">KS</div>
    <h1>KOMBI Sklep</h1>
    <p>Panel właściciela.</p>
    ${err}
    <button type="button" id="google" class="btn primary" data-act="login">Zaloguj przez Google</button>
    <p><a class="back" href="./">← Sklep</a></p>
    <div id="toast" class="toast" role="status" hidden></div>
  </main>`;
}

function deniedView() {
  const who = state.session?.user?.email || '';
  return `<main class="center">
    <h1>Brak dostępu</h1>
    ${who ? `<p class="muted">${esc(who)}</p>` : ''}
    <button type="button" class="btn ghost" data-act="logout">Wyloguj</button>
    <div id="toast" class="toast" role="status" hidden></div>
  </main>`;
}

function errorView() {
  return `<main class="center">
    <h1>Chwila przerwy</h1>
    <p>${esc(state.gateError || 'Nie udało się sprawdzić dostępu.')}</p>
    <button type="button" class="btn primary" data-act="retry">Spróbuj ponownie</button>
    <button type="button" class="btn ghost" data-act="logout">Wyloguj</button>
    <div id="toast" class="toast" role="status" hidden></div>
  </main>`;
}

function appView() {
  const route = parseAdminRoute(location.hash);
  const productsOn = route.name === 'products' || route.name === 'edit';
  const banner = `<button type="button" id="banner" class="banner" data-act="banner"${state.banner ? '' : ' hidden'}>${esc(state.banner)}</button>`;
  let body = productsMain();
  if (route.name === 'orders') body = ordersMain();
  if (route.name === 'edit') body = editMain(route.id);
  return `${topbar()}${tabs(productsOn)}${banner}<p id="live" class="live">${esc(liveLabel())}</p>${body}<div id="toast" class="toast" role="status" hidden></div>`;
}

function liveLabel() {
  if (state.live === 'SUBSCRIBED') return 'Na żywo';
  if (state.live === 'CHANNEL_ERROR' || state.live === 'TIMED_OUT') return 'Bez podglądu na żywo — użyj Odśwież';
  return '';
}

function topbar() {
  return `<header class="top">
    <a class="mark" href="./">KS</a>
    <div class="top-title"><b>KOMBI</b><small>Panel</small></div>
    <button type="button" class="cartlink" data-act="logout">Wyjdź</button>
  </header>`;
}

function tabs(productsOn) {
  return `<nav class="tabs">
    <a href="#/produkty" class="${productsOn ? 'on' : ''}">Produkty</a>
    <a href="#/zamowienia" class="${productsOn ? '' : 'on'}">Zamówienia</a>
  </nav>`;
}

function productsMain() {
  const add = `<p><a class="btn primary block" href="#/produkt/nowy">Dodaj produkt</a></p>`;
  if (state.productsError) return `<main><h1>Produkty</h1><div class="alert" role="alert">${esc(state.productsError)}</div><button type="button" class="btn" data-act="reload-products">Odśwież</button></main>`;
  if (!state.products.length) return `<main><h1>Produkty</h1><p>Nie ma jeszcze produktów.</p>${add}</main>`;
  const rows = sortProducts(state.products).map((product) => {
    const path = Array.isArray(product.photos) ? product.photos[0] : '';
    const url = photoUrl(path);
    const img = url
      ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer">`
      : `<span class="ph" aria-hidden="true">${esc(String(product.title || '?').trim().charAt(0).toLocaleUpperCase('pl') || '·')}</span>`;
    const on = product.active !== false;
    return `<article class="prow${on ? '' : ' sold'}">
      <div class="thumb">${img}</div>
      <div>
        <b>${esc(product.code || '')}</b>
        <div>${esc(product.title || '')}</div>
        <div class="meta">${esc(formatZl(product.price))} · stan ${esc(String(product.stock ?? '—'))}</div>
        <div class="row-actions">
          <button type="button" class="btn" data-act="toggle" data-id="${esc(product.id)}" aria-pressed="${on ? 'true' : 'false'}" ${state.busyId === product.id ? 'disabled' : ''}>${on ? 'Aktywny' : 'Wyłączony'}</button>
          <a class="btn" href="#/produkt/${esc(product.id)}">Edytuj</a>
        </div>
      </div>
    </article>`;
  }).join('');
  return `<main><h1>Produkty</h1>${add}${rows}<button type="button" class="btn ghost" data-act="reload-products">Odśwież</button></main>`;
}

function editMain(id) {
  const isNew = id === 'new';
  const product = isNew ? null : state.products.find((item) => item.id === id);
  if (!isNew && !product) {
    return `<main><h1>Produkt</h1><p>Nie ma takiego produktu.</p><p><a class="btn" href="#/produkty">Wróć</a></p></main>`;
  }
  const suggested = nextProductCode(state.products.map((item) => item.code));
  const blank = {
    code: suggested, title: '', description: '', price: '', sizes: '', colors: '', stock: 1, sort: 0, video_url: '', hanger_video_url: '', reel_url: '', live_clip_url: '', active: true,
  };
  const saved = product ? {
    code: product.code || '',
    title: product.title || '',
    description: product.description || '',
    price: product.price ?? '',
    sizes: product.sizes || '',
    colors: product.colors || '',
    stock: product.stock ?? 0,
    sort: product.sort ?? 0,
    video_url: product.video_url || '',
    hanger_video_url: product.hanger_video_url || '',
    reel_url: product.reel_url || '',
    live_clip_url: product.live_clip_url || '',
    active: product.active !== false,
  } : blank;
  const value = state.formDraft || saved;
  const err = state.productErrors;
  const photos = (Array.isArray(product?.photos) ? product.photos : []).filter((path) => !state.dropPhotos.has(path));
  const kept = photos.map((path) => {
    const url = photoUrl(path);
    const img = url ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer">` : '<span class="ph">·</span>';
    return `<figure>${img}<button type="button" data-act="drop-photo" data-path="${esc(path)}">Usuń z galerii</button></figure>`;
  }).join('');
  const fresh = pendingFiles.map((file, index) => `<figure><img src="${esc(fileUrl(file))}" alt=""><button type="button" data-act="drop-file" data-idx="${index}">Cofnij</button><figcaption>${esc(file.name || 'zdjęcie')}</figcaption></figure>`).join('');
  return `<main>
    <p><a class="back" href="#/produkty">← Produkty</a></p>
    <h1>${isNew ? 'Dodaj produkt' : 'Edytuj produkt'}</h1>
    ${state.productError ? `<div class="alert" role="alert">${esc(state.productError)}</div>` : ''}
    <form id="product-form">
      ${input('code', 'Kod', value.code, err.code, 'autocapitalize="characters" spellcheck="false"')}
      ${input('title', 'Nazwa', value.title, err.title, 'maxlength="140"')}
      <label class="field" for="description"><span>Opis</span>
        <textarea id="description" name="description" maxlength="5000">${esc(value.description || '')}</textarea>
        ${err.description ? `<small class="field-error">${esc(err.description)}</small>` : ''}
      </label>
      ${input('price', 'Cena', value.price === '' || value.price == null ? '' : String(value.price), err.price, 'inputmode="decimal" step="0.01" min="0"', 'number')}
      ${input('sizes', 'Rozmiary', value.sizes || '', err.sizes, 'placeholder="S,M,L"')}
      ${input('colors', 'Kolory', value.colors || '', err.colors, 'placeholder="czarny,beż"')}
      ${input('stock', 'Stan', value.stock ?? '', err.stock, 'inputmode="numeric" step="1" min="0"', 'number')}
      ${input('sort', 'Kolejność', value.sort ?? 0, err.sort, 'inputmode="numeric" step="1"', 'number')}
      <label class="check"><input id="active" name="active" type="checkbox"${value.active !== false ? ' checked' : ''}><span>Aktywny w sklepie</span></label>
      ${input('video_url', 'Film', value.video_url || '', err.video_url, 'placeholder="https://… albo poślemy plik niżej" spellcheck="false"')}
      ${input('hanger_video_url', 'Film z wieszaka', value.hanger_video_url || '', err.hanger_video_url, 'placeholder="https://r2.selmo.io/…" spellcheck="false" inputmode="url"')}
      ${momentsHtml(product, value)}
      ${input('reel_url', 'Rolka Facebook', value.reel_url || '', err.reel_url, 'placeholder="https://www.facebook.com/reel/123" spellcheck="false" inputmode="url"')}
      ${input('live_clip_url', 'Fragment z live', value.live_clip_url || '', err.live_clip_url, 'placeholder="https://www.facebook.com/…" spellcheck="false" inputmode="url"')}
      <label class="file">Film MP4 lub MOV
        <input id="video" name="video" type="file" accept="video/mp4,video/quicktime,.mp4,.mov">
      </label>
      <p class="group-label">Zdjęcia</p>
      <p class="hint">Długi bok zmniejszamy do 1600 px, JPEG. Najpierw aparat, albo wybierz gotowe zdjęcia.</p>
      <label class="file">Aparat
        <input id="cam" name="cam" type="file" accept="image/*" capture="environment" multiple>
      </label>
      <label class="file">Z galerii
        <input id="files" name="files" type="file" accept="image/*" multiple>
      </label>
      <div class="thumbs">${kept}${fresh}</div>
      <div class="wide-actions">
        <button type="submit" class="btn primary" id="save"${state.saving ? ' disabled' : ''}>Zapisz</button>
        <a class="btn ghost" href="#/produkty"${state.saving ? ' aria-disabled="true" tabindex="-1"' : ''}>Anuluj</a>
      </div>
    </form>
  </main>`;
}

function input(id, label, value, error, extra, type = 'text') {
  return `<label class="field" for="${id}"><span>${label}</span>
    <input id="${id}" name="${id}" type="${type}" value="${esc(value ?? '')}" ${error ? 'aria-invalid="true"' : ''} ${extra || ''}>
    ${error ? `<small class="field-error">${esc(error)}</small>` : ''}
  </label>`;
}

function momentList(product, colorsText) {
  const names = splitList(colorsText || product?.colors);
  const rows = (state.variantRows || []).filter((row) => row.product_id === product?.id);
  const seen = new Set();
  const out = [];
  const add = (name) => {
    const label = String(name || '').trim();
    const key = label.toLocaleLowerCase('pl');
    if (!key || seen.has(key)) return;
    seen.add(key);
    const row = rows.find((item) => String(item.color || '').trim().toLocaleLowerCase('pl') === key) || null;
    out.push({ name: label, row });
  };
  names.forEach(add);
  rows.forEach((row) => add(row.color));
  return out;
}

function momentsHtml(product, value) {
  const src = hangerSrc(value?.hanger_video_url || product?.hanger_video_url);
  if (!src || !product?.id) return '';
  const colours = momentList(product, value?.colors);
  if (!colours.length) return '';
  const picked = colours.find((item) => item.name === state.momentColor) || colours[0];
  const chips = colours.map((item) => {
    const on = item.name === picked.name;
    const marked = item.row && state.momentTick[item.row.id] != null;
    const saved = marked ? state.momentTick[item.row.id] : item.row?.video_seconds;
    const time = saved != null && saved !== '' && Number.isFinite(Number(saved)) && Number(saved) >= 0 ? momentText(saved) : '';
    const suffix = marked && time ? ` · ✓ ${time}` : (time ? ` · ${time}` : '');
    return `<button type="button" class="chip${on ? ' on' : ''}" data-act="moment-color" data-color="${esc(item.name)}" data-id="${item.row ? esc(String(item.row.id)) : ''}" data-seconds="${item.row && item.row.video_seconds != null ? esc(String(item.row.video_seconds)) : ''}" aria-pressed="${on ? 'true' : 'false'}">${esc(item.name)}${esc(suffix)}</button>`;
  }).join('');
  const uploads = colours.map((item) => {
    if (!item.row) return `<p>${esc(item.name)}: najpierw musi być wariant tego koloru.</p>`;
    const preview = item.row.ai_photo && photoUrl(item.row.ai_photo)
      ? `<img src="${esc(photoUrl(item.row.ai_photo))}" alt="" referrerpolicy="no-referrer">`
      : '';
    return `<div class="moment-photo">${preview}<label class="file">Zdjęcie modelki · ${esc(item.name)}<input type="file" accept="image/*" data-model-photo="1" data-variant="${esc(String(item.row.id))}" data-code="${esc(product.code || '')}"></label></div>`;
  }).join('');
  const tick = picked.row && state.momentTick[picked.row.id] != null
    ? `<p id="moment-note" role="status">✓ ${esc(momentText(state.momentTick[picked.row.id]))}</p>`
    : '<p id="moment-note" role="status"></p>';
  return `<section class="moments">
    <h2>Momenty kolorów</h2>
    <video id="moment-video" playsinline muted preload="metadata" src="${esc(src)}"></video>
    <label class="field" for="moment-range"><span>Moment w filmie</span>
      <input id="moment-range" class="moment-range" type="range" min="0" max="0" step="0.1" value="0" disabled>
    </label>
    <div class="chip-row">${chips}</div>
    ${tick}
    <button type="button" class="btn primary" id="save-moment" data-act="save-moment" disabled>Zapisz moment</button>
    ${uploads}
  </section>`;
}

function bindMoments() {
  const video = document.getElementById('moment-video');
  const range = document.getElementById('moment-range');
  if (!video || !range) return;
  const fit = () => {
    if (!momentReady(video.duration)) return;
    range.disabled = false;
    range.max = String(video.duration);
    const save = document.getElementById('save-moment');
    if (save) save.disabled = false;
    const picked = document.querySelector('[data-act="moment-color"].on');
    const at = momentSliderValue(picked?.dataset.seconds, video.duration);
    if (at == null) return;
    range.value = String(at);
    try { video.currentTime = at; } catch { /* the film is not ready yet */ }
  };
  video.addEventListener('loadedmetadata', fit);
  if (video.readyState >= 1) fit();
  range.addEventListener('input', () => {
    if (!momentReady(video.duration)) return;
    const at = Number(range.value);
    const apply = () => { try { video.currentTime = at; } catch { /* the film is not ready yet */ } };
    if (video.readyState >= 1) apply();
    else video.addEventListener('loadedmetadata', apply, { once: true });
  });
}

function ordersMain() {
  const filters = ['all', 'new', 'paid', 'packed', 'sent', 'cancelled'].map((key) => {
    const label = key === 'all' ? 'Wszystkie' : (ORDER_STATUS[key] || key);
    return `<button type="button" class="chip${state.statusFilter === key ? ' on' : ''}" data-act="filter" data-status="${key}">${esc(label)}</button>`;
  }).join('');
  const list = filteredOrders();
  const cards = list.map((order) => orderCard(order)).join('');
  const empty = list.length ? '' : '<p>Brak zamówień.</p>';
  const err = state.ordersError ? `<div class="alert" role="alert">${esc(state.ordersError)}</div>` : '';
  const cap = state.orders.length >= 200 ? '<p class="hint">Pokazuję ostatnie 200.</p>' : '';
  return `<main>
    <h1>Zamówienia</h1>
    ${err}
    <div class="filters">${filters}</div>
    <p><button type="button" class="btn" data-act="reload-orders">Odśwież</button></p>
    ${cap}
    ${empty}
    ${cards}
  </main>`;
}

function filteredOrders() {
  const list = state.orders.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  if (state.statusFilter === 'all') return list;
  return list.filter((order) => order.status === state.statusFilter);
}

function moneyOf(row, keys) {
  for (const key of keys) {
    if (row && row[key] != null && row[key] !== '') return row[key];
  }
  return null;
}

function orderCard(order) {
  const id = String(order.id || '');
  const status = String(order.status || '');
  const label = ORDER_STATUS[status] || status || '—';
  const when = formatWhen(order.created_at);
  const toPay = moneyOf(order, ['to_pay_now', 'pay_now']);
  const cod = moneyOf(order, ['cod_amount', 'cod']);
  const items = itemsFor(order).map((item) => `<li>${esc(itemText(item))}</li>`).join('');
  const next = STATUS_NEXT[status];
  const busy = state.busyId === id;
  let actions = '';
  if (next) {
    actions += `<button type="button" class="btn primary" data-act="status" data-id="${esc(id)}" data-status="${esc(next)}" ${busy ? 'disabled' : ''}>${esc(STATUS_ACTION[next] || next)}</button>`;
  }
  if (status !== 'cancelled' && status !== 'sent') {
    if (state.confirmId === id) {
      actions += `<button type="button" class="btn warn" data-act="status" data-id="${esc(id)}" data-status="cancelled" ${busy ? 'disabled' : ''}>Potwierdź anulowanie</button><button type="button" class="btn ghost" data-act="undo-cancel">Nie</button>`;
    } else {
      actions += `<button type="button" class="btn warn" data-act="ask-cancel" data-id="${esc(id)}" ${busy ? 'disabled' : ''}>Anuluj zamówienie</button>`;
    }
  }
  const phone = String(order.phone || '');
  const tel = /^\+?\d{9,15}$/.test(phone.replace(/[^\d+]/g, '')) ? phone.replace(/[^\d+]/g, '') : '';
  const phoneHtml = tel ? `<a href="tel:${esc(tel)}">${esc(phone)}</a>` : esc(phone);
  const email = String(order.email || '');
  const address = [order.street, order.postcode, order.city].filter(Boolean).join(', ');
  return `<article class="order${state.flash.has(id) ? ' flash' : ''}" id="ord-${esc(id)}">
    <header>
      <strong class="price">${esc(order.order_no || 'Zamówienie')}</strong>
      <span class="status">${esc(label)}</span>
    </header>
    ${when ? `<p class="muted">${esc(when)}</p>` : ''}
    ${order.name ? `<p><b>${esc(order.name)}</b>${phone ? `<br>${phoneHtml}` : ''}${email ? `<br>${esc(email)}` : ''}</p>` : ''}
    ${address ? `<p>${esc(address)}</p>` : ''}
    <p>${esc(deliveryLabel(order.delivery))}${order.point_code ? ` · ${esc(order.point_code)}` : ''} · ${esc(paymentLabel(order.payment))}</p>
    <p>Do zapłaty teraz: <b>${esc(formatZl(toPay))}</b></p>
    <p>Pobranie: <b>${esc(formatZl(cod))}</b></p>
    ${items ? `<ul>${items}</ul>` : ''}
    ${order.note ? `<p class="muted">Uwagi: ${esc(order.note)}</p>` : ''}
    ${proofBadge(order)}
    <div class="wide-actions">${actions}</div>
  </article>`;
}

function proofBadge(order) {
  const path = safeProofPath(order?.proof_path);
  if (!path) return '';
  return `<p><span class="badge">Potwierdzenie</span> <button type="button" class="btn" data-act="proof" data-path="${esc(path)}">Otwórz</button></p>`;
}

function safeProofPath(path) {
  const raw = String(path || '').trim().replace(/^\/+/, '');
  if (!raw || raw.includes('..') || /[\\:?#]/.test(raw) || raw.includes('://')) return '';
  if (raw.split('/').some((part) => !part || part === '.')) return '';
  return raw;
}

async function openProof(path) {
  const clean = safeProofPath(path);
  if (!clean) {
    toast('Nie udało się otworzyć potwierdzenia.');
    return;
  }
  const { data, error } = await sb.storage.from('shop-proofs').createSignedUrl(clean, 120);
  if (error || !data?.signedUrl) {
    toast('Nie udało się otworzyć potwierdzenia.');
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener');
}

async function uploadVideo(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  const mov = name.endsWith('.mov') || type === 'video/quicktime';
  const mp4 = name.endsWith('.mp4') || type === 'video/mp4';
  if (!mov && !mp4) {
    toast('Wybierz plik MP4 albo MOV.');
    return;
  }
  const path = `videos/${uuid()}.${mov ? 'mov' : 'mp4'}`;
  const { error } = await sb.storage.from('shop-photos').upload(path, file, {
    contentType: mov ? 'video/quicktime' : 'video/mp4',
    upsert: false,
  });
  if (error) {
    toast('Nie udało się wysłać filmu.');
    return;
  }
  const input = document.getElementById('video_url');
  if (input) input.value = path;
  captureProductForm();
  toast('Film dodany. Zapisz produkt.');
}

function deliveryLabel(value) {
  if (value === 'dpd_home') return 'Kurier DPD pod drzwi';
  if (value === 'dpd_point') return 'Punkt lub automat DPD';
  return value ? String(value) : 'Dostawa';
}

function paymentLabel(value) {
  if (value === 'blik') return 'BLIK';
  if (value === 'transfer') return 'Przelew';
  if (value === 'cod') return 'Pobranie';
  return value ? String(value) : 'Płatność';
}

function itemsFor(order) {
  const id = order.id;
  return state.items.filter((item) => (item.order_id || item.shop_order_id || item.order) === id);
}

function itemText(item) {
  const name = item.product_title || item.title || item.name || item.code || item.product_code || 'Pozycja';
  const bits = [name];
  if (item.size) bits.push(item.size);
  if (item.color) bits.push(item.color);
  let text = bits.join(' · ');
  const qty = item.qty ?? item.quantity;
  if (qty != null && qty !== '') text += ` × ${qty}`;
  const price = item.line_total ?? item.unit_price ?? item.price;
  if (price != null && price !== '') text += ` — ${formatZl(price)}`;
  return text;
}

function isPermission(error) {
  const msg = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  return msg.includes('permission') || msg.includes('42501') || msg.includes('row-level') || msg.includes('rls');
}

function readLoginError() {
  const params = new URLSearchParams(location.search);
  state.loginError = (params.get('error_description') || params.get('error') || '').slice(0, 200);
}

async function login() {
  const button = document.getElementById('google');
  if (button) button.disabled = true;
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) {
    if (button) button.disabled = false;
    toast(error.message || 'Logowanie nie działa');
  }
}

async function logout() {
  authGen += 1;
  clearTimeout(refreshTimer);
  try { await sb.removeAllChannels(); } catch { /* already gone */ }
  state.listening = false;
  state.live = '';
  try { await sb.auth.signOut({ scope: 'local' }); } catch { /* listener clears the screen */ }
  state.session = null;
  state.screen = 'login';
  paint();
}

async function enter(session) {
  const gen = ++authGen;
  state.session = session;
  if (!session) {
    state.screen = 'login';
    paint();
    return;
  }
  state.screen = 'boot';
  paint();
  const { data, error } = await sb.rpc('pak_is_owner');
  if (gen !== authGen) return;
  if (error) {
    if (isPermission(error)) {
      state.screen = 'denied';
      paint();
      return;
    }
    state.screen = 'error';
    state.gateError = 'Nie udało się sprawdzić dostępu. Spróbuj ponownie.';
    paint();
    return;
  }
  if (!ownerFlag(data)) {
    state.screen = 'denied';
    paint();
    return;
  }
  state.screen = 'app';
  if (!location.hash) location.hash = '#/produkty';
  paint();
  await refreshProducts();
  if (gen !== authGen) return;
  subscribe();
  refreshOrders();
}

async function refreshProducts() {
  const [productsRes, variantsRes] = await Promise.all([
    sb.from('shop_products').select('*').order('sort', { ascending: true }).order('created_at', { ascending: false }),
    sb.from('shop_variants').select('id,product_id,color,stock,video_seconds,ai_photo'),
  ]);
  const { data, error } = productsRes;
  if (!variantsRes.error) state.variantRows = variantsRes.data || [];
  if (error) state.productsError = isPermission(error) ? 'Brak dostępu do produktów.' : 'Nie udało się pobrać produktów.';
  else {
    state.productsError = '';
    state.products = data || [];
  }
  const route = parseAdminRoute(location.hash);
  const form = document.getElementById('product-form');
  const typing = !!(form && document.activeElement && form.contains(document.activeElement));
  if (state.screen === 'app' && route.name === 'products' && !state.saving) paint({ keep: true });
  if (state.screen === 'app' && route.name === 'edit' && !typing && !state.formDraft && !state.saving) paint({ keep: true });
}

async function refreshOrders() {
  const gen = ++ordersGen;
  const res = await sb.from('shop_orders').select('*').order('created_at', { ascending: false }).limit(200);
  if (gen !== ordersGen) return;
  if (res.error) {
    state.ordersError = isPermission(res.error) ? 'Brak dostępu do zamówień.' : 'Nie udało się pobrać zamówień.';
    state.orders = [];
    state.items = [];
  } else {
    state.orders = res.data || [];
    const ids = state.orders.map((order) => order.id).filter(Boolean);
    if (!ids.length) {
      state.items = [];
      state.ordersError = '';
    } else {
      const fetched = await fetchItems(ids);
      if (gen !== ordersGen) return;
      state.items = fetched.rows;
      state.ordersError = fetched.error ? 'Nie udało się pobrać pozycji zamówień.' : '';
    }
  }
  if (state.screen === 'app' && parseAdminRoute(location.hash).name === 'orders') paint({ keep: true });
}

async function fetchItems(ids) {
  const columns = ['order_id', 'shop_order_id'];
  let last = null;
  for (const column of columns) {
    const res = await sb.from('shop_order_items').select('*').in(column, ids);
    if (!res.error) return { rows: res.data || [], error: null };
    last = res.error;
    const msg = `${res.error.message || ''} ${res.error.details || ''}`;
    if (!/column|schema cache|could not find/i.test(msg)) break;
  }
  return { rows: [], error: last };
}

function scheduleOrdersRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { refreshOrders(); }, 300);
}

function subscribe() {
  if (state.listening) return;
  state.listening = true;
  sb.channel('shop-orders-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shop_orders' }, (payload) => {
      const row = payload.new || {};
      if (row.id) {
        state.flash.add(row.id);
        const flashId = row.id;
        setTimeout(() => {
          state.flash.delete(flashId);
          document.getElementById(`ord-${flashId}`)?.classList.remove('flash');
        }, 8000);
      }
      const no = row.order_no ? `: ${row.order_no}` : '';
      state.banner = `Nowe zamówienie${no}`;
      const bar = document.getElementById('banner');
      if (bar) {
        bar.hidden = false;
        bar.textContent = state.banner;
      }
      scheduleOrdersRefresh();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shop_orders' }, () => {
      scheduleOrdersRefresh();
    })
    .subscribe((status) => {
      state.live = status;
      const el = document.getElementById('live');
      if (el) el.textContent = liveLabel();
    });
}

function parsePrice(raw) {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100) / 100;
}

function validateProduct(value, editingId) {
  const errors = {};
  const code = value.code.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(code)) errors.code = 'Kod: litery, cyfry, myślnik. Na przykład K-001.';
  else if (state.products.some((item) => item.id !== editingId && String(item.code || '').toLowerCase() === code.toLowerCase())) {
    errors.code = 'Taki kod już jest.';
  }
  if (value.title.trim().length < 2) errors.title = 'Podaj nazwę produktu.';
  if (value.description.trim().length > 5000) errors.description = 'Opis jest za długi.';
  const price = parsePrice(value.price);
  if (price == null) errors.price = 'Podaj cenę, na przykład 79.00.';
  if (!/^\d+$/.test(value.stock.trim())) errors.stock = 'Stan magazynu: liczba sztuk, 0 albo więcej.';
  if (value.sort.trim() && !/^\d+$/.test(value.sort.trim())) errors.sort = 'Kolejność: liczba, na przykład 10.';
  if (String(value.hanger_video_url || '').trim() && !hangerSrc(value.hanger_video_url)) errors.hanger_video_url = 'Film z wieszaka musi być adresem https://r2.selmo.io/.';
  if (String(value.reel_url || '').trim() && !facebookReel(value.reel_url)) errors.reel_url = 'Adres rolki zaczyna się od https://www.facebook.com/reel/ i ma sam numer.';
  if (String(value.live_clip_url || '').trim() && !facebookClip(value.live_clip_url)) errors.live_clip_url = 'Fragment z live musi być filmem na www.facebook.com.';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    code,
    price,
    stock: Number(value.stock),
    sort: value.sort.trim() ? Number(value.sort) : 0,
  };
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = url;
  });
}

async function decodeOriented(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, close() { bitmap.close?.(); } };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return { source: bitmap, close() { bitmap.close?.(); } };
      } catch { /* use Image */ }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return { source: img, close() { URL.revokeObjectURL(url); } };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export async function resizeToJpeg(file, maxSide = MAX_SIDE, quality = JPEG_QUALITY) {
  const decoded = await decodeOriented(file);
  try {
    const sourceWidth = decoded.source.width;
    const sourceHeight = decoded.source.height;
    if (!sourceWidth || !sourceHeight) throw new Error('image');
    const long = Math.max(sourceWidth, sourceHeight);
    const scale = long > maxSide ? maxSide / long : 1;
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('blob'))), 'image/jpeg', quality);
    });
    return blob;
  } finally {
    decoded.close();
  }
}

async function uploadPhotos(code, files) {
  const list = Array.isArray(files) ? files.slice() : [];
  const uploaded = [];
  const button = document.getElementById('save');
  for (let i = 0; i < list.length; i += 1) {
    const file = list[i];
    if (button) button.textContent = `Zdjęcie ${i + 1} z ${list.length}…`;
    if (file.size > 15 * 1024 * 1024) throw new Error('big');
    const blob = await resizeToJpeg(file);
    const path = `products/${code}/${uuid()}.jpg`;
    const { error } = await sb.storage.from('shop-photos').upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    uploaded.push(path);
  }
  return uploaded;
}

async function saveProduct(form) {
  if (state.saving) return;
  const route = parseAdminRoute(location.hash);
  const editingId = route.id === 'new' ? null : route.id;
  const value = {
    code: form.code.value,
    title: form.title.value,
    description: form.description.value,
    price: form.price.value,
    sizes: form.sizes.value,
    colors: form.colors.value,
    stock: form.stock.value,
    sort: form.sort.value,
    video_url: form.video_url?.value || '',
    hanger_video_url: form.hanger_video_url?.value || '',
    reel_url: form.reel_url?.value || '',
    live_clip_url: form.live_clip_url?.value || '',
  };
  const active = !!form.elements.namedItem('active')?.checked;
  state.formDraft = {
    ...value,
    active,
  };
  const checked = validateProduct(value, editingId);
  const product = editingId ? state.products.find((item) => item.id === editingId) : null;
  const kept = (Array.isArray(product?.photos) ? product.photos : []).filter((path) => !state.dropPhotos.has(path));
  if (kept.length + pendingFiles.length > 12) {
    checked.ok = false;
    checked.errors.photos = 'Maksymalnie 12 zdjęć przy produkcie.';
  }
  if (!checked.ok) {
    state.productErrors = checked.errors;
    state.productError = checked.errors.photos || 'Popraw zaznaczone pola.';
    paint({ keep: true });
    document.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  const files = pendingFiles.slice();
  state.saving = true;
  saveHash = location.hash;
  document.documentElement.dataset.shopSaving = '1';
  const button = document.getElementById('save');
  if (button) {
    button.disabled = true;
    button.textContent = 'Zapisuję…';
  }
  let uploaded = [];
  try {
    uploaded = await uploadPhotos(checked.code, files);
    const photos = kept.concat(uploaded);
    const payload = {
      code: checked.code,
      title: value.title.trim(),
      description: value.description.trim(),
      price: checked.price,
      sizes: normalizeList(value.sizes),
      colors: normalizeList(value.colors),
      stock: checked.stock,
      sort: checked.sort,
      active,
      photos,
      video_url: String(state.formDraft?.video_url || '').trim(),
      hanger_video_url: hangerSrc(value.hanger_video_url) || null,
      reel_url: facebookReel(value.reel_url) || null,
      live_clip_url: facebookClip(value.live_clip_url) || null,
    };
    const write = editingId
      ? sb.from('shop_products').update(payload).eq('id', editingId).select('id')
      : sb.from('shop_products').insert(payload).select('id');
    const { data, error } = await write;
    if (error || !data?.length) throw error || new Error('save');
    clearPending();
    state.dropPhotos = new Set();
    state.productErrors = {};
    state.productError = '';
    state.formDraft = null;
    state.saving = false;
    saveHash = '';
    document.documentElement.dataset.shopSaving = '';
    if (location.hash !== '#/produkty') location.hash = '#/produkty';
    await refreshProducts();
    toast('Zapisane.');
  } catch (err) {
    if (uploaded.length) {
      try { await sb.storage.from('shop-photos').remove(uploaded); } catch { /* leftover file is not on the product */ }
    }
    state.saving = false;
    saveHash = '';
    document.documentElement.dataset.shopSaving = '';
    const msg = `${err?.message || ''} ${err?.code || ''}`.toLowerCase();
    if (err?.message === 'big') state.productError = 'Zdjęcie jest za duże (max 15 MB).';
    else if (err?.message === 'image' || err?.message === 'blob') state.productError = 'Nie udało się zmniejszyć zdjęcia. Wybierz JPEG albo zrób je jeszcze raz.';
    else if (msg.includes('duplicate') || msg.includes('unique') || err?.code === '23505') state.productError = 'Taki kod już jest.';
    else state.productError = 'Nie udało się zapisać produktu.';
    paint({ keep: true });
  }
}

async function toggleActive(id) {
  if (state.busyId) return;
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  const next = product.active !== true;
  state.busyId = id;
  paint({ keep: true });
  const { data, error } = await sb.from('shop_products').update({ active: next }).eq('id', id).select('id,active');
  state.busyId = '';
  if (!error && data?.length) product.active = data[0].active;
  paint({ keep: true });
  if (error || !data?.length) toast('Nie udało się zmienić widoczności.');
}

async function setStatus(id, status) {
  if (state.busyId) return;
  state.busyId = id;
  state.confirmId = '';
  paint({ keep: true });
  const { data, error } = await sb.from('shop_orders').update({ status }).eq('id', id).select('id,status');
  state.busyId = '';
  if (!error && data?.length) {
    const row = state.orders.find((order) => order.id === id);
    if (row) row.status = data[0].status;
  }
  paint({ keep: true });
  if (error || !data?.length) toast('Nie udało się zmienić statusu.');
}

function addFiles(list) {
  if (state.saving) return;
  captureProductForm();
  for (const file of list || []) pendingFiles.push(file);
  paint({ keep: true });
}

function onClick(event) {
  if (state.saving) return;
  const target = event.target.closest('[data-act]');
  if (!target) return;
  const act = target.dataset.act;
  if (act === 'login') { login(); return; }
  if (act === 'logout') { logout(); return; }
  if (act === 'retry') { enter(state.session); return; }
  if (act === 'reload-products') { refreshProducts(); return; }
  if (act === 'reload-orders') { refreshOrders(); return; }
  if (act === 'banner') {
    state.banner = '';
    if (parseAdminRoute(location.hash).name !== 'orders') location.hash = '#/zamowienia';
    else paint({ keep: true });
    return;
  }
  if (act === 'toggle') { toggleActive(target.dataset.id); return; }
  if (act === 'filter') {
    state.statusFilter = target.dataset.status || 'all';
    paint({ keep: true });
    return;
  }
  if (act === 'ask-cancel') {
    state.confirmId = target.dataset.id || '';
    paint({ keep: true });
    return;
  }
  if (act === 'undo-cancel') {
    state.confirmId = '';
    paint({ keep: true });
    return;
  }
  if (act === 'status') { setStatus(target.dataset.id, target.dataset.status); return; }
  if (act === 'proof') { openProof(target.dataset.path); return; }
  if (act === 'drop-photo') {
    captureProductForm();
    state.dropPhotos.add(target.dataset.path || '');
    paint({ keep: true });
    return;
  }
  if (act === 'moment-color') {
    state.momentColor = target.dataset.color || '';
    document.querySelectorAll('[data-act="moment-color"]').forEach((button) => {
      const on = button === target;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const video = document.getElementById('moment-video');
    const range = document.getElementById('moment-range');
    const at = momentSliderValue(target.dataset.seconds, video?.duration);
    if (at == null || !video || !range) return;
    range.value = String(at);
    try { video.currentTime = at; } catch { /* the film is not ready yet */ }
    return;
  }
  if (act === 'save-moment') { saveMoment(); return; }
  if (act === 'drop-file') {
    captureProductForm();
    const index = Number(target.dataset.idx);
    const [file] = pendingFiles.splice(index, 1);
    if (file?._url) URL.revokeObjectURL(file._url);
    paint({ keep: true });
  }
}

async function saveMoment() {
  const picked = document.querySelector('[data-act="moment-color"].on');
  const id = picked?.dataset.id || '';
  const range = document.getElementById('moment-range');
  const video = document.getElementById('moment-video');
  const note = document.getElementById('moment-note');
  if (!id) {
    toast('Ten kolor nie ma jeszcze wariantu.');
    return;
  }
  if (!range || range.disabled || !momentReady(video?.duration)) return;
  const at = Number(range.value);
  if (!Number.isFinite(at) || at < 0) return;
  const { error } = await sb.from('shop_variants').update({ video_seconds: at }).eq('id', id);
  if (error) {
    toast('Nie udało się zapisać momentu.');
    return;
  }
  const row = state.variantRows.find((item) => String(item.id) === String(id));
  if (row) row.video_seconds = at;
  state.momentTick[id] = at;
  picked.dataset.seconds = String(at);
  const label = momentText(at);
  if (note) note.textContent = label ? `✓ ${label}` : '✓';
  if (label) picked.textContent = `${picked.dataset.color || ''} · ✓ ${label}`;
}

async function uploadModelPhoto(variantId, code, file) {
  if (!variantId || !file) return;
  const safeCode = String(code || '').replace(/[^A-Za-z0-9_-]/g, '') || 'produkt';
  try {
    if (file.size > 15 * 1024 * 1024) throw new Error('big');
    const blob = await resizeToJpeg(file);
    const path = `products/${safeCode}/${uuid()}.jpg`;
    const { error } = await sb.storage.from('shop-photos').upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { error: writeError } = await sb.from('shop_variants').update({ ai_photo: path }).eq('id', variantId);
    if (writeError) throw writeError;
    const row = state.variantRows.find((item) => String(item.id) === String(variantId));
    if (row) row.ai_photo = path;
    toast('Zdjęcie modelki zapisane.');
    paint({ keep: true });
  } catch (err) {
    toast(err?.message === 'big' ? 'Zdjęcie jest za duże (max 15 MB).' : 'Nie udało się zapisać zdjęcia modelki.');
  }
}

function onChange(event) {
  const input = event.target;
  if (input.dataset.modelPhoto) {
    const file = input.files && input.files[0];
    input.value = '';
    if (file) uploadModelPhoto(input.dataset.variant, input.dataset.code, file);
    return;
  }
  if (input.id === 'video') {
    if (state.saving) return;
    const file = input.files && input.files[0];
    input.value = '';
    if (file) uploadVideo(file);
    return;
  }
  if (input.closest('#product-form') && input.id !== 'cam' && input.id !== 'files') captureProductForm();
  if (state.saving) return;
  if (input.id !== 'cam' && input.id !== 'files') return;
  addFiles(input.files);
  input.value = '';
}

function onSubmit(event) {
  if (event.target.id !== 'product-form') return;
  event.preventDefault();
  saveProduct(event.target);
}

function start() {
  readLoginError();
  const root = document.getElementById('admin');
  root.addEventListener('click', (event) => {
    if (state.saving && event.target.closest('a')) event.preventDefault();
  }, true);
  root.addEventListener('click', onClick);
  root.addEventListener('input', (event) => {
    if (event.target.closest('#product-form')) captureProductForm();
  });
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  window.addEventListener('hashchange', () => {
    if (state.saving) {
      if (saveHash && location.hash !== saveHash) history.replaceState(null, '', saveHash);
      return;
    }
    if (state.screen === 'app') paint();
  });
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') { state.session = session; return; }
    if (event === 'SIGNED_OUT') {
      state.session = null;
      state.screen = 'login';
      paint();
      return;
    }
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      const same = session?.user?.id && state.session?.user?.id === session.user.id && state.screen === 'app';
      if (same) return;
      enter(session);
    }
  });
}

if (typeof document !== 'undefined' && document.getElementById('admin')) start();
