import assert from 'node:assert/strict';
import { mapOrderError } from './common.js';
import {
  COLOR_GONE, COLOR_SOLD, cleanVariants, colorViews, freshBadge, isSoldOut,
  orderCatalog, stockForColor, variantError,
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

console.log('variants-check ok');
