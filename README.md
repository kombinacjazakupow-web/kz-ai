# KOMBI Pakowanie

Mobile packing PWA for the shop floor. Plain HTML, CSS, and one ES module. No build step. It runs on GitHub Pages as-is.

The screen is in Polish. Packers sign in with Google, open a bag, tick lines, and report mistakes. The app does not charge anyone, message customers, or delete bags or items.

## Run locally

ES modules and the service worker need HTTP. Do not open `index.html` as a file.

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/pakowanie/ on a phone or in a narrow browser window. The site root opens the shop.

## GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. **Build and deployment**: Deploy from a branch.
4. Branch: `main` (or the branch you ship), folder: **`/ (root)`**. Save.
5. Wait until the site is live. Packing is at `https://<user>.github.io/kz-ai/pakowanie/`. The repository root opens the shop.
6. In Supabase → **Authentication → URL configuration**, the app sends people back to `location.origin + location.pathname`. Allow the packing page on each host you use, for example `https://<user>.github.io/kz-ai/pakowanie/` and `https://<user>.github.io/kz-ai/pakowanie/index.html`. Do not add a `CNAME` file or a GitHub Pages custom domain until DNS for the new domain is live.
7. Google sign-in must already be enabled on that Supabase project. Supabase’s own callback URL is what Google sees; the app only redirects back to the current packing page.

`.nojekyll` is in the repo so Pages serves the files without Jekyll.

Add to Home Screen on iPhone (Safari → Share → Add to Home Screen) or install the app from Chrome on Android. The installed app uses the same URL.

## Sign-in

After Google login the app reads that person’s row in `pak_users` (the id is the auth user id).

- `waiting` — “Czekasz na zatwierdzenie przez Sergio”
- `removed` — “Brak dostępu”
- `approved` — the packing screens
- `owner` — the same screens plus **Właściciel** (waiting people and pending reports)

Approving a report only marks it approved or rejected. It does not edit the bag. The same decisions can arrive from Telegram.

## Offline

The service worker caches the app shell and loads it from the network first, so a new deploy shows up when the phone is online. Supabase calls are network-first and are not stored in the cache.

If a tick cannot be saved because the network failed, it stays in `localStorage` under the same id and is sent again when the browser fires `online`, when the app is opened, and every 20 seconds. The yellow bar says `offline – zapisane w telefonie`.
