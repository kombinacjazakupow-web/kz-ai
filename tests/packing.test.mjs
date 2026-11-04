import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  .replace(
    /^import \{ createClient \} from 'https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.45\.4\/\+esm';/m,
    'const createClient = () => ({ auth: { onAuthStateChange() {} }, channel() { return { on() { return this; }, subscribe() {} }; }, removeAllChannels() {} });',
  );
const mod = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('flush keeps ticks queued during an in-flight resend', () => {
  const during = [
    { op: 'insert', id: 'old' },
    { op: 'insert', id: 'new-while-flushing' },
    { op: 'delete', id: 'still-offline' },
  ];
  const left = mod.finishFlush(during, ['insert:old']);
  assert.deepEqual(left.map((job) => job.id), ['new-while-flushing', 'still-offline']);
});

test('offline queue is per user and logout clears that user', () => {
  assert.equal(mod.queueStorageKey('anna'), 'kombi-tick-queue:anna');
  assert.equal(mod.queueStorageKey('bartek'), 'kombi-tick-queue:bartek');
  assert.notEqual(mod.queueStorageKey('anna'), mod.queueStorageKey('bartek'));
  assert.equal(mod.queueStorageKey(''), '');
  const store = new Map();
  const storage = {
    removeItem(key) { store.delete(key); },
  };
  store.set('kombi-tick-queue:anna', '[{"op":"insert"}]');
  store.set('kombi-tick-queue', '[{"op":"insert","id":"legacy"}]');
  store.set('kombi-tick-queue:bartek', '[{"op":"insert","id":"keep"}]');
  mod.clearStoredQueue('anna', storage);
  assert.equal(store.has('kombi-tick-queue:anna'), false);
  assert.equal(store.has('kombi-tick-queue'), false);
  assert.equal(store.has('kombi-tick-queue:bartek'), true);
});

test('hanger ticks are blocked on done and hold bags', () => {
  assert.equal(mod.canTickBag({ status: 'done' }), false);
  assert.equal(mod.canTickBag({ status: 'hold' }), false);
  assert.equal(mod.canTickBag({ status: 'to_pack' }), true);
  assert.equal(mod.canTickBag({ status: 'packing' }), true);
  assert.equal(mod.canTickBag(null), false);
});

test('toast text survives a redraw', () => {
  mod.toast('Worek wstrzymany — bez odhaczeń');
  assert.equal(mod.currentToast(), 'Worek wstrzymany — bez odhaczeń');
  const src = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const renderAt = src.indexOf('root.innerHTML = shell();');
  const after = src.slice(renderAt, renderAt + 80);
  assert.match(after, /paintToast\(\)/);
  mod.toast('');
  assert.equal(mod.currentToast(), '');
});

test('done waits for the flush already in flight', () => {
  const src = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(src, /if \(!flushWait\) flushWait = runFlush\(\)/);
  assert.match(src, /if \(loadQueue\(\)\.length \|\| flushWait\) await flushQueue\(\)/);
});

test('a late tick reload is ignored after a newer local tick', () => {
  assert.equal(mod.ticksResponseFresh(3, 3), true);
  assert.equal(mod.ticksResponseFresh(3, 4), false);
  const late = mod.keepFreshTicks(
    [{ id: 'older', item_id: 'line-1' }],
    [{ id: 'just-saved', item_id: 'line-2', user_id: 'u', created_at: '2026-11-04T00:00:00Z' }],
    [],
  );
  assert.deepEqual(late.still.map((row) => row.id), ['just-saved']);
  const caughtUp = mod.keepFreshTicks(
    [{ id: 'just-saved', item_id: 'line-2' }],
    [{ id: 'just-saved', item_id: 'line-2' }],
    [],
  );
  assert.deepEqual(caughtUp.still, []);
  const removed = mod.keepFreshTicks([{ id: 'just-saved', item_id: 'line-2' }], [], ['just-saved']);
  assert.deepEqual(removed.incoming, []);
});

test('paging walks past the 1000 row cap and stops on a short page', async () => {
  const all = Array.from({ length: 2500 }, (_, i) => ({ id: `t${i}` }));
  const rows = await mod.collectPages(1000, async (from, to) => all.slice(from, to + 1));
  assert.equal(rows.length, 2500);
  assert.equal(rows[0].id, 't0');
  assert.equal(rows[2499].id, 't2499');
});

test('paging does not loop when a page repeats rows', async () => {
  let calls = 0;
  const rows = await mod.collectPages(2, async () => {
    calls += 1;
    if (calls > 4) throw new Error('paged forever');
    return [{ id: 'a' }, { id: 'b' }];
  });
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b']);
  assert.equal(calls, 2);
});
