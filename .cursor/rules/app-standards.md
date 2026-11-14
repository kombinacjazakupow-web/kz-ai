# Engineering Standards — KOMBI (kz-ai)

These rules apply to every Composer / Agent change in this repository.

## Stack (do not invent another)

- Plain HTML, CSS, and ES modules. Served by GitHub Pages. **No build step.**
- Shop: `shop/` (public storefront + owner panel).
- Packing: root `index.html`, `app.js`, `styles.css`, `sw.js` (separate PWA).
- Backend: Supabase project `kz-panel` — browser uses the **publishable** key only; orders go through `shop_place_order`.
- **Do not** introduce Next.js, React, Prisma, Tailwind, TypeScript, Stripe, or new state-management libraries unless the task explicitly migrates the stack.

## Zero-bug policy

- Never leave placeholder logic (`// TODO: implement later`, stub handlers, fake seller data in live checkout).
- Every path the user can click must work end-to-end or be clearly disabled with Polish UI copy.
- Prefer fixing the real failure over adding a bypass.

## Errors and network

- Every Supabase / RPC call must handle failure: check `error` (and thrown exceptions), show a user-friendly **Polish** toast or inline message, and keep the UI usable.
- Reuse `mapOrderError` / existing toast patterns in `shop/common.js` and packing UI — do not invent a second error system.
- Never fail silently.

## UI and polish

- Style with the existing CSS (`shop/shop.css`, root `styles.css`). Match current spacing, type, and color language.
- Mobile-first; layouts must look clean on a narrow phone viewport.
- Premium and commercial — not a prototype demo — without rewriting the design system.

## Sales hours

- The shop is **24-hour**. Do **not** add open/close clock gates (no 06:00 open, no 22:00 close) in frontend or `shop_place_order`.
- Sellability is controlled by `shop_products.active` and stock only.
- Empty catalog copy must say the offer is unavailable — not that the shop opens at a clock time.

## Shop vs packing

- Do not change packing files when the task is shop-only, and vice versa, unless the task says both.
- Do not break the packing service worker scope / cache contract without an intentional cache bump.

## Data and safety

- Do not put secrets in the repo, chat dumps, or migrations.
- Do not weaken RLS or grant anon write on orders/products.
- Prefer deactivating products over deleting them.
- Order status transitions stay: `new` → `paid` → `packed` → `sent` (or `cancelled`).

## Verification before done

- Run `node --check` on every touched `.js` file.
- For shop stock/qty logic, run existing checks (e.g. `node shop/stock-check.mjs`) when present.
- If you add behavior, add or extend a small node test / verification script and run it until it passes.
- Prove mobile layout with a narrow viewport check when UI changed.

## Prompting habit (for humans + agents)

Use Goal / Context & Files / Desired Behavior / Acceptance Criteria / Constraints on every non-trivial task. Plan first on multi-file work; do not code until the plan matches the stack above.
