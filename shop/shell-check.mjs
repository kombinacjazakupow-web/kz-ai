import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chooseOption, settleOption, MESSENGER_LINE, SLOGANS, BLIK_COPY, TRANSFER_COPY } from './common.js';

assert.equal(settleOption(['uniwersalny'], ''), 'uniwersalny');
assert.equal(settleOption(['S', 'M'], ''), '');
assert.equal(settleOption(['S', 'M'], 'M'), 'M');
assert.equal(settleOption(['S', 'M'], 'L'), '');

let size = settleOption(['S', 'M'], '');
let color = settleOption(['czarny', 'beż'], '');
color = chooseOption(color, 'beż', ['czarny', 'beż']);
size = chooseOption(size, 'M', ['S', 'M']);
assert.equal(size, 'M');
assert.equal(color, 'beż');
size = chooseOption(size, 'S', ['S', 'M']);
assert.equal(size, 'S');
assert.equal(color, 'beż');
assert.equal(chooseOption('uniwersalny', 'uniwersalny', ['uniwersalny']), 'uniwersalny');

assert.equal(MESSENGER_LINE, 'Dołącz potwierdzenie powyżej (najszybciej). Pytania: WhatsApp +48 792 402 881.');
assert.equal(SLOGANS.length, 7);
assert.equal(BLIK_COPY, '796 669 157');
assert.equal(TRANSFER_COPY, 'PL24 2910 0006 0000 0000 0571 2568');

const manifest = JSON.parse(readFileSync(new URL('./manifest.webmanifest', import.meta.url), 'utf8'));
assert.equal(manifest.name, 'KOMBI Sklep');
assert.equal(manifest.start_url, './');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.theme_color, '#533afd');
assert.equal(manifest.background_color, '#ffffff');
assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any'));
assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable' && icon.sizes === '512x512'));

const worker = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
assert.match(worker, /supabase\.co/);
assert.match(worker, /kombi-sklep-shell-/);
assert.match(worker, /startsWith\('kombi-sklep-shell-'\)/);
assert.doesNotMatch(worker, /kombi-shell-v/);

const terms = readFileSync(new URL('./regulamin.html', import.meta.url), 'utf8');
assert.match(terms, /KOMBINACJA ZAKUPÓW Sp\. z o\.o\./);
assert.match(terms, /ul\. Marii Świątkiewicz 51\/2, 05-552 Mroków/);
assert.match(terms, /KRS 0001229797/);
assert.match(terms, /NIP 1231600976/);
assert.match(terms, /\+48 792 402 881/);
assert.match(terms, /kombinacjazakupow@gmail\.com/);
assert.doesNotMatch(terms, /BLOCKED|DO UZUPEŁNIENIA/);
assert.match(readFileSync(new URL('./prywatnosc.html', import.meta.url), 'utf8'), /Polityka prywatności/);
assert.match(readFileSync(new URL('./zwroty.html', import.meta.url), 'utf8'), /14 dni/);
assert.match(readFileSync(new URL('./shop.js', import.meta.url), 'utf8'), /Zainstaluj aplikację/);

console.log('shell-check ok');
