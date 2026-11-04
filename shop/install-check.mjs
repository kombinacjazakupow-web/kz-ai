import assert from 'node:assert/strict';
import { INSTALL_HIDE_KEY, installKind } from './install.js';

assert.equal(INSTALL_HIDE_KEY, 'kombi-shop-install-hide');
assert.equal(installKind({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', standalone: false, promptReady: false }), 'ios');
assert.equal(installKind({ ua: 'Mozilla/5.0 (Linux; Android 14)', standalone: false, promptReady: true }), 'android');
assert.equal(installKind({ ua: 'Mozilla/5.0 (Linux; Android 14)', standalone: false, promptReady: false }), 'android-steps');
assert.equal(installKind({ ua: 'Mozilla/5.0 (iPhone)', standalone: true, promptReady: false }), 'installed');
assert.equal(installKind({ ua: 'Mozilla/5.0 (Macintosh)', standalone: false, promptReady: false }), 'other');
console.log('install-check ok');
