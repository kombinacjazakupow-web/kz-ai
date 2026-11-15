import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { momentReady, momentSliderValue, momentText } from './variants.js';

assert.equal(momentText(12.4), '0:12,4');
assert.equal(momentText(1.2), '0:01,2');
assert.equal(momentText(0), '0:00,0');
assert.equal(momentText(null), '');
assert.equal(momentText(-1), '');
assert.equal(momentReady(0), false);
assert.equal(momentReady(undefined), false);
assert.equal(momentReady(12.4), true);
assert.equal(momentSliderValue(12.5, 0), null);
assert.equal(momentSliderValue(12.5, Number.NaN), null);
assert.equal(momentSliderValue('', 30), null);
assert.equal(momentSliderValue(null, 30), null);
assert.equal(momentSliderValue(12.5, 30), 12.5);
assert.equal(momentSliderValue(40, 30), 30);

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
assert.match(admin, /id="save-moment"[^>]*disabled/);
assert.match(admin, /id="moment-range"[^>]*disabled/);
assert.match(admin, /momentSliderValue\(/);
assert.match(admin, /!momentReady\(video\?\.duration\)/);

console.log('moments-check ok');
