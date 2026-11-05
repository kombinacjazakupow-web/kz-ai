// Decides what the shop service worker may store.
// Prices, stock and orders come from Supabase and must stay on the network.
export const SHELL = [
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
  './shell-policy.js',
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

export function shellAction({ url, method, origin, scope, shell = SHELL }) {
  if (method !== 'GET') return 'bypass';
  let parsed;
  try { parsed = new URL(url, origin); } catch { return 'bypass'; }
  const host = parsed.hostname;
  if (host === 'supabase.co' || host.endsWith('.supabase.co')) return 'bypass';
  if (!origin || parsed.origin !== origin) return 'bypass';
  if (parsed.search) return 'bypass';
  const scopeUrl = new URL(scope || './', origin);
  const listed = shell.some((item) => new URL(item, scopeUrl).pathname === parsed.pathname);
  return listed ? 'shell' : 'bypass';
}
