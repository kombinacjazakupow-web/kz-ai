import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACEBOOK_LOGIN } from './common.js';
import { OTHER_BROWSER_NOTE } from './account.js';

assert.equal(FACEBOOK_LOGIN, false);
assert.match(OTHER_BROWSER_NOTE, /innej przeglądarce/);

const shop = readFileSync(new URL('./shop.js', import.meta.url), 'utf8');
assert.match(shop, /FACEBOOK_LOGIN \? '<p><button type="button" class="btn block" data-act="facebook">Zaloguj przez Facebooka<\/button><\/p>' : ''/);
assert.match(shop, /if \(!FACEBOOK_LOGIN\) return;/);
assert.match(shop, /signInWithOAuth\(\{\s*provider: 'facebook',\s*options: \{ redirectTo: location\.origin \+ location\.pathname \},?\s*\}\)/);
assert.match(shop, /OTHER_BROWSER_NOTE/);

console.log('facebook-check ok');
