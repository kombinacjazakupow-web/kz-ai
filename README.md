# KOMBI Pakowanie

Mobile packing PWA for the shop floor. Plain HTML, CSS, and one ES module. No build step. It runs on GitHub Pages as-is.

The screen is in Polish. Packers sign in with Google, open a bag, tick lines, and report mistakes. The app does not charge anyone, message customers, or delete bags or items.

## Run locally

ES modules and the service worker need HTTP. Do not open `index.html` as a file.

```bash
python3 -m http.server 8080
```

Open http://localhost:8080 on a phone or in a narrow browser window.

## GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. **Build and deployment**: Deploy from a branch.
4. Branch: `main` (or the branch you ship), folder: **`/ (root)`**. Save.
5. Wait until the site is live. The address is `https://<user>.github.io/kz-ai/` for this repo name.
6. In Supabase → **Authentication → URL configuration**, set:
   - Site URL: `https://<user>.github.io/kz-ai/`
   - Redirect URLs: `https://<user>.github.io/kz-ai/` and `https://<user>.github.io/kz-ai/index.html`
7. Google sign-in must already be enabled on that Supabase project. Supabase’s own callback URL is what Google sees; the app only redirects back to the Pages URL above.

`.nojekyll` is in the repo so Pages serves the files without Jekyll.

Add to Home Screen on iPhone (Safari → Share → Add to Home Screen) or install the app from Chrome on Android. The installed app uses the same URL.

## Sign-in

After Google login the app reads that person’s row in `pak_users` (the id is the auth user id).

- `waiting` — “Czekasz na zatwierdzenie przez Sergio”
- `removed` — “Brak dostępu”
- `approved` — the packing screens
- `owner` — the same screens plus **Właściciel** (waiting people and pending reports)

Approving a report only marks it approved or rejected. It does not edit the bag. The same decisions can arrive from Telegram.

## Photos

**Zdjęcia** sits between **Wieszak** and **Właściciel**. Proof photos hang off a bag (`Zdjęcie worka`) or off one NEW/OLD line. Product photos hang off a live day and a hanger number together — the same number on another day is a different product. A line's thumbnail is the newest product photo for that day and number.

The phone camera (`accept=image/*`, `capture=environment`) resizes the picture in the browser first: long side 1280 px, JPEG quality 0.8, EXIF orientation kept. The file goes to the private Storage bucket `pak-photos`. The app inserts `pak_photos` only after that upload succeeds, with `user_id` set to the signed-in user. Paths are `proof/<bag_no>/<id>.jpg` and `product/<live day, dots replaced with dashes>/<hanger_no>/<id>.jpg`.

Signed image URLs last one hour and stay in memory until they expire. `pak_photos` uses the same realtime channel as the other tables. Photos do not change bags, lines, or ticks, and they are allowed when a bag is locked or already done. There is no offline queue: if the upload fails, the toast says the picture was not saved. Deleting removes the storage object first, then the row. Only the person who took the photo sees **Usuń zdjęcie**, and the confirmation stays on the page.

## Offline

The service worker caches the app shell and loads it from the network first, so a new deploy shows up when the phone is online. Supabase calls are network-first and are not stored in the cache.

If a tick cannot be saved because the network failed, it stays in `localStorage` under the same id and is sent again when the browser fires `online`, when the app is opened, and every 20 seconds. The yellow bar says `offline – zapisane w telefonie`.
