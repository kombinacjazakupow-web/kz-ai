import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hangerSrc, playbackHeld, sameHangerFilm } from './common.js';
import { cleanVariants, colorMoment, modelPhoto } from './variants.js';

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
assert.equal(cleanVariants([{ product_id: id, color: 'pusty', stock: 1, video_seconds: null }])[0].video_seconds, null);
assert.equal(cleanVariants([{ product_id: id, color: 'zero', stock: 1, video_seconds: 0 }])[0].video_seconds, 0);
assert.equal(rows[1].ai_photo, '');
assert.deepEqual(modelPhoto(product, '', rows), { photo: 'products/K/czarny.jpg', hold: 'products/K/czarny.jpg' });
assert.deepEqual(modelPhoto(product, 'czarny', rows, ''), { photo: 'products/K/czarny.jpg', hold: 'products/K/czarny.jpg' });
assert.deepEqual(modelPhoto({ id: 'other' }, '', rows), { photo: '', hold: '' });
assert.deepEqual(modelPhoto(product, 'ecru', rows, 'products/K/czarny.jpg'), { photo: 'products/K/czarny.jpg', hold: 'products/K/czarny.jpg' });
assert.equal(colorMoment(product, 'czarny', rows), 12.5);
assert.equal(colorMoment(product, 'ecru', rows), null);
assert.equal(colorMoment(product, '', rows), null);
assert.equal(sameHangerFilm({ src: film, code: 'K1' }, { src: film, code: 'K1' }), true);
assert.equal(sameHangerFilm({ src: film, code: 'K1' }, { src: film, code: 'K2' }), false);
assert.equal(sameHangerFilm({ src: '', code: 'K1' }, { src: '', code: 'K1' }), false);
assert.equal(playbackHeld(12.5, 12.5), true);
assert.equal(playbackHeld(12.54, 12.5), true);
assert.equal(playbackHeld(0, 12.5), false);

const shop = readFileSync(new URL('./shop.js', import.meta.url), 'utf8');
assert.match(shop, /video\.addEventListener\('loadedmetadata'/);
assert.match(shop, /addEventListener\('seeked'/);
assert.match(shop, /fresh\.replaceWith\(box\.node\)/);
assert.match(shop, /hangerPark\.appendChild\(video\)/);
assert.match(shop, /getElementById\('app'\)\?\.querySelector\('\.hanger-video'\)/);
assert.match(shop, /sameHangerFilm\(box, next\)/);
assert.match(shop, /state\.hangerSeek = seconds == null \? null : seconds/);
assert.match(shop, /colorMoment\(product, chosen, state\.variants\)/);
assert.match(shop, /Modelka AI/);
assert.match(shop, /Film z wieszaka/);
assert.match(shop, /preload="metadata"/);
assert.match(shop, /playsinline loop/);
assert.match(shop, /data-act="hanger-sound"/);
assert.match(shop, /hanger \? '' : facebookReel\(product\.reel_url\)/);
assert.match(shop, /facebookReel\(product\.reel_url\)/);
assert.doesNotMatch(shop, /pogl[aą]dowe/i);
const hero = shop.slice(shop.indexOf('function heroHtml'), shop.indexOf('function railHtml'));
const rail = shop.slice(shop.indexOf('function railHtml'), shop.indexOf('function dotHtml'));
const grid = shop.slice(shop.indexOf('function gridHtml'), shop.indexOf('function productMain'));
const reels = shop.slice(shop.indexOf('function reelsMain'), shop.indexOf('function choice'));
assert.equal(hero.includes('hanger_video_url'), false);
assert.equal(rail.includes('hanger_video_url'), false);
assert.equal(grid.includes('hanger_video_url'), false);
assert.equal(reels.includes('hanger_video_url'), false);
assert.equal(readFileSync(new URL('./sw.js', import.meta.url), 'utf8').includes("hostname === 'r2.selmo.io'"), true);
assert.equal(readFileSync(new URL('./rolki.js', import.meta.url), 'utf8').includes('hanger'), false);

console.log('hanger-check ok');
