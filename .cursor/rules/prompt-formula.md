# Golden prompt formula (this repo)

Vague prompts cause most AI bugs. For Composer or Agent, fill this template:

```markdown
## Goal
[One sentence. Exact feature. Example: "Show a Polish empty-catalog state on the shop home when no active products exist."]

## Context & Files
- Tech Stack: HTML/CSS/ES modules, GitHub Pages, Supabase JS + Postgres RPC (no Next/Tailwind/TS unless migrating)
- Reference Files: [e.g. shop/shop.js, shop/common.js, shop/shop.css]
- Third-Party: Supabase client only unless approved

## Desired Behavior
1. [User action]
2. [System check]
3. [Outcome / UI]

## Acceptance Criteria
- [ ] `node --check` passes on touched JS
- [ ] Mobile narrow viewport looks clean
- [ ] Network/RPC failure shows Polish error UI (toast or inline)
- [ ] [Feature-specific proof]

## Constraints (CRITICAL)
- Do NOT add a sales open/close clock gate (24h shop).
- Do NOT introduce Tailwind, TypeScript, React, Stripe, or new state libraries.
- Do NOT touch packing PWA files on shop-only tasks (and the reverse).
- Do NOT weaken RLS or commit secrets.
- Keep modules focused; avoid mega-files when splitting is natural.
```

For complex work: plan first (Plan Mode / explicit “plan only”), review the plan, then approve implementation.
