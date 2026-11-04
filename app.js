import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import {
  MSG_FAIL, MSG_SAVED, MSG_SENDING,
  bagProofHtml, buildPhotoRow, cachedSigned, clearSigned, dropSigned,
  itemProofHtml, latestDayPhotos, missingHangers, photoStamp, photosPageHtml,
  productPhotosFor, productThumbHtml, proofForBag, proofForItem, resizeToJpeg,
  signPaths, todayLabel, viewerHtml, withTodayFirst,
} from './photos.js';
const SUPABASE_URL = 'https://ghhatjkcgilnruluhxyr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pIiSGwIiJJmkNsvlZyniAw_6CQ1FlpF';
const QUEUE_KEY = 'kombi-tick-queue';
const LOCK_MS = 30 * 60 * 1000;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});
const FIELD_LABEL = {
  missing: 'Brakuje', wrong_item: 'Zła rzecz lub kolor', qty: 'Ilość',
  hanger_no: 'Numer wieszaka', bag_note: 'Notatka do worka', other_bag: 'Rzecz jest w innym worku',
};
const TYPE_META = {
  PAID: { label: 'ZAPŁACONE', cls: 'paid' },
  COD: { label: 'POBRANIE', cls: 'cod' },
  WHOLESALE: { label: 'HURT', cls: 'wholesale' },
};
const GROUPS = [
  ['NEW', 'DOŁÓŻ', 'g-new'], ['OLD', 'JUŻ W WORKU – sprawdź', 'g-old'],
  ['REMOVE', 'WYJMIJ', 'g-remove'], ['HOLD', 'NIE PAKUJ', 'g-hold'],
];
const state = {
  session: null, me: null, screen: 'boot', bags: [], items: [], ticks: [], users: [], requests: [], photos: [],
  filter: 'todo', query: '', bagNo: null, bagLocked: false, lockMsg: '', lockChecked: '', missingIds: [],
  pickerDay: '', pickerNo: '', photoDay: '', photoNo: '', photoBusy: false, viewer: null,
  report: blankReport(), menu: false, busy: false, error: '', loginError: '',
};
const inflight = { inserts: [], deletes: [] };
let lockToken = 0, authGen = 0, painted = '';
let channelsReady = false, meWatch = false, signGen = 0;
let pendingShot = null;

function blankReport() {
  return { itemId: '', field: 'missing', newValue: '', why: '' };
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function bagLabel(no) {
  const s = String(no ?? '').trim();
  if (!s) return 'W?';
  return /^w/i.test(s) ? `W${s.slice(1)}` : `W${s}`;
}
export function bagNum(no) {
  const m = String(no ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}
function pln(n) {
  if (n === null || n === undefined || n === '') return '—';
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x)} zł`;
}
function userName(id) {
  if (!id) return 'ktoś';
  const u = state.users.find((x) => x.id === id);
  return u?.name || (id === state.me?.id ? state.me?.name : '') || u?.email || 'ktoś';
}
function tickFor(itemId) {
  return state.ticks.find((t) => t.item_id === itemId) || null;
}
function itemsOf(bagNo) {
  return state.items.filter((i) => i.bag_no === bagNo);
}
function freshPack(bag) {
  if (!bag?.packing_by || !bag.packing_since) return false;
  const t = new Date(bag.packing_since).getTime();
  return Number.isFinite(t) && Date.now() - t < LOCK_MS;
}
function dayParts(s) {
  const m = String(s ?? '').match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/);
  return m ? [m[3] ? Number(m[3]) : 0, Number(m[2]), Number(m[1])] : [0, 0, 0];
}
export function sortedDays(items) {
  const set = new Set();
  for (const it of items) if (it.live_day) set.add(String(it.live_day));
  return [...set].sort((a, b) => {
    const [ka, kb] = [dayParts(a), dayParts(b)];
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || a.localeCompare(b, 'pl');
  });
}
export function progressOf(items, ticks, bagNo) {
  const rows = items.filter((i) => i.bag_no === bagNo && i.state === 'NEW');
  const ids = new Set(ticks.map((t) => t.item_id));
  return { ticked: rows.filter((i) => ids.has(i.id)).length, total: rows.length };
}
export function totalsOf(items, bagNo) {
  let pieces = 0;
  let money = 0;
  for (const i of items) {
    if (i.bag_no !== bagNo || (i.state !== 'NEW' && i.state !== 'OLD')) continue;
    const q = Number(i.qty) || 0;
    pieces += q;
    money += (Number(i.price) || 0) * q;
  }
  return { pieces, money };
}
export function matchHanger(item, day, hanger) {
  const no = String(hanger ?? '').trim();
  if (!day || !no) return false;
  return String(item.live_day ?? '') === String(day) && String(item.hanger_no ?? '').trim() === no;
}
export function visibleBags(bags, items, ticks, meId, filter, query) {
  const q = String(query || '').trim().toLowerCase();
  return bags.filter((bag) => {
    if (filter === 'todo' && bag.status !== 'to_pack' && bag.status !== 'packing') return false;
    if (filter === 'done' && bag.status !== 'done') return false;
    if (filter === 'mine') {
      const ids = new Set(items.filter((i) => i.bag_no === bag.bag_no).map((i) => i.id));
      const mine = bag.packing_by === meId || ticks.some((t) => t.user_id === meId && ids.has(t.item_id));
      if (!mine) return false;
    }
    if (!q) return true;
    return `${bag.bag_no} ${bagLabel(bag.bag_no)} ${bag.client_name || ''}`.toLowerCase().includes(q);
  }).sort((a, b) => bagNum(a.bag_no) - bagNum(b.bag_no) || String(a.bag_no).localeCompare(String(b.bag_no), 'pl'));
}

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}
function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}
export function enqueue(job, existing = []) {
  const q = existing.slice();
  if (job.op === 'delete') {
    const idx = q.findIndex((j) => j.op === 'insert' && j.id === job.id);
    if (idx >= 0) {
      q.splice(idx, 1);
      return q;
    }
  }
  if (job.op === 'insert') {
    const without = q.filter((j) => !(j.op === 'delete' && j.id === job.id));
    without.push(job);
    return without;
  }
  q.push(job);
  return q;
}
export function mergeTicks(serverTicks, queue = [], extra = { inserts: [], deletes: [] }) {
  const deleted = new Set(queue.filter((j) => j.op === 'delete').map((j) => j.id));
  for (const id of extra.deletes || []) deleted.add(id);
  const ticks = (serverTicks || []).filter((t) => !deleted.has(t.id));
  const inserts = queue.filter((j) => j.op === 'insert').concat(extra.inserts || []);
  for (const job of inserts) {
    if (deleted.has(job.id)) continue;
    if (ticks.some((t) => t.id === job.id || t.item_id === job.item_id)) continue;
    ticks.push({ id: job.id, item_id: job.item_id, user_id: job.user_id, created_at: job.created_at });
  }
  return ticks;
}
function applyServerTicks(rows) {
  state.ticks = mergeTicks(rows, loadQueue(), inflight);
}
function queuePush(job) {
  saveQueue(enqueue(job, loadQueue()));
  paintBanner();
}
function offlineOn() {
  return !navigator.onLine || loadQueue().length > 0;
}
function isRetryable(error) {
  if (!navigator.onLine) return true;
  if (!error) return false;
  const msg = `${error.message || ''} ${error.details || ''} ${error.code || ''}`.toLowerCase();
  if (msg.includes('permission') || msg.includes('42501') || msg.includes('row-level')) return false;
  const status = Number(error.status || error.statusCode || 0);
  if (error instanceof TypeError || status === 0 || status === 401 || status === 408 || status === 429 || status >= 500) return true;
  return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed') || msg.includes('timeout');
}
function isDuplicate(error) {
  const msg = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  return msg.includes('duplicate') || msg.includes('unique') || error?.code === '23505';
}
function rpcText(data) {
  if (typeof data === 'string') return data.trim();
  if (data && typeof data === 'object') {
    const v = data.result ?? (Object.keys(data).length === 1 ? Object.values(data)[0] : '');
    if (typeof v === 'string') return v.trim();
  }
  return String(data ?? '').trim();
}
let flushing = false;
async function flushQueue() {
  if (flushing || !state.session || !navigator.onLine) {
    paintBanner();
    return;
  }
  flushing = true;
  const pending = loadQueue();
  const left = [];
  for (const job of pending) {
    let error = null;
    try {
      if (job.op === 'insert') {
        const res = await sb.from('pak_ticks').insert({
          id: job.id, item_id: job.item_id, user_id: job.user_id, created_at: job.created_at,
        });
        error = res.error && !isDuplicate(res.error) ? res.error : null;
      } else {
        const res = await sb.from('pak_ticks').delete().eq('id', job.id).eq('user_id', job.user_id || state.me?.id);
        error = res.error;
      }
    } catch (err) {
      error = err;
    }
    if (error && isRetryable(error)) left.push(job);
  }
  saveQueue(left);
  flushing = false;
  paintBanner();
  if (left.length !== pending.length) scheduleReload('pak_ticks');
}
function paintBanner() {
  const el = document.getElementById('offline');
  if (!el) return;
  const on = offlineOn();
  el.hidden = !on;
  if (on) el.textContent = 'offline – zapisane w telefonie';
}
function toast(msg, ms = 4600) {
  let el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, ms);
}
function bagBy(no) {
  return state.bags.find((b) => b.bag_no === no) || null;
}
function giftText(g) {
  if (g === true) return 'Upominek';
  if (g === false || g == null) return '';
  const s = String(g).trim();
  if (!s || s === '0' || s.toLowerCase() === 'false') return '';
  return s;
}

async function loadCore() {
  const [bags, items, ticks, users, photos] = await Promise.all([
    sb.from('pak_bags').select('*'),
    sb.from('pak_items').select('*'),
    sb.from('pak_ticks').select('*'),
    sb.from('pak_users').select('id,name,email,role,status'),
    sb.from('pak_photos').select('*'),
  ]);
  if (bags.error) throw bags.error;
  if (items.error) throw items.error;
  if (ticks.error) throw ticks.error;
  if (photos.error) throw photos.error;
  state.bags = bags.data || [];
  state.items = items.data || [];
  state.photos = photos.data || [];
  applyServerTicks(ticks.data || []);
  if (!users.error && users.data) state.users = users.data;
  else if (state.me && !state.users.some((u) => u.id === state.me.id)) state.users.push(state.me);
  if (state.me?.role === 'owner') {
    const req = await sb.from('pak_change_requests').select('*').eq('status', 'pending');
    if (!req.error) state.requests = req.data || [];
  }
}
const reloadTimers = {};
function scheduleReload(table) {
  clearTimeout(reloadTimers[table]);
  reloadTimers[table] = setTimeout(() => reloadTable(table), 280);
}
async function reloadTable(table) {
  let q = sb.from(table).select(table === 'pak_users' ? 'id,name,email,role,status' : '*');
  if (table === 'pak_change_requests') q = q.eq('status', 'pending');
  const { data, error } = await q;
  if (!error && data) {
    if (table === 'pak_bags') state.bags = data;
    else if (table === 'pak_items') state.items = data;
    else if (table === 'pak_ticks') applyServerTicks(data);
    else if (table === 'pak_change_requests') state.requests = data;
    else if (table === 'pak_users') state.users = data;
    else if (table === 'pak_photos') {
      state.photos = data;
      syncViewer();
    }
  }
  render();
}
function subscribe() {
  if (channelsReady || !state.session) return;
  channelsReady = true;
  const ch = sb.channel('pak-live');
  for (const table of ['pak_bags', 'pak_items', 'pak_ticks', 'pak_change_requests', 'pak_users', 'pak_photos']) {
    ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => scheduleReload(table));
  }
  ch.subscribe();
}
function watchMe() {
  const uid = state.session?.user?.id;
  if (!uid || meWatch) return;
  meWatch = true;
  sb.channel('pak-me').on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'pak_users', filter: `id=eq.${uid}` },
    (payload) => {
      if (payload.eventType === 'DELETE') applyMe({ id: uid, status: 'removed', email: state.me?.email || '' }, true);
      else if (payload.new?.id) applyMe(payload.new, true);
    },
  ).subscribe();
}
async function refreshMe() {
  const uid = state.session?.user?.id;
  if (!uid) return;
  const { data, error } = await sb.from('pak_users').select('*').eq('id', uid).maybeSingle();
  if (error) {
    toast(error.message || 'Nie udało się odświeżyć');
    return;
  }
  await applyMe(data, false);
}
async function applyMe(row, fromRealtime) {
  state.me = row || null;
  if (state.me && !state.users.some((u) => u.id === state.me.id)) state.users.push(state.me);
  if (!row || row.status === 'waiting' || !row.status) {
    state.screen = 'waiting';
    state.menu = false;
    render();
    return;
  }
  if (row.status !== 'approved') {
    state.screen = 'denied';
    state.menu = false;
    render();
    return;
  }
  const inside = !['waiting', 'denied', 'boot', 'login', 'error'].includes(state.screen);
  try {
    if (!inside || !fromRealtime) await loadCore();
    subscribe();
    state.error = '';
    route();
  } catch (err) {
    state.screen = 'error';
    state.error = err.message || 'Błąd danych';
    render();
  }
}
async function enter(session) {
  const gen = ++authGen;
  state.session = session;
  if (!session) {
    state.me = null;
    state.screen = 'login';
    render();
    return;
  }
  state.screen = 'boot';
  render();
  watchMe();
  const { data, error } = await sb.from('pak_users').select('*').eq('id', session.user.id).maybeSingle();
  if (gen !== authGen) return;
  if (error) {
    state.screen = 'error';
    state.error = error.message || 'Nie udało się pobrać konta';
    render();
    return;
  }
  await applyMe(data, false);
  flushQueue();
}

function route() {
  if (!state.me || state.me.status !== 'approved') return;
  const h = location.hash.replace(/^#/, '');
  state.menu = false;
  state.viewer = null;
  if (h.startsWith('/bag/')) {
    const no = decodeURIComponent(h.slice(5));
    if (state.screen === 'bag' && state.bagNo === no && state.lockChecked === no) render();
    else openBag(no);
    return;
  }
  if (h.startsWith('/report/')) {
    const no = decodeURIComponent(h.slice(8));
    if (state.bagNo !== no || state.screen !== 'report') state.report = blankReport();
    state.bagNo = no;
    state.screen = 'report';
    render();
    return;
  }
  if (h === '/owner' && state.me.role !== 'owner') { location.hash = '#/'; return; }
  state.screen = h === '/picker' ? 'picker' : h === '/photos' ? 'photos' : h === '/owner' ? 'owner' : 'bags';
  if (state.screen === 'owner') { scheduleReload('pak_users'); scheduleReload('pak_change_requests'); }
  render();
}
async function refreshBags(token) {
  const { data, error } = await sb.from('pak_bags').select('*');
  if (!error && data && token === lockToken) state.bags = data;
}
async function openBag(no) {
  const token = ++lockToken;
  Object.assign(state, {
    bagNo: no, screen: 'bag', bagLocked: true, lockMsg: 'Sprawdzam, kto pakuje…',
    missingIds: [], lockChecked: '', menu: false,
  });
  render();
  let data = null; let error = null;
  try { ({ data, error } = await sb.rpc('pak_lock_bag', { p_bag: no })); }
  catch (err) { error = err; }
  if (token !== lockToken) return;
  if (error) {
    state.lockMsg = isRetryable(error) ? 'Brak sieci — tylko podgląd, bez blokady.' : 'Nie udało się zablokować worka. Tylko podgląd.';
  } else if (rpcText(data) === 'locked') {
    await refreshBags(token);
    state.lockMsg = `Worek pakuje teraz ${userName(bagBy(no)?.packing_by)}`;
  } else {
    state.bagLocked = false;
    state.lockMsg = '';
    await refreshBags(token);
  }
  if (token !== lockToken) return;
  state.lockChecked = no;
  render();
}
function canEdit(bag) {
  return !!bag && !state.bagLocked && bag.status !== 'hold' && bag.status !== 'done';
}
async function dbResult(promise) {
  try { return await promise; }
  catch (error) { return { error }; }
}
async function toggleTick(itemId) {
  if (!itemId || !state.me) return;
  const existing = tickFor(itemId);
  if (existing && existing.user_id !== state.me.id) { toast('To odhaczenie należy do innej osoby'); return; }
  if (existing) {
    state.ticks = state.ticks.filter((t) => t.id !== existing.id);
    inflight.deletes.push(existing.id);
    render();
    const { error } = await dbResult(sb.from('pak_ticks').delete().eq('id', existing.id).eq('user_id', state.me.id));
    inflight.deletes = inflight.deletes.filter((id) => id !== existing.id);
    if (!error) return;
    if (isRetryable(error)) queuePush({ op: 'delete', id: existing.id, user_id: state.me.id, item_id: itemId });
    else { state.ticks.push(existing); toast(error.message || 'Nie udało się cofnąć'); render(); }
    return;
  }
  const row = { id: uuid(), item_id: itemId, user_id: state.me.id, created_at: new Date().toISOString() };
  state.ticks.push(row);
  inflight.inserts.push(row);
  state.missingIds = state.missingIds.filter((id) => id !== itemId);
  render();
  const { error } = await dbResult(sb.from('pak_ticks').insert(row));
  inflight.inserts = inflight.inserts.filter((r) => r.id !== row.id);
  if (!error) return;
  if (isRetryable(error)) queuePush({ op: 'insert', ...row });
  else if (isDuplicate(error)) scheduleReload('pak_ticks');
  else { state.ticks = state.ticks.filter((t) => t.id !== row.id); toast(error.message || 'Nie udało się zapisać'); render(); }
}
function unticked(bagNo) {
  const items = itemsOf(bagNo);
  const missing = (st) => items.filter((i) => i.state === st && !tickFor(i.id));
  const neu = missing('NEW');
  return neu.length ? neu : missing('OLD');
}
async function doneBag() {
  if (state.busy || !state.bagNo) return;
  if (!navigator.onLine) {
    toast('Brak sieci — worek nie został zamknięty.');
    return;
  }
  if (loadQueue().length) await flushQueue();
  if (loadQueue().length) {
    toast('Są odhaczenia tylko w telefonie. Poczekaj na sieć.');
    return;
  }
  state.busy = true;
  render();
  let data = null;
  let error = null;
  try {
    const res = await sb.rpc('pak_done_bag', { p_bag: state.bagNo });
    data = res.data;
    error = res.error;
  } catch (err) {
    error = err;
  }
  state.busy = false;
  if (error) {
    toast(error.message || 'Nie udało się zamknąć worka');
    render();
    return;
  }
  if (rpcText(data) === 'not_all_ticked') {
    const { data: ticks, error: tickErr } = await sb.from('pak_ticks').select('*');
    if (!tickErr && ticks) applyServerTicks(ticks);
    const miss = unticked(state.bagNo);
    state.missingIds = miss.map((i) => i.id);
    render();
    document.querySelector('.row.miss')?.scrollIntoView({ block: 'center' });
    if (!miss.length) toast('Serwer nie widzi wszystkich odhaczeń. Spróbuj jeszcze raz.');
    return;
  }
  toast('Worek gotowy');
  location.hash = '#/';
}
function oldValue(field, item, bag) {
  if (field === 'bag_note') return bag?.note || '';
  if (!item) return '';
  if (field === 'qty') return String(item.qty ?? '');
  if (field === 'hanger_no') return item.hanger_no || '';
  return item.product_name || '';
}
async function sendReport() {
  const itemId = document.getElementById('rep-item')?.value || state.report.itemId;
  const field = document.getElementById('rep-field')?.value || state.report.field;
  const newValue = (document.getElementById('rep-new')?.value ?? state.report.newValue).trim();
  const why = (document.getElementById('rep-why')?.value ?? state.report.why).trim();
  if (!field || !newValue || !why) {
    toast('Uzupełnij nowe dane i powód');
    return;
  }
  const bag = bagBy(state.bagNo);
  const item = state.items.find((i) => i.id === itemId) || null;
  const row = {
    id: uuid(),
    user_id: state.me.id,
    bag_no: state.bagNo,
    item_id: item ? item.id : null,
    field,
    old_value: oldValue(field, item, bag),
    new_value: newValue,
    why,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  state.busy = true;
  render();
  const { error } = await sb.from('pak_change_requests').insert(row);
  state.busy = false;
  if (error) {
    toast(error.message || 'Nie udało się wysłać');
    render();
    return;
  }
  toast('Wysłane do Sergio – zmiana dopiero po jego zgodzie.');
  location.hash = `#/bag/${encodeURIComponent(state.bagNo)}`;
}
async function decideRequest(id, status) {
  const { data, error } = await sb.from('pak_change_requests').update({
    status,
    decided_by: state.me.id,
    decided_at: new Date().toISOString(),
  }).eq('id', id).eq('status', 'pending').select('id');
  if (error) {
    toast(error.message || 'Nie udało się zapisać');
    return;
  }
  state.requests = state.requests.filter((r) => r.id !== id);
  render();
  if (!data?.length) toast('Już rozpatrzone');
}
async function decideUser(id, status) {
  const { data, error } = await sb.from('pak_users').update({ status }).eq('id', id).eq('status', 'waiting').select('id');
  if (error) {
    toast(error.message || 'Nie udało się zapisać');
    return;
  }
  if (!data?.length) {
    toast('Już rozpatrzone');
    scheduleReload('pak_users');
    return;
  }
  const u = state.users.find((x) => x.id === id);
  if (u) u.status = status;
  render();
}
async function onRefresh() {
  if (!state.session) return;
  if (state.me?.status === 'approved') {
    try {
      await loadCore();
      state.error = '';
      route();
    } catch (err) {
      state.screen = 'error';
      state.error = err.message || 'Błąd danych';
      render();
    }
    return;
  }
  await refreshMe();
}
async function logout() {
  state.menu = false;
  state.viewer = null;
  state.photos = [];
  state.photoBusy = false;
  state.photoDay = '';
  state.photoNo = '';
  clearSigned();
  channelsReady = false;
  meWatch = false;
  try { await sb.removeAllChannels(); } catch { /* already gone */ }
  try { await sb.auth.signOut({ scope: 'local' }); } catch { /* listener clears the screen */ }
  state.session = null;
  state.me = null;
  state.screen = 'login';
  location.hash = '';
  render();
}
async function login() {
  const btn = document.getElementById('google');
  if (btn) btn.disabled = true;
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) {
    if (btn) btn.disabled = false;
    toast(error.message || 'Logowanie nie działa');
  }
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;
  prepareViewer();
  const key = `${state.screen}:${state.bagNo || ''}`;
  const reset = key !== painted;
  painted = key;
  const y = reset ? 0 : window.scrollY;
  const active = document.activeElement;
  const focusId = active && active.id && active.id !== 'cam-file' ? active.id : '';
  const pos = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
  root.innerHTML = shell();
  paintBanner();
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus();
      if (pos != null && el.setSelectionRange) {
        try { el.setSelectionRange(pos, pos); } catch { /* type=search on some browsers */ }
      }
    }
  }
  window.scrollTo(0, y);
  document.body.style.overflow = state.viewer ? 'hidden' : '';
  paintSigned();
  bindViewer();
}
function shell() {
  if (state.screen === 'boot') return '<main class="center"><p>Ładowanie…</p></main>';
  if (state.screen === 'login') return loginView();
  if (state.screen === 'waiting') return gate('Czekasz na zatwierdzenie przez Sergio', true);
  if (state.screen === 'denied') return gate('Brak dostępu', false);
  if (state.screen === 'error') return gate(state.error || 'Błąd', true);
  const off = offlineOn();
  const banner = `<p id="offline" class="offline"${off ? '' : ' hidden'}>offline – zapisane w telefonie</p>`;
  let body = listView();
  if (state.screen === 'bag') body = bagView();
  else if (state.screen === 'report') body = reportView();
  else if (state.screen === 'picker') body = pickerView();
  else if (state.screen === 'photos') body = photosView();
  else if (state.screen === 'owner') body = ownerView();
  const tabs = state.screen === 'bag' || state.screen === 'report' ? '' : tabbar();
  const foot = state.screen === 'bag' ? bagFoot() : '';
  return `${topbar()}${banner}${body}${foot}${tabs}${menuSheet()}${viewerBlock()}<div id="toast" class="toast" role="status" hidden></div>`;
}
function topbar() {
  const back = state.screen === 'bag' || state.screen === 'report';
  let mid = '<div class="bar-mid"><b>KOMBI</b><small>Pakowanie</small></div>';
  if (state.screen === 'picker') mid = '<div class="bar-mid"><b>Wieszak</b></div>';
  if (state.screen === 'photos') mid = '<div class="bar-mid"><b>Zdjęcia</b></div>';
  if (state.screen === 'owner') mid = '<div class="bar-mid"><b>Właściciel</b></div>';
  if (state.screen === 'report') mid = '<div class="bar-mid"><b>Zgłoś błąd</b></div>';
  if (state.screen === 'bag') {
    const bag = bagBy(state.bagNo);
    mid = `<div class="bar-mid"><b>${esc(bagLabel(state.bagNo))}</b><small>${esc(bag?.client_name || '')}</small></div>`;
  }
  const left = back
    ? '<button type="button" class="iconbtn" data-act="back" aria-label="Wróć">←</button>'
    : '<span class="brand-sq">KP</span>';
  return `<header class="bar">${left}${mid}<button type="button" class="iconbtn" data-act="menu" aria-label="Menu">☰</button></header>`;
}
function loginView() {
  const err = state.loginError ? `<p class="missbox">${esc(state.loginError)}</p>` : '';
  return `<main class="center login"><div class="logo">KP</div><h1>KOMBI Pakowanie</h1><p>Worki, wieszaki, odhaczenia.</p>${err}<button type="button" id="google" class="btn primary big" data-act="login">Zaloguj przez Google</button><div id="toast" class="toast" role="status" hidden></div></main>`;
}
function gate(text, refresh) {
  const who = state.me?.email || state.session?.user?.email || '';
  return `<main class="center"><div class="logo">KP</div><h1>${esc(text)}</h1>${who ? `<p class="muted">${esc(who)}</p>` : ''}<div class="stack">${refresh ? '<button type="button" class="btn primary" data-act="refresh">Odśwież</button>' : ''}<button type="button" class="btn ghost" data-act="logout">Wyloguj</button></div><div id="toast" class="toast" role="status" hidden></div></main>`;
}
function menuSheet() {
  if (!state.menu) return '';
  const role = state.me?.role === 'owner' ? 'Właściciel' : 'Pakowanie';
  return `<div class="scrim" data-act="closemenu"></div><div class="sheet" role="dialog" aria-label="Menu"><p class="sheet-name">${esc(state.me?.name || 'Konto')}</p><p class="muted">${esc(state.me?.email || state.session?.user?.email || '')}</p><p class="muted">${esc(role)}</p><button type="button" class="btn" data-act="refresh">Odśwież</button><button type="button" class="btn danger" data-act="logout">Wyloguj</button><button type="button" class="btn ghost" data-act="closemenu">Zamknij</button></div>`;
}
function tabbar() {
  const tab = (id, label) => {
    const on = (id === 'bags' && state.screen === 'bags') || state.screen === id;
    return `<button type="button" class="tab${on ? ' on' : ''}" data-act="nav" data-to="${id}" ${on ? 'aria-current="page"' : ''}>${label}</button>`;
  };
  const owner = state.me?.role === 'owner' ? tab('owner', 'Właściciel') : '';
  return `<nav class="tabs">${tab('bags', 'Worki')}${tab('picker', 'Wieszak')}${tab('photos', 'Zdjęcia')}${owner}</nav>`;
}
function bagListHtml() {
  const bags = visibleBags(state.bags, state.items, state.ticks, state.me?.id, state.filter, state.query);
  if (!bags.length) return '<p class="empty">Brak worków</p>';
  return bags.map(cardHtml).join('');
}
function listView() {
  const chips = [
    ['todo', 'Do spakowania'],
    ['done', 'Gotowe'],
    ['mine', 'Moje'],
    ['all', 'Wszystkie'],
  ].map(([id, label]) => `<button type="button" class="chip${state.filter === id ? ' on' : ''}" data-act="filter" data-id="${id}" aria-pressed="${state.filter === id}">${label}</button>`).join('');
  return `<main class="page"><div class="tools"><input id="q" class="search" type="search" enterkeyhint="search" placeholder="Numer worka lub klient" value="${esc(state.query)}" autocomplete="off"><div class="chips">${chips}</div></div><div id="list" class="list">${bagListHtml()}</div></main>`;
}
function cardHtml(bag) {
  const meta = TYPE_META[bag.type] || { label: bag.type || '—', cls: '' };
  const prog = progressOf(state.items, state.ticks, bag.bag_no);
  const pct = prog.total ? Math.round((prog.ticked / prog.total) * 100) : 0;
  const hold = bag.status === 'hold';
  const done = bag.status === 'done';
  const badge = freshPack(bag) ? `<span class="badge">pakuje: ${esc(userName(bag.packing_by))}</span>` : '';
  const progText = prog.total ? `${prog.ticked}/${prog.total} nowych` : 'brak nowych';
  return `<button type="button" class="card${hold ? ' is-hold' : ''}${done ? ' is-done' : ''}" data-act="open" data-bag="${esc(bag.bag_no)}"><span class="band ${esc(meta.cls)}">${esc(meta.label)}</span><span class="card-top"><span class="wno">${esc(bagLabel(bag.bag_no))}${done ? ' ✅' : ''}</span>${badge}</span><span class="client">${esc(bag.client_name || '—')}</span><span class="bar-line" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="prog">${progText}</span></button>`;
}
function bagView() {
  const bag = bagBy(state.bagNo);
  if (!bag) return '<main class="page bagpage"><p class="empty">Nie ma takiego worka</p></main>';
  const meta = TYPE_META[bag.type] || { label: bag.type || '—', cls: '' };
  const edit = canEdit(bag);
  const groups = GROUPS.map(([st, label, cls]) => {
    const rows = itemsOf(bag.bag_no).filter((i) => i.state === st).sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));
    if (!rows.length) return '';
    return `<section class="group ${cls}"><h2>${label} · ${rows.length}</h2>${rows.map((it) => rowHtml(it, edit)).join('')}</section>`;
  }).join('');
  const tot = totalsOf(state.items, bag.bag_no);
  const gifts = giftText(bag.gifts);
  const bits = [
    state.lockMsg ? `<p class="lock">${esc(state.lockMsg)}</p>` : '',
    bag.status === 'hold' ? '<p class="lock">NIE PAKUJ — worek wstrzymany</p>' : '',
    bag.status === 'done' ? '<p class="okbox">Gotowe ✅</p>' : '',
    state.missingIds.length ? `<p class="missbox">Brakuje odhaczenia: ${esc(missingNames())}</p>` : '',
    `<p class="wno">${esc(bagLabel(bag.bag_no))}</p>`,
    `<p class="client">${esc(bag.client_name || '—')}</p>`,
    `<p class="band ${esc(meta.cls)}">${esc(meta.label)}</p>`,
    bagProofHtml(bag.bag_no, state.photos),
    gifts ? `<p class="gifts">🎁 ${esc(gifts)}</p>` : '',
    bag.note ? `<p class="note"><b>Notatka.</b> ${esc(bag.note)}</p>` : '',
    `<p class="totals">W worku: <b>${tot.pieces} szt</b> · <b>${pln(tot.money)}</b></p>`,
    groups || '<p class="empty">Brak pozycji</p>',
  ];
  return `<main class="page bagpage">${bits.join('')}</main>`;
}
function missingNames() {
  return state.missingIds.map((id) => {
    const it = state.items.find((i) => i.id === id);
    return it ? [it.hanger_no, it.product_name].filter(Boolean).join(' ') : id;
  }).join(', ');
}
function rowHtml(it, edit) {
  const tick = tickFor(it.id);
  const on = !!tick;
  const tickable = (it.state === 'NEW' || it.state === 'OLD');
  let btn = '<span class="tick ghost"></span>';
  if (tickable && edit) {
    btn = `<button type="button" class="tick${on ? ' on' : ''}" data-act="tick" data-id="${esc(it.id)}" aria-pressed="${on}" aria-label="${on ? 'Cofnij odhaczenie' : 'Odhacz'}">${on ? '✓' : ''}</button>`;
  } else if (tickable && on) {
    btn = '<span class="tick on" aria-hidden="true">✓</span>';
  }
  const cams = tickable ? itemProofHtml(it, state.photos) : '';
  const day = it.live_day ? `<span class="day">${esc(it.live_day)}</span>` : '';
  const who = on && tick.user_id !== state.me?.id ? `<div class="by">odhaczone: ${esc(userName(tick.user_id))}</div>` : '';
  const miss = state.missingIds.includes(it.id) ? ' miss' : '';
  const struck = it.state === 'HOLD' ? ' struck' : '';
  return `<article class="row${miss}${struck}">${productThumbHtml(it, state.photos)}<div class="rowtools">${btn}${cams}</div><div><div class="line1">${day}<span class="hanger">${esc(it.hanger_no || '—')}</span></div><div class="pname">${esc(it.product_name || '—')}</div><div class="meta">${esc(String(it.qty ?? 0))} szt · ${pln(it.price)}</div>${who}</div></article>`;
}
function bagFoot() {
  const bag = bagBy(state.bagNo);
  const edit = canEdit(bag);
  const done = edit
    ? `<button type="button" class="btn ok" data-act="done"${state.busy ? ' disabled' : ''}>${state.busy ? 'Zapisuję…' : 'Worek gotowy'}</button>`
    : '';
  return `<footer class="foot">${done}<button type="button" class="btn" data-act="report">Zgłoś błąd</button></footer>`;
}
function pickerView() {
  const opts = ['<option value="">Wybierz dzień</option>'].concat(sortedDays(state.items).map((d) => (
    `<option value="${esc(d)}"${d === state.pickerDay ? ' selected' : ''}>${esc(d)}</option>`
  ))).join('');
  const ready = state.pickerDay && state.pickerNo.trim();
  let hits = '';
  if (!ready) hits = '<p class="hint">Dzień live i numer wieszaka. Sam numer nic nie znajdzie.</p>';
  else {
    const rows = state.items.filter((it) => matchHanger(it, state.pickerDay, state.pickerNo))
      .sort((a, b) => bagNum(a.bag_no) - bagNum(b.bag_no));
    hits = rows.length ? rows.map(pickRow).join('') : '<p class="empty">Nic na tym wieszaku tego dnia</p>';
  }
  return `<main class="page"><label class="lbl" for="hanger">Numer wieszaka</label><input id="hanger" class="search" autocomplete="off" autocapitalize="off" enterkeyhint="search" placeholder="np. 14" value="${esc(state.pickerNo)}"><label class="lbl" for="day">Dzień live</label><select id="day" class="search">${opts}</select>${hits}</main>`;
}
function pickRow(it) {
  const bag = bagBy(it.bag_no);
  const meta = TYPE_META[bag?.type] || { label: bag?.type || '', cls: '' };
  const tick = tickFor(it.id);
  const on = !!tick;
  const tickable = it.state === 'NEW' || it.state === 'OLD';
  const btn = tickable
    ? `<button type="button" class="tick${on ? ' on' : ''}" data-act="tick" data-id="${esc(it.id)}" aria-pressed="${on}" aria-label="${on ? 'Cofnij odhaczenie' : 'Odhacz'}">${on ? '✓' : ''}</button>`
    : '<span class="tick ghost"></span>';
  const tag = GROUPS.find((g) => g[0] === it.state);
  return `<article class="row">${productThumbHtml(it, state.photos)}${btn}<div><div class="line1"><button type="button" class="link" data-act="open" data-bag="${esc(it.bag_no)}">${esc(bagLabel(it.bag_no))}</button>${meta.label ? `<span class="pill ${esc(meta.cls)}">${esc(meta.label)}</span>` : ''}</div><div class="pname">${esc(bag?.client_name || '')}</div><div class="pname">${esc(it.product_name || '—')}</div><div class="meta">${esc(it.live_day || '')} · ${esc(String(it.qty ?? 0))} szt · ${pln(it.price)}${tag && !tickable ? ` · ${tag[1]}` : ''}</div></div></article>`;
}
function photosView() {
  const today = todayLabel();
  const selected = state.photoDay || today;
  let days = withTodayFirst(sortedDays(state.items), today);
  if (selected && !days.includes(selected)) days = [selected, ...days];
  return photosPageHtml({
    days,
    selected,
    number: state.photoNo,
    busy: state.photoBusy,
    grid: latestDayPhotos(state.photos, selected, 30),
    missing: missingHangers(state.items, state.photos, selected),
  });
}
function reportView() {
  const bag = bagBy(state.bagNo);
  const items = itemsOf(state.bagNo).slice().sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));
  const itemOpts = ['<option value="">Cały worek</option>'].concat(items.map((it) => {
    const label = [it.live_day, it.hanger_no, it.product_name].filter(Boolean).join(' · ');
    return `<option value="${esc(it.id)}"${state.report.itemId === it.id ? ' selected' : ''}>${esc(label)}</option>`;
  })).join('');
  const fieldOpts = Object.entries(FIELD_LABEL).map(([k, v]) => (
    `<option value="${k}"${state.report.field === k ? ' selected' : ''}>${esc(v)}</option>`
  )).join('');
  return `<main class="page"><p class="hint">${esc(bagLabel(state.bagNo))} · ${esc(bag?.client_name || '')}</p><label class="lbl" for="rep-item">Pozycja</label><select id="rep-item" class="search">${itemOpts}</select><label class="lbl" for="rep-field">Co jest nie tak</label><select id="rep-field" class="search">${fieldOpts}</select><label class="lbl" for="rep-new">Nowa wartość</label><input id="rep-new" class="search" autocomplete="off" placeholder="Jak ma być" value="${esc(state.report.newValue)}"><label class="lbl" for="rep-why">Powód</label><textarea id="rep-why" class="area" placeholder="Krótko, co widzisz">${esc(state.report.why)}</textarea><button type="button" class="btn primary" data-act="send-report"${state.busy ? ' disabled' : ''}>${state.busy ? 'Wysyłam…' : 'Wyślij do Sergio'}</button><p class="hint">Zmiana wejdzie dopiero po zgodzie Sergio.</p></main>`;
}
function ownerView() {
  const waiting = state.users.filter((u) => u.status === 'waiting')
    .sort((a, b) => String(a.name || a.email || '').localeCompare(String(b.name || b.email || ''), 'pl'));
  const reqs = state.requests.filter((r) => r.status === 'pending')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const people = waiting.length ? waiting.map((u) => `<article class="card static"><span class="client">${esc(u.name || u.email || 'Bez nazwy')}</span><span class="prog">${esc(u.email || '')}</span><span class="rowbtns"><button type="button" class="btn small primary" data-act="user-ok" data-id="${esc(u.id)}">Zatwierdź</button><button type="button" class="btn small danger" data-act="user-no" data-id="${esc(u.id)}">Odrzuć</button></span></article>`).join('') : '<p class="empty">Nikt nie czeka</p>';
  const reqHtml = reqs.length ? reqs.map((r) => {
    const item = state.items.find((i) => i.id === r.item_id);
    const what = item ? [item.hanger_no, item.product_name].filter(Boolean).join(' · ') : 'Cały worek';
    return `<article class="card static"><span class="wno small">${esc(bagLabel(r.bag_no))}</span><span class="client">${esc(what)}</span><span class="prog">${esc(FIELD_LABEL[r.field] || r.field)}</span><span class="prog">${esc(r.old_value || '—')} → ${esc(r.new_value || '')}</span><span class="prog">${esc(r.why || '')}</span><span class="prog">${esc(userName(r.user_id))}</span><span class="rowbtns"><button type="button" class="btn small primary" data-act="req-ok" data-id="${esc(r.id)}">Zatwierdź</button><button type="button" class="btn small danger" data-act="req-no" data-id="${esc(r.id)}">Odrzuć</button></span></article>`;
  }).join('') : '<p class="empty">Brak zgłoszeń</p>';
  return `<main class="page"><p class="hint">Zatwierdzenia przychodzą też na Telegramie. Tutaj zmieniasz tylko status zgłoszenia albo dostęp osoby — nie treść worka.</p><h2>Osoby</h2>${people}<h2>Zgłoszenia</h2>${reqHtml}</main>`;
}

async function onClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t || !document.getElementById('app').contains(t)) return;
  const act = t.dataset.act;
  if (act === 'login') return login();
  if (act === 'logout') return logout();
  if (act === 'refresh') return onRefresh();
  if (act === 'menu') { state.menu = !state.menu; render(); return; }
  if (act === 'closemenu') { state.menu = false; render(); return; }
  if (act === 'filter') { state.filter = t.dataset.id; render(); return; }
  if (act === 'nav') { location.hash = t.dataset.to === 'bags' ? '#/' : `#/${t.dataset.to}`; return; }
  if (act === 'open') { location.hash = `#/bag/${encodeURIComponent(t.dataset.bag)}`; return; }
  if (act === 'back') {
    if (state.viewer) { state.viewer = null; render(); return; }
    location.hash = state.screen === 'report' ? `#/bag/${encodeURIComponent(state.bagNo)}` : '#/';
    return;
  }
  if (act === 'tick') return toggleTick(t.dataset.id);
  if (act === 'cam-item') return shootItem(t.dataset.id);
  if (act === 'cam-bag') return shootBag();
  if (act === 'cam-product') return shootProduct();
  if (act === 'view-item-proof') return openItemProof(t.dataset.id);
  if (act === 'view-bag-proof') return openBagProof(t.dataset.id);
  if (act === 'view-product') return openProduct(t.dataset.day, t.dataset.no, t.dataset.id);
  if (act === 'fill-no') return fillPhotoNo(t.dataset.no);
  if (act === 'v-close') { state.viewer = null; render(); return; }
  if (act === 'v-prev') return viewerStep(-1);
  if (act === 'v-next') return viewerStep(1);
  if (act === 'v-ask') {
    if (state.viewer) { state.viewer.ask = true; render(); }
    return;
  }
  if (act === 'v-keep') {
    if (state.viewer) { state.viewer.ask = false; render(); }
    return;
  }
  if (act === 'v-delete') return deleteCurrentPhoto();
  if (act === 'done') return doneBag();
  if (act === 'report') { location.hash = `#/report/${encodeURIComponent(state.bagNo)}`; return; }
  if (act === 'send-report') return sendReport();
  if (act === 'req-ok') return decideRequest(t.dataset.id, 'approved');
  if (act === 'req-no') {
    if (confirm('Odrzucić zgłoszenie?')) return decideRequest(t.dataset.id, 'rejected');
    return;
  }
  if (act === 'user-ok') return decideUser(t.dataset.id, 'approved');
  if (act === 'user-no' && confirm('Odebrać dostęp tej osobie?')) return decideUser(t.dataset.id, 'removed');
}
function onInput(e) {
  const el = e.target;
  if (el.id === 'q') {
    state.query = el.value;
    const list = document.getElementById('list');
    if (list) list.innerHTML = bagListHtml();
    return;
  }
  if (el.id === 'hanger') { state.pickerNo = el.value; render(); return; }
  if (el.id === 'day') { state.pickerDay = el.value; render(); return; }
  if (el.id === 'photo-no') { state.photoNo = el.value; return; }
  if (el.id === 'photo-day') { state.photoDay = el.value; render(); return; }
  if (el.id === 'rep-item') state.report.itemId = el.value;
  if (el.id === 'rep-field') state.report.field = el.value;
  if (el.id === 'rep-new') state.report.newValue = el.value;
  if (el.id === 'rep-why') state.report.why = el.value;
}
function currentUserId() {
  return state.session?.user?.id || state.me?.id || '';
}
function syncViewer() {
  if (!state.viewer) return;
  const ids = state.viewer.ids.filter((id) => state.photos.some((p) => p.id === id));
  if (!ids.length) {
    state.viewer = null;
    return;
  }
  const cur = state.viewer.ids[state.viewer.index];
  let index = ids.indexOf(cur);
  if (index < 0) index = Math.min(state.viewer.index, ids.length - 1);
  state.viewer.ids = ids;
  state.viewer.index = index;
}
function prepareViewer() {
  syncViewer();
}
function viewerPhoto() {
  if (!state.viewer) return null;
  const id = state.viewer.ids[state.viewer.index];
  return state.photos.find((p) => p.id === id) || null;
}
function viewerBlock() {
  const photo = viewerPhoto();
  if (!photo || !state.viewer) return '';
  return viewerHtml({
    path: photo.path,
    name: userName(photo.user_id),
    stamp: photoStamp(photo.created_at),
    index: state.viewer.index,
    total: state.viewer.ids.length,
    canDelete: photo.user_id === currentUserId(),
    ask: !!state.viewer.ask,
    busy: state.photoBusy,
  });
}
function openViewer(list, index) {
  if (!list.length) return;
  const i = Math.max(0, Math.min(index, list.length - 1));
  state.viewer = { ids: list.map((p) => p.id), index: i, ask: false };
  render();
}
function openItemProof(itemId) {
  const list = proofForItem(state.photos, itemId);
  if (!list.length) return;
  openViewer(list, list.length - 1);
}
function openBagProof(focusId) {
  const list = proofForBag(state.photos, state.bagNo);
  if (!list.length) return;
  const index = Math.max(0, list.findIndex((p) => p.id === focusId));
  openViewer(list, index);
}
function openProduct(day, no, focusId) {
  const list = productPhotosFor(state.photos, day, no);
  if (!list.length) return;
  let index = list.length - 1;
  if (focusId) {
    const found = list.findIndex((p) => p.id === focusId);
    if (found >= 0) index = found;
  }
  openViewer(list, index);
}
function viewerStep(delta) {
  if (!state.viewer || state.viewer.ask) return;
  const next = state.viewer.index + delta;
  if (next < 0 || next >= state.viewer.ids.length) return;
  state.viewer.index = next;
  state.viewer.ask = false;
  render();
}
function fillPhotoNo(no) {
  if (state.photoBusy) return;
  state.photoNo = no || '';
  render();
  const el = document.getElementById('photo-no');
  if (el) {
    el.focus();
    try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* numeric input */ }
  }
}
function ensureCam() {
  let input = document.getElementById('cam-file');
  if (input) return input;
  input = document.createElement('input');
  input.id = 'cam-file';
  input.className = 'cam-file';
  input.type = 'file';
  input.accept = 'image/*';
  input.setAttribute('capture', 'environment');
  input.tabIndex = -1;
  input.addEventListener('change', onCamFile);
  document.body.appendChild(input);
  return input;
}
function shoot(spec) {
  if (state.photoBusy || !spec) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    toast(MSG_FAIL);
    return;
  }
  pendingShot = spec;
  const input = ensureCam();
  input.value = '';
  input.click();
}
function shootItem(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item || (item.state !== 'NEW' && item.state !== 'OLD') || !item.bag_no) return;
  shoot({ kind: 'proof', bag_no: item.bag_no, item_id: item.id });
}
function shootBag() {
  if (!state.bagNo) return;
  shoot({ kind: 'proof', bag_no: state.bagNo, item_id: null });
}
function shootProduct() {
  const day = document.getElementById('photo-day')?.value || state.photoDay || todayLabel();
  const no = (document.getElementById('photo-no')?.value ?? state.photoNo).trim();
  state.photoDay = day;
  state.photoNo = no;
  if (!day || !no) {
    toast('Wpisz numer wieszaka');
    document.getElementById('photo-no')?.focus();
    return;
  }
  shoot({ kind: 'product', live_day: day, hanger_no: no });
}
async function onCamFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  const spec = pendingShot;
  pendingShot = null;
  if (!file || !spec || state.photoBusy) return;
  if (file.type && !file.type.startsWith('image/')) {
    toast(MSG_FAIL);
    return;
  }
  await savePhoto(spec, file);
}
async function savePhoto(spec, file) {
  const userId = currentUserId();
  if (!userId || state.photoBusy) {
    toast(MSG_FAIL);
    return;
  }
  state.photoBusy = true;
  render();
  toast(MSG_SENDING, 120000);
  try {
    if (!navigator.onLine) throw new Error('offline');
    const blob = await resizeToJpeg(file);
    const id = uuid();
    const row = buildPhotoRow(spec, id, userId, new Date().toISOString());
    const up = await sb.storage.from('pak-photos').upload(row.path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (up.error) throw up.error;
    const ins = await sb.from('pak_photos').insert(row);
    if (ins.error) {
      try { await sb.storage.from('pak-photos').remove([row.path]); } catch { /* upload is already undone best-effort */ }
      throw ins.error;
    }
    if (!state.photos.some((p) => p.id === row.id)) state.photos.push(row);
    if (spec.kind === 'product') {
      state.photoDay = spec.live_day;
      state.photoNo = '';
    }
    state.photoBusy = false;
    render();
    toast(MSG_SAVED);
    if (spec.kind === 'product' && state.screen === 'photos') document.getElementById('photo-no')?.focus();
  } catch {
    state.photoBusy = false;
    render();
    toast(MSG_FAIL);
  }
}
function storageGone(error) {
  const msg = `${error?.message || ''} ${error?.status || error?.statusCode || ''}`.toLowerCase();
  return msg.includes('not found') || msg.includes('404');
}
async function deleteCurrentPhoto() {
  const photo = viewerPhoto();
  const userId = currentUserId();
  if (!photo || !state.viewer || state.photoBusy || photo.user_id !== userId) return;
  state.photoBusy = true;
  render();
  let storageError = null;
  try {
    const res = await sb.storage.from('pak-photos').remove([photo.path]);
    storageError = res.error;
  } catch (err) {
    storageError = err;
  }
  if (storageError && !storageGone(storageError)) {
    state.photoBusy = false;
    if (state.viewer) state.viewer.ask = false;
    render();
    toast('Nie udało się usunąć zdjęcia');
    return;
  }
  let delError = null;
  try {
    const res = await sb.from('pak_photos').delete().eq('id', photo.id).eq('user_id', userId);
    delError = res.error;
  } catch (err) {
    delError = err;
  }
  state.photoBusy = false;
  if (delError) {
    if (state.viewer) state.viewer.ask = false;
    render();
    toast('Nie udało się usunąć zdjęcia');
    return;
  }
  dropSigned(photo.path);
  state.photos = state.photos.filter((p) => p.id !== photo.id);
  if (state.viewer) {
    const ids = state.viewer.ids.filter((id) => id !== photo.id);
    if (!ids.length) state.viewer = null;
    else {
      state.viewer.ids = ids;
      state.viewer.index = Math.min(state.viewer.index, ids.length - 1);
      state.viewer.ask = false;
    }
  }
  render();
  toast('Zdjęcie usunięte');
}
let signedRetry = 0;
function paintSigned() {
  const root = document.getElementById('app');
  if (!root) return;
  const imgs = [...root.querySelectorAll('img[data-path]')];
  const missing = [];
  for (const img of imgs) {
    const path = img.getAttribute('data-path');
    const url = cachedSigned(path);
    if (url) applySignedSrc(img, url);
    else if (path) missing.push(path);
  }
  if (!missing.length) return;
  const gen = ++signGen;
  signPaths(sb, missing).then(() => {
    if (gen !== signGen) return;
    for (const img of imgs) {
      if (!img.isConnected) continue;
      const url = cachedSigned(img.getAttribute('data-path'));
      if (url) applySignedSrc(img, url);
    }
  }).catch(() => {});
}
function applySignedSrc(img, url) {
  if (img.dataset.src === url) return;
  img.dataset.src = url;
  img.dataset.retried = '';
  img.onerror = () => {
    const path = img.getAttribute('data-path');
    if (!path || img.dataset.retried === '1') return;
    img.dataset.retried = '1';
    dropSigned(path);
    const gen = ++signedRetry;
    signPaths(sb, [path]).then(() => {
      if (gen !== signedRetry || !img.isConnected) return;
      const next = cachedSigned(path);
      if (next) {
        img.dataset.src = next;
        img.src = next;
      }
    }).catch(() => {});
  };
  img.src = url;
}
function bindViewer() {
  const el = document.getElementById('viewer');
  if (!el) return;
  let tracking = false;
  let px = 0;
  let py = 0;
  el.addEventListener('pointerdown', (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    if (ev.target.closest('button, a, input, select, textarea')) return;
    tracking = true;
    px = ev.clientX;
    py = ev.clientY;
    try { el.setPointerCapture(ev.pointerId); } catch { /* already released */ }
  });
  el.addEventListener('pointerup', (ev) => {
    if (!tracking) return;
    tracking = false;
    if (!state.viewer || state.viewer.ask) return;
    const dx = ev.clientX - px;
    const dy = ev.clientY - py;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    viewerStep(dx < 0 ? 1 : -1);
  });
  el.addEventListener('pointercancel', () => { tracking = false; });
}

function readLoginError() {
  const params = new URLSearchParams(location.search);
  state.loginError = params.get('error_description') || params.get('error') || '';
}

function start() {
  const root = document.getElementById('app');
  ensureCam();
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'photo-no') {
      e.preventDefault();
      shootProduct();
    }
  });
  window.addEventListener('keydown', (e) => {
    if (!state.viewer) return;
    if (e.key === 'Escape') { state.viewer = null; render(); }
    else if (e.key === 'ArrowLeft') viewerStep(-1);
    else if (e.key === 'ArrowRight') viewerStep(1);
  });
  window.addEventListener('hashchange', () => {
    if (state.me?.status === 'approved') route();
  });
  window.addEventListener('online', () => { paintBanner(); flushQueue(); });
  window.addEventListener('offline', () => { paintBanner(); if (state.me) render(); });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.session) flushQueue();
  });
  setInterval(() => { if (state.session) flushQueue(); }, 20000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  readLoginError();
  render();
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') { state.session = session; return; }
    if (event === 'SIGNED_OUT') {
      state.session = null; state.me = null; state.screen = 'login'; render(); return;
    }
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      const same = session?.user?.id && state.session?.user?.id === session.user.id && state.me;
      if (same && state.screen !== 'boot' && state.screen !== 'login') return;
      enter(session);
    }
  });
}
if (typeof document !== 'undefined') start();
