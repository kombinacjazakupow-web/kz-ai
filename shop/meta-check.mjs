import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { META_PIXEL_ID, metaOn, metaPayload, metaPurchase, previewTotals } from './common.js';

assert.equal(META_PIXEL_ID, '2239797080173159');
assert.equal(metaOn(), true);
assert.equal(metaOn(''), false);
assert.equal(metaOn('abc'), false);
assert.equal(metaOn('12345'), true);

const bought = metaPurchase(94, 'KS1040');
assert.deepEqual(bought, { event: 'Purchase', params: { value: 94, currency: 'PLN' }, eventID: 'KS1040' });
assert.equal(metaPurchase('nope', 'KS1'), null);

const dirty = metaPayload('Purchase', {
  value: 28,
  currency: 'PLN',
  email: 'anna@example.com',
  phone: '500600700',
  name: 'Anna Test',
  address: 'Testowa 1',
  street: 'Testowa 1',
  city: 'Warszawa',
  postcode: '00-001',
  em: 'hash',
  ph: 'hash',
}, 'KS1');
assert.deepEqual(dirty.params, { value: 28, currency: 'PLN' });
assert.equal(dirty.eventID, 'KS1');
const packed = JSON.stringify(dirty);
assert.equal(packed.includes('anna@example.com'), false);
assert.equal(packed.includes('500600700'), false);
assert.equal(packed.includes('Anna Test'), false);
assert.equal(packed.includes('Testowa'), false);
assert.equal(packed.includes('Warszawa'), false);

const shop = readFileSync(new URL('./shop.js', import.meta.url), 'utf8');
assert.match(shop, /Akceptuję/);
assert.match(shop, /Odrzucam/);
assert.match(shop, /connect\.facebook\.net\/en_US\/fbevents\.js/);
assert.match(shop, /if \(!metaOn\(\) \|\| metaChoice\(\) !== 'yes'\) return;/);
assert.match(shop, /trackMeta\('ViewContent'/);
assert.match(shop, /trackMeta\('AddToCart'/);
assert.match(shop, /trackMeta\('InitiateCheckout'/);
assert.match(shop, /value: totals\.preview/);
assert.doesNotMatch(shop, /totals\.total/);
assert.equal(previewTotals([{ price: 70, qty: 1 }]).preview, 95);
assert.equal(previewTotals([{ price: 70, qty: 1 }]).total, undefined);
assert.match(shop, /metaPurchase\(body\.to_pay_now, body\.order_no\)/);
assert.match(shop, /window\.fbq\('track', clean\.event, clean\.params/);
assert.match(shop, /metaChoice\(\) !== 'yes'/);
assert.doesNotMatch(shop, /fbq\('init'[^)]*email|fbq\('track'[^)]*phone|fbq\('track'[^)]*address/);

console.log('meta-check ok');
