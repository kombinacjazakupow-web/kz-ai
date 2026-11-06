import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { facebookClip, facebookPlayer, soldShopLine } from './common.js';
import { liveStockText } from './variants.js';

const shared = { id: 'p1', colors: 'czarny, ecru', stock: 21 };
assert.equal(liveStockText(shared, []), 'Zostało: dużo sztuk.');
assert.equal(liveStockText({ id: 'p1', colors: 'czarny', stock: 20 }, []), 'Zostało: 20.');
assert.equal(liveStockText({ id: 'p1', stock: 0 }, []), 'Zostało: 0.');
assert.equal(liveStockText({ id: 'p1' }, []), '');

const split = { id: 'p2', colors: 'czarny, ecru', stock: 4 };
const rows = [
  { product_id: 'p2', color: 'czarny', stock: 3 },
  { product_id: 'p2', color: 'ecru', stock: 25 },
];
assert.equal(liveStockText(split, rows), 'Zostało: dużo sztuk. czarny: 3. ecru: dużo sztuk.');

assert.equal(soldShopLine(0), '');
assert.equal(soldShopLine(null), '');
assert.equal(soldShopLine('4'), 'Sprzedane w sklepie: 4');
assert.equal(soldShopLine(-1), '');

const clip = 'https://www.facebook.com/kombinacjazakupow/videos/99887766';
assert.equal(facebookClip(clip), clip);
assert.equal(facebookClip('https://www.facebook.com/watch/?v=55'), 'https://www.facebook.com/watch/?v=55');
assert.equal(facebookClip('https://evil.example/videos/1'), '');
assert.equal(facebookClip('javascript:alert(1)'), '');
assert.equal(new URL(facebookPlayer(clip, true)).searchParams.get('href'), clip);

const shop = readFileSync(new URL('./shop.js', import.meta.url), 'utf8');
assert.match(shop, /Jak na live/);
assert.match(shop, /Zobacz film i komentarze na Facebooku/);
assert.match(shop, /Fragment z live/);
assert.match(shop, /sb\.rpc\('shop_sold_counts'\)/);
assert.match(shop, /catch \{\s*state\.soldCounts = null;/);

console.log('live-check ok');
