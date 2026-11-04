import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  claimMessage, clientStatus, emailOk, mergeAccountOrders, orderSourceLabel, promoProduct,
  shouldShowPromo, trackUrl, PROMO_CODE,
} from './account.js';
import { BLIK_COPY, TRANSFER_COPY, SLOGANS, parseRoute } from './common.js';

assert.equal(clientStatus('new'), 'Przyjęte');
assert.equal(clientStatus('paid'), 'Przyjęte');
assert.equal(clientStatus('packed'), 'Pakujemy');
assert.equal(clientStatus('sent'), 'Wysłana');
assert.equal(clientStatus('sent', 'Doręczona'), 'Doręczona');
assert.equal(clientStatus('cancelled'), 'Anulowane');
assert.equal(clientStatus('Przyjęte'), 'Przyjęte');
assert.equal(clientStatus('Pakujemy'), 'Pakujemy');
assert.equal(clientStatus('Wysłana'), 'Wysłana');
assert.equal(clientStatus('Doręczona'), 'Doręczona');
assert.equal(clientStatus('W realizacji', 'Przesyłka doręczona'), 'Doręczona');
assert.equal(clientStatus('W realizacji', 'Przekazano do doręczenia'), 'Przyjęte');
assert.equal(clientStatus('cokolwiek'), 'Przyjęte');
assert.equal(clientStatus('przyjete'), 'Przyjęte');
assert.equal(clientStatus('pakujemy'), 'Pakujemy');
assert.equal(clientStatus('nieoplacone'), 'Czeka na płatność');
assert.equal(clientStatus('nieopłacone'), 'Czeka na płatność');
assert.equal(orderSourceLabel('live'), 'Zamówienie z live');
assert.equal(orderSourceLabel('shop'), 'Zamówienie ze sklepu');

assert.equal(claimMessage('ok'), 'Numer dopisany. Oto Twoje zamówienia.');
assert.equal(claimMessage('nomatch'), 'Nie znaleźliśmy zamówienia z tym telefonem i numerem.');
assert.equal(claimMessage('limit'), 'Za dużo prób. Spróbuj za godzinę.');
assert.equal(claimMessage('input'), 'Podaj telefon (9 cyfr) i numer zamówienia.');
assert.equal(claimMessage('login'), 'Zaloguj się jeszcze raz.');
assert.equal(claimMessage({ shop_claim_orders: 'nomatch' }), 'Nie znaleźliśmy zamówienia z tym telefonem i numerem.');
assert.match(claimMessage('other'), /Spróbuj jeszcze raz/);

assert.equal(emailOk('a@b.c'), true);
assert.equal(emailOk('nie-mail'), false);

const orders = mergeAccountOrders(
  [{
    id: 'shop-1',
    order_no: 'KS1001',
    created_at: '2026-11-01T10:00:00.000Z',
    status: 'packed',
    products_total: 49,
    delivery_fee: 25,
  }],
  [{ order_id: 'shop-1', title: 'Sukienka testowa', size: 'M', color: 'czarny', qty: 1 }],
  [{
    order_no: '9001',
    created_at: '2026-11-03T10:00:00.000Z',
    status: 'Wysłana',
    products_total: 80,
    items: [{ name: 'Paczka testowa', price: 80, qty: 2 }],
    dpd_waybill: '00000000000001',
    dpd_state: 'Doręczona',
  }],
);
assert.deepEqual(orders.map((order) => order.order_no), ['9001', 'KS1001']);
assert.equal(orders[0].source, 'live');
assert.equal(orders[1].source, 'shop');
assert.equal(orders[0].status, 'Doręczona');
assert.equal(orders[0].lines[0], 'Paczka testowa × 2');
assert.equal(orders[0].track, 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=00000000000001');
assert.equal(orders[1].status, 'Pakujemy');
assert.equal(orders[1].amount, 74);
assert.equal(orders[1].lines[0], 'Sukienka testowa · M · czarny × 1');
const unpaid = mergeAccountOrders([], [], [{
  order_no: '9002',
  created_at: '2026-11-04T09:00:00.000Z',
  status: 'nieoplacone',
  products_total: 49,
  items: [{ name: 'Test', qty: 1 }],
}]);
assert.equal(unpaid[0].status, 'Czeka na płatność');
assert.equal(unpaid[0].source, 'live');
assert.equal(trackUrl('zły numer'), '');
assert.equal(trackUrl(''), '');

const active = { code: PROMO_CODE, title: 'Paczka Niespodzianka 5 szt.', price: 49, active: true, photos: ['paczka.jpg'] };
const hidden = { ...active, active: false };
assert.equal(shouldShowPromo('catalog', [active], false), true);
assert.equal(shouldShowPromo('account', [active], false), true);
assert.equal(shouldShowPromo('catalog', [active], true), false);
assert.equal(shouldShowPromo('basket', [active], false), false);
assert.equal(shouldShowPromo('catalog', [hidden], false), false);
assert.equal(promoProduct([hidden]), null);

assert.equal(parseRoute('#/konto').name, 'account');
assert.equal(parseRoute('#/').name, 'catalog');

const shop = readFileSync(new URL('./shop.js', import.meta.url), 'utf8');
assert.match(shop, /emailRedirectTo: location\.origin \+ location\.pathname/);
assert.match(shop, /signInWithOtp/);
assert.match(shop, /Moje konto/);
assert.match(shop, /Śledź paczkę/);
assert.match(shop, /orderSourceLabel/);
assert.doesNotMatch(shop, /shop_place_order[\s\S]{0,80}price/);

assert.equal(BLIK_COPY, '796 669 157');
assert.equal(TRANSFER_COPY, 'PL24 2910 0006 0000 0000 0571 2568');
assert.equal(SLOGANS.length, 7);

console.log('account-check ok');
