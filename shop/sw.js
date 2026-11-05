// Shop shell only. Packing keeps its own worker at /pakowanie/sw.js.
const CACHE = 'kombi-sklep-shell-v11';
const SHELL = [
  './',
  './index.html',
  './shop.css',
  './shop.js',
  './common.js',
  './account.js',
  './variants.js',
  './window.js',
  './buy.js',
  './checkout.js',
  './los.js',
  './rolki.js',
  './install.js',
  './soon.js',
  './admin.html',
  './admin.js',
  './regulamin.html',
  './prywatnosc.html',
  './zwroty.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
];

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
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.hostname.includes('supabase')) return;
  if (url.origin !== self.location.origin || url.search) return;
  if (!isShell(url)) return;
  event.respondWith(networkFirst(req));
});

function isShell(url) {
  return SHELL.some((item) => new URL(item, self.registration.scope).pathname === url.pathname);
}

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
