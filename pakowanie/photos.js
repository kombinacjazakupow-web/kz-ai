export const MSG_SENDING = 'Wysyłanie zdjęcia...';
export const MSG_SAVED = 'Zdjęcie zapisane';
export const MSG_FAIL = 'Brak internetu – zdjęcie nie zapisane, spróbuj ponownie';
export const SIGNED_SECONDS = 3600;
export const SIGNED_TTL_MS = SIGNED_SECONDS * 1000;
export const SIGNED_SKEW_MS = 60 * 1000;
export const MAX_SIDE = 1280;
export const JPEG_QUALITY = 0.8;

const signed = new Map();

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function byCreated(a, b) {
  const c = String(a.created_at || '').localeCompare(String(b.created_at || ''));
  if (c) return c;
  return String(a.id || '').localeCompare(String(b.id || ''));
}
function camIcon() {
  return '<svg class="camicon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.2 5.2l1 2h3.6l1-2H18a2 2 0 012 2V17a2 2 0 01-2 2H6a2 2 0 01-2-2V7.2a2 2 0 012-2h3.2zM12 16.4a3.6 3.6 0 100-7.2 3.6 3.6 0 000 7.2z"/></svg>';
}

export function todayLabel(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(date.getDate())}.${p(date.getMonth() + 1)}`;
}
export function withTodayFirst(days, today) {
  const rest = (days || []).filter((d) => d !== today);
  return today ? [today, ...rest] : rest.slice();
}
export function proofPath(bagNo, id) {
  return `proof/${bagNo}/${id}.jpg`;
}
export function productPath(liveDay, hangerNo, id) {
  const day = String(liveDay ?? '').split('.').join('-');
  return `product/${day}/${hangerNo}/${id}.jpg`;
}
export function buildPhotoRow(spec, id, userId, createdAt) {
  if (spec.kind === 'product') {
    const liveDay = String(spec.live_day ?? '');
    const hangerNo = String(spec.hanger_no ?? '').trim();
    return {
      id,
      kind: 'product',
      bag_no: null,
      item_id: null,
      live_day: liveDay,
      hanger_no: hangerNo,
      path: productPath(liveDay, hangerNo, id),
      user_id: userId,
      created_at: createdAt,
    };
  }
  return {
    id,
    kind: 'proof',
    bag_no: spec.bag_no,
    item_id: spec.item_id || null,
    live_day: null,
    hanger_no: null,
    path: proofPath(spec.bag_no, id),
    user_id: userId,
    created_at: createdAt,
  };
}
export function productPhotosFor(photos, liveDay, hangerNo) {
  const day = String(liveDay ?? '');
  const no = String(hangerNo ?? '').trim();
  if (!day || !no) return [];
  return (photos || []).filter((p) => (
    p.kind === 'product'
    && String(p.live_day ?? '') === day
    && String(p.hanger_no ?? '').trim() === no
  )).sort(byCreated);
}
export function proofForItem(photos, itemId) {
  if (!itemId) return [];
  return (photos || []).filter((p) => p.kind === 'proof' && p.item_id === itemId).sort(byCreated);
}
export function proofForBag(photos, bagNo) {
  if (bagNo == null || bagNo === '') return [];
  return (photos || []).filter((p) => (
    p.kind === 'proof' && p.bag_no === bagNo && (p.item_id == null || p.item_id === '')
  )).sort(byCreated);
}
export function latestDayPhotos(photos, day, limit = 30) {
  return (photos || [])
    .filter((p) => p.kind === 'product' && String(p.live_day ?? '') === String(day ?? ''))
    .sort((a, b) => byCreated(b, a))
    .slice(0, limit);
}
export function missingHangers(items, photos, day) {
  const have = new Set();
  for (const p of photos || []) {
    if (p.kind !== 'product' || String(p.live_day ?? '') !== String(day ?? '')) continue;
    const no = String(p.hanger_no ?? '').trim();
    if (no) have.add(no);
  }
  const need = new Set();
  for (const it of items || []) {
    if (String(it.live_day ?? '') !== String(day ?? '')) continue;
    const no = String(it.hanger_no ?? '').trim();
    if (!no || have.has(no)) continue;
    need.add(no);
  }
  return [...need].sort((a, b) => a.localeCompare(b, 'pl', { numeric: true, sensitivity: 'base' }));
}
export function photoStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function cachedSigned(path, now = Date.now()) {
  if (!path) return '';
  const hit = signed.get(path);
  if (!hit) return '';
  if (hit.exp - SIGNED_SKEW_MS <= now) {
    signed.delete(path);
    return '';
  }
  return hit.url;
}
export function rememberSigned(path, url, now = Date.now(), ttlMs = SIGNED_TTL_MS) {
  if (!path || !url) return;
  signed.set(path, { url, exp: now + ttlMs });
}
export function dropSigned(path) {
  signed.delete(path);
}
export function clearSigned() {
  signed.clear();
}
export async function signPaths(sb, paths, now = Date.now()) {
  const need = [];
  const seen = new Set();
  for (const path of paths || []) {
    if (!path || seen.has(path) || cachedSigned(path, now)) continue;
    seen.add(path);
    need.push(path);
  }
  for (let i = 0; i < need.length; i += 80) {
    const chunk = need.slice(i, i + 80);
    const { data, error } = await sb.storage.from('pak-photos').createSignedUrls(chunk, SIGNED_SECONDS);
    if (error || !data) continue;
    for (const row of data) {
      const url = row && (row.signedUrl || row.signedURL);
      if (row && row.path && url && !row.error) rememberSigned(row.path, url, now);
    }
  }
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
      } catch { /* fall through to Image */ }
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
    const sw = decoded.source.width;
    const sh = decoded.source.height;
    const long = Math.max(sw, sh) || 1;
    const scale = long > maxSide ? maxSide / long : 1;
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(decoded.source, 0, 0, w, h);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', quality);
    });
    return blob;
  } finally {
    decoded.close();
  }
}

export function productThumbHtml(item, photos) {
  const list = productPhotosFor(photos, item.live_day, item.hanger_no);
  if (!list.length) return '<span class="ph empty">brak zdjęcia</span>';
  const photo = list[list.length - 1];
  const day = esc(item.live_day);
  const no = esc(String(item.hanger_no ?? '').trim());
  return `<button type="button" class="ph" data-act="view-product" data-day="${day}" data-no="${no}" data-id="${esc(photo.id)}" aria-label="Zdjęcia produktu"><img data-path="${esc(photo.path)}" alt=""></button>`;
}
export function itemProofHtml(item, photos) {
  const list = proofForItem(photos, item.id);
  const cam = `<button type="button" class="cam" data-act="cam-item" data-id="${esc(item.id)}" aria-label="Zrób zdjęcie">${camIcon()}</button>`;
  if (!list.length) return cam;
  const badge = `<button type="button" class="cambadge" data-act="view-item-proof" data-id="${esc(item.id)}" aria-label="Zdjęcia tej pozycji: ${list.length}">${camIcon()}<span>${list.length}</span></button>`;
  return cam + badge;
}
export function bagProofHtml(bagNo, photos) {
  const list = proofForBag(photos, bagNo);
  const thumbs = list.map((p, i) => (
    `<button type="button" class="proofthumb" data-act="view-bag-proof" data-id="${esc(p.id)}" aria-label="Zdjęcie worka ${i + 1}"><img data-path="${esc(p.path)}" alt=""></button>`
  )).join('');
  const strip = thumbs ? `<div class="proofstrip">${thumbs}</div>` : '';
  return `<div class="proofhead"><button type="button" class="btn" data-act="cam-bag">Zdjęcie worka</button></div>${strip}`;
}
function gridCell(photo) {
  const day = esc(photo.live_day);
  const no = esc(String(photo.hanger_no ?? '').trim());
  return `<button type="button" class="pcell" data-act="view-product" data-day="${day}" data-no="${no}" data-id="${esc(photo.id)}" aria-label="Wieszak ${no}"><img data-path="${esc(photo.path)}" alt=""><span class="pnum">${no}</span></button>`;
}
export function photosPageHtml({ days, selected, number, busy, grid, missing }) {
  const opts = (days || []).map((d) => (
    `<option value="${esc(d)}"${d === selected ? ' selected' : ''}>${esc(d)}</option>`
  )).join('');
  const gridHtml = grid && grid.length
    ? `<div class="photogrid">${grid.map(gridCell).join('')}</div>`
    : '<p class="empty">Jeszcze brak zdjęć tego dnia</p>';
  const chips = (missing || []).map((no) => (
    `<button type="button" class="chip" data-act="fill-no" data-no="${esc(no)}">${esc(no)}</button>`
  )).join('');
  const miss = `<h2>Brak zdjęć (${(missing || []).length})</h2>${chips ? `<div class="missnums">${chips}</div>` : ''}`;
  const dis = busy ? ' disabled' : '';
  return `<main class="page"><p class="hint">Dzień live i numer wieszaka. Zdjęcie nie zmienia worka.</p><label class="lbl" for="photo-day">Dzień live</label><select id="photo-day" class="search"${dis}>${opts}</select><label class="lbl" for="photo-no">Numer wieszaka</label><input id="photo-no" class="search big-no" inputmode="numeric" autocomplete="off" autocapitalize="off" enterkeyhint="done" placeholder="np. 14" value="${esc(number)}"${dis}><button type="button" class="btn primary big shoot" data-act="cam-product"${dis}>${busy ? MSG_SENDING : 'Zrób zdjęcie'}</button>${gridHtml}${miss}</main>`;
}
export function viewerHtml({ path, name, stamp, index, total, canDelete, ask, busy }) {
  const prevDis = index <= 0 ? ' disabled' : '';
  const nextDis = index >= total - 1 ? ' disabled' : '';
  const img = `<img class="vimg" data-path="${esc(path)}" alt="">`;
  let bottom;
  if (ask) {
    bottom = `<div class="vask"><p>Usunąć to zdjęcie?</p><button type="button" class="btn danger" data-act="v-delete"${busy ? ' disabled' : ''}>Usuń zdjęcie</button><button type="button" class="btn" data-act="v-keep">Zostaw</button></div>`;
  } else {
    const del = canDelete
      ? '<button type="button" class="btn danger" data-act="v-ask">Usuń zdjęcie</button>'
      : '<span class="vspacer"></span>';
    bottom = `<div class="vnav"><button type="button" class="varrow" data-act="v-prev" aria-label="Poprzednie zdjęcie"${prevDis}>←</button>${del}<button type="button" class="varrow" data-act="v-next" aria-label="Następne zdjęcie"${nextDis}>→</button></div>`;
  }
  return `<div id="viewer" class="viewer" role="dialog" aria-modal="true" aria-label="Zdjęcie"><div class="vtop"><button type="button" class="iconbtn" data-act="v-close" aria-label="Zamknij">✕</button><p class="vmeta">${esc(name)} · ${esc(stamp)}</p><span class="vcount">${index + 1} / ${total}</span></div><div class="vstage">${img}</div>${bottom}</div>`;
}
