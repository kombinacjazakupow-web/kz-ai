import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const admin = readFileSync(new URL('./admin.js', import.meta.url), 'utf8');
assert.match(admin, /input\('reel_url', 'Rolka Facebook'/);
assert.match(admin, /input\('live_clip_url', 'Fragment z live'/);
assert.match(admin, /reel_url: form\.reel_url\?\.value \|\| ''/);
assert.match(admin, /live_clip_url: form\.live_clip_url\?\.value \|\| ''/);
assert.match(admin, /reel_url: facebookReel\(value\.reel_url\) \|\| null/);
assert.match(admin, /live_clip_url: facebookClip\(value\.live_clip_url\) \|\| null/);
assert.match(admin, /errors\.reel_url/);
assert.match(admin, /errors\.live_clip_url/);

console.log('admin-fields-check ok');
