import assert from 'node:assert/strict';
import { buyerLine, hasSavedBuyer, savedBuyerOk, storedBuyer } from './checkout.js';
import { BLIK_COPY, COD_NOTE, SLOGANS } from './common.js';

const full = { name: 'Anna Test', phone: '500600700', street: 'Testowa 1', postcode: '00-001', city: 'Warszawa' };
assert.equal(hasSavedBuyer(full), true);
assert.equal(hasSavedBuyer({ ...full, city: ' ' }), false);
assert.equal(savedBuyerOk(full), true);
assert.equal(savedBuyerOk({ ...full, phone: '12' }), false);
assert.equal(savedBuyerOk({ ...full, postcode: 'warszawa' }), false);
assert.equal(buyerLine(full), 'Anna Test · 500600700 · Testowa 1 · 00-001 · Warszawa');
assert.equal(storedBuyer(full), null);
assert.equal(storedBuyer({ ...full, remember: true }).name, 'Anna Test');
assert.match(COD_NOTE, /28 zł/);
assert.equal(BLIK_COPY, '796 669 157');
assert.equal(SLOGANS.length, 7);
console.log('checkout-check ok');
