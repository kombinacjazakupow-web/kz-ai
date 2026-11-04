# KOMBI Sklep

Public, mobile-first shop for Kombinacja Zakupów. Plain HTML, CSS, and ES modules. No build step. It is meant to be served by GitHub Pages at `/kz-ai/shop/`.

The screen is in Polish. Visitors browse active products, keep a basket in `localStorage`, and place an order only through the `shop_place_order` database function. The amount to pay is the one that function returns. The basket total is a preview, plus the line `Dostawa DPD 25 zł`.

The packing app (`index.html`, `app.js`, `styles.css`, `sw.js`) is a separate tool. This folder does not change it. The packing service worker, once installed, uses the site root as its scope, so it can also see `/shop/` requests. It tries the network first. This shop does not register its own worker.

## Run locally

ES modules need HTTP. Do not open the file directly.

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/shop/ on a phone or in a narrow window. The owner panel is http://localhost:8080/shop/admin.html.

## GitHub Pages

The site address for this repository is `https://<user>.github.io/kz-ai/shop/` (for example `https://kombinacjazakupow-web.github.io/kz-ai/shop/`).

Pages must deploy the repository root, same as the packing app. `.nojekyll` is already at the root.

In Supabase → Authentication → URL configuration, add the owner panel to Redirect URLs, otherwise Google sign-in cannot return:

- `https://<user>.github.io/kz-ai/shop/admin.html`
- `http://localhost:8080/shop/admin.html` when you test on this machine

Google sign-in is the same Supabase provider as the packing app. The shop sends people back to the current page (`location.origin + location.pathname`).

## Data

Same Supabase project as the packing app. The browser only has the publishable key.

- `shop_products` — public read of active rows. Photos are paths in the public `shop-photos` bucket.
- Orders are not readable or insertable by anonymous users. Checkout calls `shop_place_order`.
- The owner panel calls `pak_is_owner`. Anyone else sees „Brak dostępu”.
- Product photos are resized in the browser (long side 1600 px, JPEG 0.85) and uploaded to `products/<code>/<uuid>.jpg`.
- Products are deactivated, not deleted. Order buttons update `status` only: `new` → `paid` → `packed` → `sent`, or `cancelled`.

A new order on the owner panel is highlighted. There is no sound.

## Files

- `index.html`, `shop.js`, `shop.css` — catalog `#/`, product `#/p/<code>`, basket `#/koszyk`, checkout and thank-you `#/zamowienie`
- `admin.html`, `admin.js` — products and orders
- `common.js` — shared escaping, money formatting, validation
- `regulamin.html` — placeholder terms; seller details are still to be added
- `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`
