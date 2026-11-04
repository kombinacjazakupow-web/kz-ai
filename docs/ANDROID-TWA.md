# Android app for Google Play

The public shop is a website. Google Play can list it as an Android app by wrapping that website in a Trusted Web Activity. The wrapper is a thin Android package. The shop people see is still `https://kombinacjazakupow.pl/shop/`.

This file is the setup. It does not build the Android package and it does not contain a signing key.

The shop stays open all day. There is no 06:00 gate.

## What is already on the website

`shop/manifest.webmanifest` is the install card Android reads:

- name and short name: KOMBI Sklep
- `start_url` and `scope`: `./`, which means the `/shop/` folder of whatever host serves this site
- `display`: `standalone` (no browser bar once the link is verified)
- theme colour `#533afd`, background `#ffffff`
- icons: `icon-192.png`, `icon-512.png`, plus maskable `icon-maskable-192.png` and `icon-maskable-512.png`

`shop/sw.js` keeps a copy of the shop screens and scripts so the frame can open. It does not keep Supabase answers. Live prices, colour stock and orders always come from the network. The packing app at `/pakowanie/` has its own worker and its own cache name. The shop worker deletes only caches whose names start with `kombi-sklep-shell-`.

## Where the Android link file goes

The file is `.well-known/assetlinks.json` at the root of this repository.

When `kombinacjazakupow.pl` serves this repository at the host root, Android reads:

`https://kombinacjazakupow.pl/.well-known/assetlinks.json`

It must be that exact address: the host root, not `/shop/.well-known/`, and not the GitHub project path. A project site such as `https://kombinacjazakupow-web.github.io/kz-ai/` cannot prove this app, because Android looks at `https://kombinacjazakupow-web.github.io/.well-known/assetlinks.json`, which this repository does not control.

The file that is in the repo today is a placeholder. The website does not read it. Android will not treat the app as verified until the owner replaces `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` with the real SHA-256 of the Play app-signing certificate. The package name in that file is the suggestion `pl.kombinacjazakupow.sklep`. It can be changed before the first Play upload. After the first upload it is permanent.

The live file must return HTTP 200, `Content-Type: application/json`, with no redirect.

## Steps only the owner can do

- Buy and verify a Google Play developer account.
- Turn on DNS so `kombinacjazakupow.pl` serves this site. Do not add a CNAME file until that DNS is live.
- Create the upload key when Bubblewrap asks. Keep the keystore file and both passwords offline. Do not commit them and do not paste them into chat.
- In Play Console, leave Play App Signing on. Copy the SHA-256 of the **App signing key certificate** (Play Console → App integrity). That is the fingerprint Android checks on phones that installed the app from Play. The upload key is a different fingerprint. Add the upload key as well if a side-loaded test build should open without the address bar.
- Replace the placeholder fingerprint, deploy, and confirm the URL above in a browser.
- Upload the `.aab`, fill in the store listing, screenshots, content rating, privacy-policy URL (`https://kombinacjazakupow.pl/shop/prywatnosc.html`), and the Data safety form.

## Bubblewrap, in order

On the owner's computer, with Node.js installed. Do not install Bubblewrap with `sudo`.

```bash
npm i -g @bubblewrap/cli
mkdir kombi-sklep-android && cd kombi-sklep-android
bubblewrap init --manifest=https://kombinacjazakupow.pl/shop/manifest.webmanifest
```

Run `init` only after the custom domain is serving the shop. If it is pointed at the `github.io` address, the finished app will open that address.

When Bubblewrap asks, confirm:

- package name: `pl.kombinacjazakupow.sklep`
- name: `KOMBI Sklep`
- start URL: `https://kombinacjazakupow.pl/shop/`
- a new signing key, stored outside this repository

The first `build` offers to install the Android SDK and asks you to accept its licence.

```bash
bubblewrap build
```

That writes `app-release-signed.apk` (install on a phone to try) and `app-release-bundle.aab` (the file Play uploads).

After Play App Signing shows the app-signing SHA-256:

```bash
bubblewrap fingerprint add "AA:BB:CC:..."
bubblewrap fingerprint generateAssetLinks
```

Use the colon-separated SHA-256 from Play Console. Copy the generated `assetlinks.json` over the placeholder in this repository and deploy. To add the upload key too, run `bubblewrap fingerprint add` again with that second fingerprint, then generate the file again.

Check the wrapped site:

```bash
bubblewrap validate --url=https://kombinacjazakupow.pl/shop/
```

If verification fails, the app still opens, but Chrome shows the address bar. The usual cause is the placeholder fingerprint, the wrong key (upload key instead of the Play app-signing key), or the file not being on `https://kombinacjazakupow.pl/.well-known/assetlinks.json`.

Later shop updates do not need a new Play upload unless the Android package itself changes (icon, name, or start URL).

## Apple App Store

This setup is Android only. Apple has no Trusted Web Activity.

An iPhone can already keep the shop on the home screen: Udostępnij, then Do ekranu początkowego. That is not an App Store app.

A store app would need, and this repository does not include:

- an Apple Developer Program membership
- a Mac (or a Mac build service) with Xcode to archive and upload
- a native project, not this HTML folder
- screenshots for the iPhone sizes Apple asks for, an age rating, and the privacy questions
- a build that is more than a website inside a web view. Apple's review rule on minimum functionality rejects a thin wrapper of a site people can already open in Safari

Do not start that project from these files. The Android wrapper is the one the post promised.
