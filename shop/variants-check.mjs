import assert from 'node:assert/strict';
import { lineKey, mapOrderError, upsertLine } from './common.js';
import {
  COLOR_GONE, COLOR_SOLD, cleanVariants, colorBasket, colorViews, colorsShareStock, freshBadge, isSoldOut,
  lineStock, orderCatalog, roomForColor, stockForColor, variantError,
} from './variants.js';

const id = '11111111-1111-4111-8111-111111111111';
const product = { id, colors: 'czarny,beż,granat', stock: 3 };
const variants = cleanVariants([
  { product_id: id, color: 'czarny', stock: 1, ncode: 'N-SEKRET' },
  { product_id: id, color: 'beż', stock: 0, ncode: 'N-2' },
  { product_id: id, color: 'granat', stock: 1, ncode: 'N-3' },
]);
assert.equal(JSON.stringify(variants).includes('N-SEKRET'), false);
assert.equal(JSON.stringify(variants).includes('ncode'), false);

const views = colorViews(product, variants);
assert.deepEqual(views.map((view) => view.stock), [1, 0, 1]);
assert.equal(isSoldOut(product, variants), false);
assert.equal(freshBadge(product, variants), 'ostatnie sztuki');
assert.equal(stockForColor(product, variants, 'beż'), 0);
assert.equal(stockForColor(product, variants, 'czarny'), 1);

const gone = { id: '22222222-2222-4222-8222-222222222222', colors: 'ecru', stock: 1 };
const goneRows = cleanVariants([{ product_id: gone.id, color: 'ecru', stock: 0 }]);
assert.equal(isSoldOut(gone, goneRows), true);
assert.equal(freshBadge(gone, goneRows), 'WYPRZEDANE');

const many = { id, colors: 'a,b,c', stock: 3 };
const manyRows = cleanVariants([
  { product_id: id, color: 'a', stock: 1 },
  { product_id: id, color: 'b', stock: 1 },
  { product_id: id, color: 'c', stock: 1 },
]);
assert.equal(freshBadge(many, manyRows), '');

const ordered = orderCatalog([gone, product], [...variants, ...goneRows]);
assert.equal(ordered[0].id, id);
assert.equal(ordered[1].id, gone.id);

assert.equal(variantError('color:N-1'), COLOR_GONE);
assert.equal(variantError('out_of_stock:N-1'), COLOR_SOLD);
assert.equal(mapOrderError('color:N-9'), COLOR_GONE);
assert.equal(mapOrderError('out_of_stock:K-001'), COLOR_SOLD);
assert.equal(mapOrderError('color:N-9').includes('N-9'), false);
assert.equal(mapOrderError('out_of_stock:K-001').includes('K-001'), false);

const waiting = colorViews(product, []);
assert.ok(waiting.every((view) => view.stock == null));
assert.equal(isSoldOut(product, []), false);
assert.equal(freshBadge(product, []), '');

const black = { product_id: id, code: 'K-1', title: 'Sukienka', price: 69, size: 'uniwersalny', color: 'czarny', qty: 1 };
const ecru = { ...black, color: 'ecru' };
const first = upsertLine([], black, lineStock(1, colorBasket([], id, 'czarny').other));
assert.equal(first.added, 1);
const held = colorBasket(first.lines, id, 'ecru');
assert.equal(roomForColor(1, colorBasket(first.lines, id, 'czarny').same), 0);
assert.equal(roomForColor(1, held.same), 1);
const second = upsertLine(first.lines, ecru, lineStock(1, held.other));
assert.equal(second.added, 1);
assert.equal(second.lines.map((line) => line.color).join(','), 'czarny,ecru');
const again = upsertLine(second.lines, ecru, lineStock(1, colorBasket(second.lines, id, 'ecru').other));
assert.equal(again.added, 0);
assert.equal(lineKey(second.lines[1]).endsWith('|ecru'), true);

const shared = { id: '33333333-3333-4333-8333-333333333333', colors: 'czarny, ecru', stock: 1 };
assert.equal(colorsShareStock(shared, []), true);
assert.equal(colorsShareStock(shared, [{ product_id: shared.id, color: 'czarny', stock: 1 }]), false);
assert.equal(stockForColor(shared, [], 'ecru'), 1);
const sharedBlack = { product_id: shared.id, code: 'K-2', title: 'Sukienka', price: 69, size: 'uniwersalny', color: 'czarny', qty: 1 };
const sharedFirst = upsertLine([], sharedBlack, lineStock(1, 0));
assert.equal(sharedFirst.added, 1);
const sharedRoom = roomForColor(stockForColor(shared, [], 'ecru'), colorBasket(sharedFirst.lines, shared.id, 'ecru').same + colorBasket(sharedFirst.lines, shared.id, 'ecru').other);
assert.equal(sharedRoom, 0);
const sharedSecond = upsertLine(sharedFirst.lines, { ...sharedBlack, color: 'ecru' }, lineStock(1, 0));
assert.equal(sharedSecond.added, 0);
assert.equal(sharedSecond.lines.length, 1);

console.log('variants-check ok');
