# Zeta — Design System Handoff (Mobile-First)

Everything needed to hand Zeta's visual language to an external design tool (e.g. `claude.ai/design`) in one place. **Zeta is a mobile-first product** — the webapp exists but mobile is the primary surface. Design, prioritization, and this handoff are ordered accordingly.

## Recommended feed order (mobile-first)

1. **`BRAND_BRIEF.md`** — one-page identity, palette, voice, mobile-first rules. Start here.
2. **`mobile-screens/`** — **18 real mobile screenshots** of every core screen (390px device width). These are the ground-truth composition references. See the "Mobile screen map" below for what each file shows.
3. **`reference/mobile-showcase.html`** — mobile-frame showcase HTML combining screens into a narrative (good for tools that can render HTML).
4. **`tokens/colors.css`** — raw CSS variables for the Obsidian & Brass palette.
5. **`tokens/TOKENS.md`** — canonical component rules (cards, buttons, progress bars, metric displays). This is the law — components must use these classes.
6. **`reference/onboarding-walkthrough.html`** — onboarding flow reference (designer-useful for first-run experience).
7. **`storybook-static/`** — built Storybook of the real component library (41+ stories). Open `index.html` locally, or zip and upload. Shows exact markup + classes; atoms/molecules are shared between web and mobile.
8. **`reference/zeta-dev-handoff.html`** — standalone developer handoff showing brand in motion (typography, hero, swatches). Originally desktop-oriented — useful as brand anchor, not layout reference.
9. **`assets-brand/`** — brand stills (`app_hero`, `app_design_style`, `app_brand_guidelines`, `icon`). Tone/mood anchors, lower priority than mobile screens.
10. **`reference/FRONTEND_STANDARDS.md`** — deeper engineering rules, useful if the tool generates code.

## Mobile screen map (`mobile-screens/`)

| File | Screen | Notes |
|------|--------|-------|
| `01-dashboard.png` | Dashboard (home) | Widgets: health, cashflow, upcoming, budgets. Answers "Am I on track?" |
| `02-transactions.png` | Transactions list | Grouped by date; category chips; direction-tinted amounts |
| `03-transaction-detail.png` | Transaction detail | Sheet with metadata, category, destinatario, reconciliation |
| `04-categorizar.png` | Categorize flow | Rapid triage of uncategorized items |
| `05-destinatarios.png` | Destinatarios | Merchant profiles (personified — people/brands, not strings) |
| `06-import.png` | Import wizard | PDF/email import, step sequence |
| `07-accounts.png` | Accounts list | Multi-bank, multi-currency, debt badges |
| `08-account-detail.png` | Account detail | Balance, history, statement snapshots |
| `09-deudas.png` | Deudas (debts) | Payoff overview |
| `10-deuda-planificador.png` | Debt planner | Snowball/avalanche scenarios |
| `11-recurrentes.png` | Recurring payments | Upcoming occurrences, lifecycle |
| `12-presupuesto.png` | Budget | 50/30/20 treemap + per-category |
| `13-gestionar.png` | Manage | Admin shortcuts surface |
| `14-settings.png` | Settings | Profile, preferences |
| `15-settings-analytics.png` | Settings → Analytics | Opt-in toggle screen |
| `16-login.png` | Login | Auth entry |
| `17-signup.png` | Sign up | Auth entry |
| `18-forgot-password.png` | Forgot password | Auth recovery |

## If the tool has a size limit

Priority upload: `BRAND_BRIEF.md` + `tokens/TOKENS.md` + `tokens/colors.css` + `mobile-screens/01-dashboard.png`, `02-transactions.png`, `12-presupuesto.png`, `10-deuda-planificador.png`, `05-destinatarios.png`. That's ~3-4 MB and captures identity + the flagship mobile flows. Add more mobile screens, then storybook, before adding desktop assets.

## What's intentionally NOT included

- **Desktop screenshots.** Webapp exists but is not the design target for this milestone.
- Hand-drawn mobile sketches from `docs/mobile_improvement_sketches/` — 49 MB of raw phone photos, too heavy and exploratory. Keep in the repo for reference.
- Raw Tailwind config — tokens doc covers it more accessibly.
- Full mobile app source — the tool should design screens, not reimplement the app. Storybook shows the shared component vocabulary.

## Regenerating

- Mobile screenshots: regenerate via `ui-showcases/` scripts, then `cp -R ui-showcases/screenshots/mobile/. zetas_design_system_handoff/mobile-screens/`.
- Storybook: `cd webapp && pnpm build-storybook --output-dir ../zetas_design_system_handoff/storybook-static`.
- Tokens: re-copy `docs/design-system/TOKENS.md` — that's the canonical source.
- Brand brief: edit `BRAND_BRIEF.md` directly.
