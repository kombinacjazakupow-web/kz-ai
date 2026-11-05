// Shop shell only. Packing keeps its own worker at /pakowanie/sw.js.
// This worker stores the listed shop files and never stores Supabase
// responses, so prices, stock and orders are not kept in the cache.
import { SHELL, shellAction } from './shell-policy.js';

const CACHE = 'kombi-sklep-shell-v12';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('kombi-sklep-shell-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const action = shellAction({
    url: event.request.url,
    method: event.request.method,
    origin: self.location.origin,
    scope: self.registration.scope,
    shell: SHELL,
  });
  if (action !== 'shell') return;
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const page = await caches.match('./index.html');
      if (page) return page;
    }
    throw err;
  }
}
