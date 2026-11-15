import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { facebookPlayer, facebookReel, photosAfterPoster } from './common.js';

const reel = 'https://www.facebook.com/reel/1234567890';
assert.equal(facebookReel(reel), reel);
assert.equal(facebookReel(' https://www.facebook.com/reel/42 '), 'https://www.facebook.com/reel/42');
assert.equal(facebookReel('https://www.facebook.com/reel/42?ref=1'), '');
assert.equal(facebookReel('https://facebook.com/reel/42'), '');
assert.equal(facebookReel('http://www.facebook.com/reel/42'), '');
assert.equal(facebookReel('https://www.facebook.com/reel/abc'), '');
assert.equal(facebookReel('javascript:alert(1)'), '');

const player = facebookPlayer(reel, true);
const parsed = new URL(player);
assert.equal(parsed.origin + parsed.pathname, 'https://www.facebook.com/plugins/video.php');
assert.equal(parsed.searchParams.get('href'), reel);
assert.equal(parsed.searchParams.get('show_text'), 'false');
assert.equal(parsed.searchParams.get('autoplay'), 'true');
assert.equal(new URL(facebookPlayer(reel, false)).searchParams.get('autoplay'), null);
assert.equal(facebookPlayer('https://evil.example/reel/1', true), '');

const shop = readFileSync(new URL('./shop.js', import.meta.url), 'utf8');
assert.match(shop, /facebookReel\(product\.reel_url\)/);
assert.match(shop, /data-act="reel-play"/);
assert.match(shop, /hanger \|\| reel \? '' : videoSrc\(product\.video_url\)/);
assert.deepEqual(photosAfterPoster(['a.jpg', 'b.jpg'], true), ['b.jpg']);
assert.deepEqual(photosAfterPoster(['a.jpg'], true), []);
assert.deepEqual(photosAfterPoster(['a.jpg', 'b.jpg'], false), ['a.jpg', 'b.jpg']);
assert.deepEqual(photosAfterPoster([], true), []);
assert.match(shop, /photosAfterPoster\(photos, posterTaken\)/);
assert.match(shop, /slidePlan\(Boolean\(reel \|\| film\), galleryPhotos\.length\)/);
assert.doesNotMatch(shop, /plugins\/video\.php/);

console.log('reel-check ok');
