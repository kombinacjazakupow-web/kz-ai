import assert from 'node:assert/strict';
import { buyLabel } from './buy.js';
import { BLIK_COPY, SLOGANS } from './common.js';

assert.equal(buyLabel('69,00 zł', false), 'Dodaj do koszyka · 69,00 zł');
assert.equal(buyLabel('69,00 zł', true), 'WYPRZEDANE');
assert.equal(SLOGANS.length, 7);
assert.equal(BLIK_COPY, '796 669 157');
console.log('buy-check ok');
