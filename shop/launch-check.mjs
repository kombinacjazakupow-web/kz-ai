import assert from 'node:assert/strict';
import {
  SLOGANS, LAUNCH_BANNER, PAY_WINDOW, PROOF_OK, LUCKY_LABEL,
  pickSlogan, proofObjectPath, proofKind, mapProofResult, parseRoute, videoSrc, rememberOrder,
  orderAttemptKey, buildOrderPayload, ORDER_UNSURE,
} from './common.js';

const expected = [
  'Kombi szansa',
  'Elastyczne erotyczne',
  'Całujemy od wszędzie',
  'Aide Dziewczyny',
  'Co robiliście dzisiaj, z kim zrobiliście, dlaczego zrobiliście, ale najważniejsze \u2013 czy to dobrze zrobiliście?',
  'To kosztuje 1599 zł dla innych, a dla ciebie tylko 29',
  'Białuszka, Beżoweszka, Granatuszka \u2013 ooo zajebuszka',
];

assert.equal(SLOGANS.length, 7);
assert.deepEqual(SLOGANS, expected);
assert.equal(new Set(SLOGANS).size, 7);
for (let i = 0; i < 40; i += 1) assert.ok(expected.includes(pickSlogan()));
assert.equal(pickSlogan(() => 0), expected[0]);
assert.equal(pickSlogan(() => 0.999), expected[6]);

assert.equal(LAUNCH_BANNER, '04.11.2026 \u2013 startujemy z naszą pierwszą aplikacją! \u{1F389} Ceny startowe dla pierwszych zamówień w aplikacji.');
assert.equal(PAY_WINDOW, 'Zapłać w ciągu 1 godziny i dołącz potwierdzenie');
assert.equal(PROOF_OK, 'Potwierdzenie wysłane \u2705 \u2013 sprawdzimy i potwierdzimy');
assert.equal(LUCKY_LABEL, 'Wylosuj swoje szczęście \u{1F340}');

const id = '11111111-1111-4111-8111-111111111111';
assert.equal(proofObjectPath('KS1029', 'jpg', id), `KS1029/${id}.jpg`);
assert.equal(proofObjectPath('../KS1029', 'jpg', id), '');
assert.equal(proofObjectPath('KS1029', 'gif', id), '');
assert.equal(proofKind({ name: 'a.JPG', type: '' })?.ext, 'jpg');
assert.equal(proofKind({ name: 'a.gif', type: 'image/gif' }), null);
assert.equal(mapProofResult('ok').ok, true);
assert.match(mapProofResult('phone').message, /telefon/);
assert.equal(parseRoute('#/moje').name, 'orders');
assert.equal(videoSrc('https://cdn.example/a.mp4'), 'https://cdn.example/a.mp4');
assert.equal(videoSrc('javascript:alert(1)'), '');
const kept = rememberOrder([], { order_no: 'KS1029', phone: '796 669 157' });
assert.equal(kept[0].order_no, 'KS1029');
assert.equal(kept[0].phone, '796669157');
const newer = rememberOrder(kept, { order_no: 'KS1030', phone: '500600700' });
const replayed = newer.slice().reverse().reduce((list, row) => rememberOrder(list, row), []);
assert.deepEqual(replayed.map((row) => row.order_no), ['KS1030', 'KS1029']);
assert.equal(kept[0].to_pay_now, undefined);
const paid = rememberOrder([], { order_no: 'KS1040', phone: '500600700', to_pay_now: 94, payment: 'blik', cod_amount: 0, products_total: 69, delivery_fee: 25 });
assert.equal(paid[0].to_pay_now, 94);
assert.equal(paid[0].payment, 'blik');
assert.equal(paid[0].delivery_fee, 25);
const paidAgain = rememberOrder(paid, paid[0]);
assert.equal(paidAgain[0].to_pay_now, 94);

const attempt = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
assert.equal(orderAttemptKey(attempt, () => 'fresh'), attempt);
assert.notEqual(orderAttemptKey('', () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), attempt);
const form = { name: 'Anna Test', phone: '500 600 700', email: '', street: 'Testowa 1', postcode: '00-001', city: 'Warszawa', delivery: 'dpd_home', payment: 'blik', note: '' };
const once = buildOrderPayload(form, [{ product_id: id, qty: 1, size: '', color: '' }], attempt);
const twice = buildOrderPayload(form, [{ product_id: id, qty: 1, size: '', color: '' }], attempt);
assert.equal(once.client_key, attempt);
assert.equal(twice.client_key, once.client_key);
assert.match(ORDER_UNSURE, /Moje zamówienia/);
assert.match(ORDER_UNSURE, /zanim wyślesz/);

console.log('launch-check ok');
