# Account aliases + mini icons — design

**Date:** 2026-04-17
**Scope:** Let users rename each `accounts` row with a short alias and render a small bank/type icon next to the alias across every surface that shows an account today. Dense surfaces drop the `****4398` mask; pickers keep it.
**Predecessor:** Plan page polish (PR #170, merged 2026-04-17). Mobile polish milestone rolls on.
**Source:** HANDOVER backlog entry — "Account aliases + mini icons — HIGH (unblocks density gains). `Bancolombia Ahorros ****4398` → `<alias> · ****<mask>` + 16×16 icon."

## Context & motivation

Every row in Zeta that references an account repeats `Bancolombia Ahorros ****4398`, `Bancolombia VISA ****7022`, `Nu Tarjeta ****7437`. These auto-generated strings are 20–30 chars long and compete with the merchant name, amount, date, and state chip for horizontal space on 390px screens. Dashboard "Reciente" truncates merchant names that shouldn't truncate. Plan occurrences lose destination clarity because account and amount share the same row.

Schema inspection reveals two pre-existing affordances that have never been wired:

1. `accounts.name` is already encrypted and user-editable. Auto-import flows populate it today; nothing stops a user from replacing it with "Caja" via the `/accounts/[id]` edit form. The UI just doesn't present this as "alias" — it presents it as "edit the name and lose the bank context," which is why no one does it.
2. `accounts.icon` is a plaintext column in the schema but no component reads from it. The column was defined and forgotten.

This spec wires alias (via `name`) and icon (via `provider`) into a single `<AccountRowIdentity>` component, used across Dashboard Reciente, Plan occurrences/templates, Deudas list/planner, source-account pickers, and the import wizard. Zero migrations. Zero new columns. One new asset directory for bank SVGs.

User framing from the brainstorm: **dense rows should read like `<icon> Caja · $85.000`, not `Bancolombia Ahorros ****4398 · $85.000`**. Aliases are the identity; mask is the disambiguator when context demands it.

## Decisions locked

### D1 — Alias storage: reuse `accounts.name`

- **No migration.** `accounts.name` is already encrypted through the `accounts_enc` view and the existing account-edit flows already write to it.
- The alias IS the `name`. There is no second column, no override hierarchy, no fallback chain on read.
- Fallback for empty/null `name` (shouldn't happen, but defend): composed default `${account_type_label} · ****${mask}` computed client-side. E.g. `"Cuenta débito · ****4398"`. This keeps rows readable even if `name` somehow ends up blank.
- The existing `/accounts/[id]` edit dialog stays the single place where users rename. Helper caption added to guide alias intent (see D7).

### D2 — Icons: auto from `provider`, fallback to `account_type`

- A new `<AccountIcon account size="sm" | "md" />` component maps `accounts.provider` → bundled SVG. Providers with bundled logos: `BANCOLOMBIA`, `NU`, `DAVIVIENDA`, `FALABELLA`, `BANCO_DE_BOGOTA`, `LULO`, `CONFIAR`, `POPULAR`, `NEQUI`.
- `MANUAL` provider (and any future provider without a logo) falls back to a `lucide-react` glyph keyed on `account_type`:
  - `CHECKING` → `Wallet`
  - `SAVINGS` → `PiggyBank`
  - `CREDIT_CARD` → `CreditCard`
  - `LOAN` → `Landmark`
  - `CASH` → `Banknote`
  - `INVESTMENT` → `TrendingUp`
- Size prop:
  - `sm` → 16×16 (row density surfaces: Reciente, Plan occurrences, Deudas list)
  - `md` → 24×24 (picker rows, account list, import wizard)
- Icon background tinted with `account.color` at 10% opacity when color is set; otherwise a muted neutral. `accounts.color` is already populated by import flows.
- **Out of scope this phase:** a user picker to override the auto-picked icon. The `accounts.icon` column remains unused; we do not read from it. A follow-up phase can wire `icon` as an override if real user demand emerges.

### D3 — Mask suffix: surface-dependent

New `<AccountRowIdentity>` component takes a `density` prop with three values:

| Density | Renders | Used on |
|---|---|---|
| `compact` | `<icon> <name>` | Dashboard Reciente rows · Plan Recurrentes occurrence rows · Deudas account list rows (condensed) · mobile-periodo-view entry rows (if they show account) |
| `picker` | `<icon> <name> · ****<mask>` | Source-account pickers in LinkPickerSheet, RecurringFormDialog, EntryFormDialog, PayExpenseDialog, AssignmentDialog · import wizard account matching · `/accounts` list on desktop |
| `detail` | `<icon> <name>` on line 1, `<institution_name> · ****<mask>` as eyebrow on line 2 | `/accounts/[id]` detail hero · debt-planner deep view |

Rules when `mask` is null (e.g. CASH accounts): render `picker` as `<icon> <name>` (mask gracefully disappears), no bullet separator, no trailing `****`.

### D4 — Onboarding: silent

- **No forced rename prompt.** Existing users continue to see whatever `name` currently holds. The `/accounts/[id]` edit flow is still the place to change it.
- Auto-import flows keep populating `name` as they do today. We do NOT change the auto-generated name format in this spec — avoiding interaction with PDF parser assumptions. Users who want shorter names open the detail page and edit.
- **Helper caption** in the edit dialog (see D7) explains that the field becomes the display name everywhere. Inline, discoverable, not in-your-face.

### D5 — Icon fallback for MANUAL / unknown provider

Already covered in D2 (account_type lucide glyph). Explicitly: **never render a blank placeholder.** If `provider` is unknown AND `account_type` is unknown, fall back to a generic `Wallet` icon.

### D6 — Icon user-override: out of scope

No icon picker in this phase. Covered in the "Out of scope" section below.

### D7 — Settings UI: reuse existing edit form + helper caption

Wherever `/accounts/[id]` currently mounts the edit form (likely `account-edit-dialog.tsx` or equivalent — implementation will confirm), add a short helper caption under the `name` field:

```
Puedes renombrar tu cuenta con un alias corto — p. ej. "Caja",
"Ahorros mamá", "Tarjeta amarilla". Se usa en listas y movimientos.
```

No other UI changes in settings.

## Component-level changes

| Component | Change | Notes |
|---|---|---|
| `webapp/src/lib/icons/bank-logos/index.tsx` (NEW) | Registry mapping `data_provider` enum → SVG component. One file per bank + re-exports. | SVG components get standard `className` + `aria-hidden` props. |
| `webapp/src/lib/icons/bank-logos/bancolombia.tsx` (NEW) | Bancolombia brand mark (yellow `#FDDA24` on dark). | Single-color vector, 24×24 viewBox for crispness at 16/24. |
| `webapp/src/lib/icons/bank-logos/nu.tsx` (NEW) | Nu (Nubank) purple. | |
| `webapp/src/lib/icons/bank-logos/davivienda.tsx` (NEW) | Davivienda red. | |
| `webapp/src/lib/icons/bank-logos/falabella.tsx` (NEW) | Falabella green. | |
| `webapp/src/lib/icons/bank-logos/banco-de-bogota.tsx` (NEW) | Banco de Bogotá blue. | |
| `webapp/src/lib/icons/bank-logos/lulo.tsx` (NEW) | Lulo Bank. | |
| `webapp/src/lib/icons/bank-logos/confiar.tsx` (NEW) | Confiar. | |
| `webapp/src/lib/icons/bank-logos/popular.tsx` (NEW) | Banco Popular. | |
| `webapp/src/lib/icons/bank-logos/nequi.tsx` (NEW) | Nequi purple. | |
| `webapp/src/components/accounts/account-icon.tsx` (NEW) | `<AccountIcon account size />` — maps provider → bank SVG, falls back to `lucide` glyph by account_type. | ~30 LOC. |
| `webapp/src/components/accounts/account-row-identity.tsx` (NEW) | `<AccountRowIdentity account density />` — composes icon + alias + optional mask per density. | ~50 LOC. |
| `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx` (Reciente) | Replace inline `<p>{account.name}</p>` with `<AccountRowIdentity account={tx.account} density="compact" />`. | Also check that the tx row shape carries `account` with provider + mask + color. If not, extend `RecentTransaction` type. |
| `webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx` | Occurrence row shows `item.accountName`. Replace with `<AccountRowIdentity />` fed from the template's account. | Needs template.account plumbing into OccurrenceItem — check if already present. |
| `webapp/src/components/mobile/v2/plan/mobile-recurrentes-templates-strip.tsx` | Template row secondary line uses `t.account?.name ?? "—"`. Replace with `<AccountRowIdentity account={t.account} density="picker" />`. | |
| `webapp/src/components/mobile/v2/deudas/deudas-accounts-accordion.tsx` | Account list items. Replace. | `density="compact"` for row, `density="detail"` for expanded panel. |
| `webapp/src/components/recurring/occurrence-actions.tsx` / `link-picker-sheet.tsx` / `merge-picker-sheet.tsx` | Any source-account picker options. Replace with `<AccountRowIdentity density="picker" />`. | |
| `webapp/src/components/cashflow-planner/entry-form-dialog.tsx` · `assignment-dialog.tsx` · `pay-expense-dialog.tsx` | Account dropdown options. Replace. | `density="picker"`. |
| `webapp/src/components/import/import-wizard.tsx` (account-matching step) | Existing account options in the "map statement → account" UI. Replace. | `density="picker"`. |
| `webapp/src/app/(dashboard)/accounts/page.tsx` + `[id]/page.tsx` | `/accounts` list row — `density="picker"`. `/accounts/[id]` hero — `density="detail"`. | |
| `webapp/src/components/accounts/account-edit-dialog.tsx` (or whatever file owns the edit form — implementation will confirm) | Add helper caption under the name field explaining alias intent (D7). | No new props needed. |

## Data flow

No backend changes. All data already flows from existing cached actions:

- `getAccounts()` (cached, `"accounts"` tag) returns `id, name, mask, institution_name, provider, account_type, color, card_brand, …`. Every consumer already destructures what it needs.
- Dashboard hero, Plan page, Deudas dashboard, import wizard all call `getAccounts()` (or a narrower variant) during their initial server render. Account objects reach client components as props.
- `<AccountIcon />` and `<AccountRowIdentity />` are pure render components — no data fetching, no effects.

**Type fanout to verify during implementation:**

- `RecentTransaction` (in `webapp/src/actions/transactions.ts` around the `getRecentTransactionsCached` function) — confirm it projects enough of the account to render the icon (`provider`, `color`, `account_type`). If it only projects `account_id + account_name`, extend the select to include the required fields.
- `OccurrenceItem` (in `webapp/src/components/recurring/use-recurring-month.ts`) — confirm `account_name` and `account_type` are present; extend if needed to also expose `provider` + `color` + `mask`.
- `UpcomingRecurrence` (type domain) — template.account relation already includes what we need.

## Type contract: `<AccountIcon>` input

Minimal shape consumed by both icon + identity components:

```ts
type AccountDisplay = {
  provider: Database["public"]["Enums"]["data_provider"];
  account_type: Database["public"]["Enums"]["account_type"];
  color: string | null;
};
```

If a consumer already has a wider `Account` or joined row, it passes that. `AccountIcon` reads only these three fields.

Identity component needs additionally `name: string` and `mask: string | null`.

## Testing strategy

- **Visual regression** — Playwright 390×844 captures for:
  - `/dashboard` with Reciente populated (compact density)
  - `/plan?tab=recurrentes` with occurrences (compact) + templates strip expanded (picker)
  - `/deudas` account list (compact) + accordion expanded (detail)
  - `/accounts` list (picker) + `/accounts/[id]` detail hero
  - Edit dialog open with helper caption visible
- **Mask absence** — create a CASH account (no mask), confirm `picker` density renders `<icon> <name>` without trailing bullet/mask.
- **Unknown provider** — create a MANUAL account, confirm fallback lucide glyph by account_type.
- **Long alias overflow** — rename an account to a 40-char string, confirm Reciente row still truncates gracefully (ellipsis, no wrap).
- **Unit tests** — Vitest for the `<AccountIcon>` provider→SVG mapping + `<AccountRowIdentity>` density→layout resolver. Small pure module so these are cheap.
- **Token compliance** — `zetas-front-guy` sweep. The bank SVGs bring brand colors that are deliberately NOT in the design token palette (Bancolombia yellow, Nu purple). That's allowed — they're brand marks, not UI colors. Confirm no brand colors leak into UI surfaces outside the icon.
- **Cache/build** — `perf-auditor` sweep. No new queries expected.

## Review gate

Same layered pattern as PR #170:

1. `zetas-front-guy` + `perf-auditor` (parallel)
2. Push → Gemini bot review
3. `frontend-auditor` + `ux-analyst` (parallel)
4. `/simplify` skill

## Out of scope (deferred to BACKLOG.md)

1. **User icon picker** — let users override the auto-picked icon per account. Useful for MANUAL accounts with personality (e.g. a cash envelope nicknamed "Taxis"). YAGNI for this phase.
2. **Account sort order** — a drag-to-reorder UI on `/accounts`. Separate feature.
3. **Multi-color theming** — let users tint the icon background with a custom color. The `accounts.color` column already stores an auto-picked color from import; we respect it but don't expose picker UI.
4. **Mobile RN parity** — the React Native mobile app renders accounts via its own components. A follow-up PR using `mobile-sync-doctor` + `mobile-webapp-parity` agents mirrors `<AccountRowIdentity>` on the RN side. This spec ships the webapp only.
5. **Onboarding nudge for existing users** — a one-time prompt encouraging users to alias their accounts. If discoverability proves poor after shipping, consider.
6. **Aliases on sub-surfaces not yet enumerated** — e.g. reports, exports, email notifications. Implementation will sweep the codebase for `account.name` call sites and catch anything missed.

## Success criteria

- Every row surface listed in "Component-level changes" renders an icon + alias.
- Dashboard Reciente fits merchant name + alias + amount + date on a 390px row without truncating the merchant.
- Source-account picker dropdowns (LinkPickerSheet, etc.) show alias + mask for disambiguation.
- Users with MANUAL accounts see a sensible account-type glyph (not a blank box).
- `/accounts/[id]` edit dialog has the helper caption.
- `pnpm build` passes; `zetas-front-guy` reports zero token violations outside the bank-logo SVGs.
