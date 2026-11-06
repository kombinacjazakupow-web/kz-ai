import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { momentText } from './variants.js';

assert.equal(momentText(12.4), '0:12,4');
assert.equal(momentText(1.2), '0:01,2');
assert.equal(momentText(0), '0:00,0');
assert.equal(momentText(null), '');
assert.equal(momentText(-1), '');

const admin = readFileSync(new URL('./admin.js', import.meta.url), 'utf8');
assert.match(admin, /Momenty kolorów/);
assert.match(admin, /id="moment-video"/);
assert.match(admin, /id="moment-range"/);
assert.match(admin, /Zapisz moment/);
assert.match(admin, /Zdjęcie modelki/);
assert.match(admin, /video_seconds: at/);
assert.match(admin, /products\/\$\{safeCode\}\/\$\{uuid\(\)\}\.jpg/);
assert.match(admin, /ai_photo: path/);
assert.match(admin, /resizeToJpeg\(file\)/);
assert.match(admin, /hanger_video_url: hangerSrc\(value\.hanger_video_url\) \|\| null/);
assert.match(admin, /video\.currentTime = at/);

console.log('moments-check ok');
