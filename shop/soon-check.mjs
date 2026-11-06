import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INTEREST_KEY, SOON, toggleInterest } from './soon.js';

assert.equal(INTEREST_KEY, 'kombi-shop-interest');
assert.deepEqual(SOON.map((item) => item.title), ['Karta VIP', 'Promocje przy kilku sztukach', 'Hurt i zestawy']);
assert.deepEqual(toggleInterest([], 'vip'), ['vip']);
assert.deepEqual(toggleInterest(['vip'], 'vip'), []);
assert.deepEqual(toggleInterest(['vip'], 'nope'), ['vip']);
assert.deepEqual(toggleInterest('vip', 'multi'), ['multi']);
const shop = readFileSync(new URL('./shop.js', import.meta.url), 'utf8');
assert.doesNotMatch(shop, /Daj mi znać/);
assert.match(shop, /Zapisz na tym telefonie/);
assert.match(shop, /Nie wysyłamy tego nikomu/);
console.log('soon-check ok');
