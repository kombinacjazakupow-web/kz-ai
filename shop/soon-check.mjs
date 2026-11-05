import assert from 'node:assert/strict';
import { INTEREST_KEY, SOON, toggleInterest } from './soon.js';

assert.equal(INTEREST_KEY, 'kombi-shop-interest');
assert.deepEqual(SOON.map((item) => item.title), ['Karta VIP', 'Promocje przy kilku sztukach', 'Hurt i zestawy']);
assert.deepEqual(toggleInterest([], 'vip'), ['vip']);
assert.deepEqual(toggleInterest(['vip'], 'vip'), []);
assert.deepEqual(toggleInterest(['vip'], 'nope'), ['vip']);
assert.deepEqual(toggleInterest('vip', 'multi'), ['multi']);
console.log('soon-check ok');
