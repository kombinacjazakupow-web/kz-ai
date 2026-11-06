import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hangerSrc } from './common.js';
import { cleanVariants, modelPhoto } from './variants.js';

const film = 'https://r2.selmo.io/hanger/test.mp4';
assert.equal(hangerSrc(film), film);
assert.equal(hangerSrc(' https://r2.selmo.io/a.mp4 '), 'https://r2.selmo.io/a.mp4');
assert.equal(hangerSrc('http://r2.selmo.io/a.mp4'), '');
assert.equal(hangerSrc('https://evil.example/a.mp4'), '');
assert.equal(hangerSrc('https://files.r2.selmo.io/a.mp4'), '');
assert.equal(hangerSrc('javascript:alert(1)'), '');

const id = '11111111-1111-4111-8111-111111111111';
const product = { id };
const rows = cleanVariants([
  { product_id: id, color: 'czarny', stock: 1, video_seconds: '12.5', ai_photo: 'products/K/czarny.jpg', ncode: 'N-SEKRET' },
  { product_id: id, color: 'ecru', stock: 1, video_seconds: -1, ai_photo: 'https://evil.example/a.jpg' },
]);
assert.equal(rows[0].video_seconds, 12.5);
assert.equal(rows[0].ai_photo, 'products/K/czarny.jpg');
assert.equal(JSON.stringify(rows).includes('N-SEKRET'), false);
assert.equal(rows[1].video_seconds, null);
assert.equal(rows[1].ai_photo, '');
assert.deepEqual(modelPhoto(product, '', rows), { photo: 'products/K/czarny.jpg', hold: 'products/K/czarny.jpg' });
assert.deepEqual(modelPhoto(product, 'czarny', rows, ''), { photo: 'products/K/czarny.jpg', hold: 'products/K/czarny.jpg' });
assert.deepEqual(modelPhoto({ id: 'other' }, '', rows), { photo: '', hold: '' });

const shop = readFileSync(new URL('./shop.js', import.meta.url), 'utf8');
assert.match(shop, /Modelka AI/);
assert.match(shop, /Film z wieszaka/);
assert.match(shop, /preload="metadata"/);
assert.match(shop, /playsinline loop/);
assert.match(shop, /data-act="hanger-sound"/);
assert.match(shop, /hanger \? '' : facebookReel\(product\.reel_url\)/);
assert.match(shop, /facebookReel\(product\.reel_url\)/);
assert.doesNotMatch(shop, /pogl[aą]dowe/i);
const hero = shop.slice(shop.indexOf('function heroHtml'), shop.indexOf('function railHtml'));
const grid = shop.slice(shop.indexOf('function gridHtml'), shop.indexOf('function productMain'));
const reels = shop.slice(shop.indexOf('function reelsMain'), shop.indexOf('function choice'));
assert.equal(hero.includes('hanger_video_url'), false);
assert.equal(grid.includes('hanger_video_url'), false);
assert.equal(reels.includes('hanger_video_url'), false);
assert.equal(readFileSync(new URL('./rolki.js', import.meta.url), 'utf8').includes('hanger'), false);

console.log('hanger-check ok');
