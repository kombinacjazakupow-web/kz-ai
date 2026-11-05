import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shellAction, SHELL } from './shell-policy.js';

const origin = 'https://kombinacjazakupow.pl';
const scope = `${origin}/shop/`;
const args = { origin, scope, shell: SHELL };

assert.equal(shellAction({ ...args, method: 'GET', url: `${scope}shop.js` }), 'shell');
assert.equal(shellAction({ ...args, method: 'GET', url: `${scope}` }), 'shell');
assert.equal(shellAction({ ...args, method: 'POST', url: `${scope}shop.js` }), 'bypass');
assert.equal(shellAction({
  ...args,
  method: 'GET',
  url: 'https://ghhatjkcgilnruluhxyr.supabase.co/rest/v1/shop_products?select=price,stock',
}), 'bypass');
assert.equal(shellAction({
  ...args,
  method: 'GET',
  url: 'https://ghhatjkcgilnruluhxyr.supabase.co/rest/v1/shop_orders',
}), 'bypass');
assert.equal(shellAction({
  ...args,
  method: 'GET',
  url: `${scope}shop.js?price=1`,
}), 'bypass');
assert.equal(shellAction({ ...args, method: 'GET', url: `${origin}/pakowanie/app.js` }), 'bypass');
assert.equal(shellAction({ ...args, method: 'GET', url: 'https://cdn.jsdelivr.net/npm/inter.woff2' }), 'bypass');

const manifest = JSON.parse(readFileSync(new URL('./manifest.webmanifest', import.meta.url), 'utf8'));
assert.equal(manifest.name, 'KOMBI Sklep');
assert.equal(manifest.scope, './');
assert.equal(manifest.start_url, './');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.theme_color, '#533afd');
for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png']) {
  const icon = manifest.icons.find((item) => item.src === name);
  assert.ok(icon, name);
  const bytes = readFileSync(new URL(`./${name}`, import.meta.url));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  const side = bytes.readUInt32BE(16);
  assert.equal(side, name.includes('512') ? 512 : 192);
  assert.equal(bytes.readUInt32BE(20), side);
}

const links = JSON.parse(readFileSync(new URL('../.well-known/assetlinks.json', import.meta.url), 'utf8'));
assert.equal(links[0].target.package_name, 'pl.kombinacjazakupow.sklep');
assert.equal(links[0].target.sha256_cert_fingerprints[0], 'REPLACE_WITH_PLAY_APP_SIGNING_SHA256');
assert.equal(links[0].relation[0], 'delegate_permission/common.handle_all_urls');

const doc = readFileSync(new URL('../docs/ANDROID-TWA.md', import.meta.url), 'utf8');
assert.match(doc, /bubblewrap init --manifest=https:\/\/kombinacjazakupow\.pl\/shop\/manifest\.webmanifest/);
assert.match(doc, /https:\/\/kombinacjazakupow\.pl\/\.well-known\/assetlinks\.json/);
assert.match(doc, /pl\.kombinacjazakupow\.sklep/);
assert.match(doc, /Google Play developer account/);
assert.match(doc, /signing key/i);
assert.match(doc, /Apple/);
assert.match(doc, /Do not start that project/);
assert.match(doc, /There is no 06:00 gate/);

const packing = readFileSync(new URL('../pakowanie/sw.js', import.meta.url), 'utf8');
assert.match(packing, /kombi-shell-v2/);
assert.doesNotMatch(packing, /kombi-sklep-shell-/);
const shopWorker = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
assert.match(shopWorker, /startsWith\('kombi-sklep-shell-'\)/);
assert.doesNotMatch(shopWorker, /kombi-shell-v/);

console.log('twa-check ok');
