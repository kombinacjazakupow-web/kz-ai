import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLIK_COPY, BLIK_LINE, TRANSFER_COPY, TRANSFER_LINE, payPopup } from './common.js';

const blik = payPopup({ payment: 'blik', to_pay_now: 94, order_no: 'KS1040' });
assert.equal(blik.title, 'Zrób przelew ze swojego banku');
assert.equal(blik.amountText, '94,00 zł');
assert.equal(blik.blik, BLIK_LINE);
assert.equal(blik.transfer, TRANSFER_LINE);
assert.equal(blik.titleLine, 'W tytule wpisz numer zamówienia: KS1040');
assert.equal(blik.copies.blik, BLIK_COPY);
assert.equal(blik.copies.transfer, TRANSFER_COPY);
assert.equal(blik.copies.orderNo, 'KS1040');
assert.equal(blik.copies.amount, '94,00 zł');

const cod = payPopup({ payment: 'cod', to_pay_now: 28, order_no: 'KS1041' });
assert.equal(cod.amountText, '28,00 zł');
assert.equal(cod.copies.amount, '28,00 zł');
assert.equal(payPopup({ payment: 'cod', to_pay_now: 28, order_no: 'KS1041' }).title, blik.title);
assert.equal(payPopup({ payment: 'card', to_pay_now: 10, order_no: 'KS1' }), null);
assert.equal(payPopup({ payment: 'blik', order_no: 'KS1' }), null);

const shop = readFileSync(new URL('./shop.js', import.meta.url), 'utf8');
assert.match(shop, /id="pay-modal" role="dialog" aria-modal="true"/);
assert.match(shop, /data-act="pay-close">Rozumiem/);
assert.match(shop, /state\.payModal = !!payPopup\(thanks\)/);

console.log('pay-check ok');
