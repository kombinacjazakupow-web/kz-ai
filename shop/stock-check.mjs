import assert from 'node:assert/strict';
import {
  upsertLine, setLineQty, stockProblem, clampBasket, lineKey, refusedLine,
  BLIK_LINE, BLIK_COPY, TRANSFER_LINE, TRANSFER_COPY, thanksLines,
} from './common.js';

const id = '11111111-1111-4111-8111-111111111111';
const base = { product_id: id, code: 'K-001', title: 'Kurtka', price: 10, photo: '' };

let step = upsertLine([], { ...base, size: 'S', color: '', qty: 2 }, 3);
assert.equal(step.added, 2);
step = upsertLine(step.lines, { ...base, size: 'M', color: '', qty: 2 }, 3);
assert.equal(step.added, 1, 'second size must not take a full extra stock');
assert.equal(step.lines.reduce((sum, line) => sum + line.qty, 0), 3);

const sized = setLineQty(step.lines, lineKey({ product_id: id, size: 'S', color: '' }), 3, 3);
assert.equal(sized.find((line) => line.size === 'S').qty, 2);

const over = stockProblem([
  { product_id: id, qty: 2 },
  { product_id: id, qty: 2 },
], [{ id, active: true, stock: 3 }]);
assert.match(over, /ilość/);
assert.equal(stockProblem([
  { product_id: id, qty: 1 },
  { product_id: id, qty: 2 },
], [{ id, active: true, stock: 3 }]), '');

const clamped = clampBasket([
  { product_id: id, qty: 3, size: 'S', color: '' },
  { product_id: id, qty: 3, size: 'M', color: '' },
], [{ id, active: true, stock: 4, price: 10 }]);
assert.equal(clamped.reduce((sum, line) => sum + line.qty, 0), 4);

const goneColour = stockProblem(
  [{ product_id: id, code: 'K-001', title: 'Kurtka', color: 'ecru', size: 'M', qty: 1 }],
  [{ id, active: true, stock: 4, title: 'Kurtka' }],
  [{ product_id: id, color: 'ecru', stock: 0 }],
);
assert.match(goneColour, /Kurtka · ecru · M/);
assert.match(goneColour, /kolor/);
const named = refusedLine('out_of_stock:K-001', [{ code: 'K-001', title: 'Kurtka', color: 'ecru', size: 'M' }]);
assert.match(named, /Kurtka · ecru · M/);
assert.equal(named.includes('K-001'), false);
assert.equal(refusedLine('out_of_stock:K-001', []), '');

assert.equal(BLIK_COPY, '796 669 157');
assert.equal(TRANSFER_COPY, 'PL24 2910 0006 0000 0000 0571 2568');
assert.match(BLIK_LINE, /796 669 157/);
assert.match(BLIK_LINE, /Fikrie Ali/);
assert.match(TRANSFER_LINE, /PL24 2910 0006 0000 0000 0571 2568/);
assert.match(TRANSFER_LINE, /Sergen Kushdan/);
const thanks = thanksLines({ to_pay_now: 10, order_no: 'KS1', payment: 'blik', cod_amount: 0 });
assert.ok(thanks.some((line) => line.includes('796 669 157') && line.includes('Fikrie Ali')));
assert.ok(thanks.some((line) => line.includes('PL24 2910 0006 0000 0000 0571 2568') && line.includes('Sergen Kushdan')));

console.log('stock-check ok');
