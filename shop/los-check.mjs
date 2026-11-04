import assert from 'node:assert/strict';
import { LOS_HOME_KEY, openHomeSurprise } from './los.js';
import { SLOGANS, pickSlogan } from './common.js';

assert.equal(LOS_HOME_KEY, 'kombi-shop-los');
assert.deepEqual(openHomeSurprise(null, false), { show: true, mark: true, hold: true });
assert.deepEqual(openHomeSurprise('1', false), { show: false, mark: true, hold: false });
assert.deepEqual(openHomeSurprise('1', true), { show: true, mark: true, hold: true });
assert.equal(SLOGANS.length, 7);
const drawn = new Set();
for (let i = 0; i < SLOGANS.length; i += 1) {
  drawn.add(pickSlogan(() => i / SLOGANS.length));
}
assert.equal(drawn.size, 7);
for (const line of drawn) assert.ok(SLOGANS.includes(line));
console.log('los-check ok');
