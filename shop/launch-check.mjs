import assert from 'node:assert/strict';
import {
  SLOGANS, LAUNCH_BANNER, PAY_WINDOW, PROOF_OK, LUCKY_LABEL,
  pickSlogan, proofObjectPath, proofKind, mapProofResult, parseRoute, videoSrc, rememberOrder,
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

console.log('launch-check ok');
