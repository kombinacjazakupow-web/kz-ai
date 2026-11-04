import assert from 'node:assert/strict';
import { reelItems } from './rolki.js';
import { parseRoute } from './common.js';

const rows = [
  { active: true, video_url: 'https://example.com/a.mp4', code: 'A' },
  { active: true, video_url: '', code: 'B' },
  { active: false, video_url: 'https://example.com/c.mp4', code: 'C' },
  { active: true, video_url: 'javascript:alert(1)', code: 'D' },
];
const films = reelItems(rows);
assert.deepEqual(films.map((item) => item.code), ['A']);
assert.equal(parseRoute('#/rolki').name, 'reels');
console.log('rolki-check ok');
