# Z-Index — Research, Diagnosis & Remediation Plan

> Status: **Phases 0–4 implemented** (2026-06-07 → 08). The `--z-layer-*` token
> scale is live in `globals.css`, every shadcn/overlay primitive and app-shell
> chrome surface references it, Sonner is pulled into scale, the
> `Z_DIALOG_ABOVE_SHEET` hack is deleted, and an ESLint guardrail forbids raw
> z-index escalation literals. §2 "Diagnosis" describes the pre-refactor state
> that motivated the change.

This note answers a focused question: **how do mature design systems manage
z-index, and where does Zeta's current approach diverge?** It then gives a
concrete, phased plan to fix the parts that misbehave (the class of bug behind
"the date pickers in *Nueva deuda personal* don't open").

---

## 1. What the industry does (research)

Every serious design system converged on the same handful of rules. Sources at
the bottom.

### 1.1 Z-index comes from a named token, never a literal
The single most repeated rule: **no raw `z-index: 9999`/`10001` in component
code.** Each value is a semantic token (`--z-modal`, `--z-popover`, …). Benefits
the sources call out: one place to reason about order, no "guess a bigger
number" arms race, and self-documenting layers. USWDS ships z-index *as design
tokens* for exactly this reason. (CSS-Tricks, USWDS, OutSystems.)

### 1.2 A single, **spaced, ascending** scale for the overlay layers
The overlay tiers ascend in a fixed order and are **spaced** (steps of 100/1000)
so new layers can be inserted without renumbering. The order is remarkably
consistent across systems — note where popover/tooltip land **relative to
modal**:

| Layer | **MUI** | **Bootstrap 5.3** | **Chakra** |
|---|---|---|---|
| dropdown / menu | — | 1000 | 1000 |
| sticky | — | 1020 | 1100 |
| fixed / banner | — | 1030 | 1200 |
| app bar | 1100 | — | — |
| drawer / offcanvas | 1200 | 1045 | — |
| **modal (backdrop+content)** | **1300** | **1050–1055** | **1300–1400** |
| **popover** | — | **1070** | **1500** |
| snackbar / toast | 1400 | 1090 | 1700 |
| **tooltip** | **1500** | **1080** | **1800** |

**The key, load-bearing observation:** in *every* one of these systems,
**popover and tooltip sit ABOVE modal/drawer**, not below. A popover or
date-picker calendar is a *child* surface spawned from inside a dialog/sheet, so
it must outrank it. Systems bake that into the scale once, globally — so "a
calendar opened inside a sheet" just works, with zero per-call-site effort.

### 1.3 Keep values low; lean on stacking context + DOM order
Chakra's explicit guidance: prefer portals + local stacking contexts and **do
not exceed z-index of 1–2 inside a component**. The global scale handles
cross-component order; everything else is local. Radix (which shadcn wraps)
portals every overlay to `document.body` and relies on **DOM insertion order at
equal z-index** — the surface opened *later* is later in the DOM and therefore
paints on top *without* needing a higher number. shadcn ships every overlay at
`z-50` for precisely this reason.

### 1.4 Stacking contexts are the real trap, not the numbers
A child's `z-index` is meaningless outside its parent's stacking context. You
**cannot** fix "my menu renders behind X" by bumping the menu if the *parent*
is the one painting behind X. (CSS-Tricks, Medium "Z-Index Problem".) Portaling
to `body` is the escape hatch — which is why all these systems portal overlays.

---

## 2. Diagnosis — Zeta today

Current layers (from `globals.css`, `styles.ts`, and component source):

| Value | Owners |
|---|---|
| `z-10` | in-flow: gradient masks, avatar badge, sticky sub-headers, treemap labels |
| `z-30` | page topbars / mobile headers |
| `z-40` | mobile tab bar, bottom nav, wizard/bottom action bars, FAB backdrop |
| `z-50` | **all shadcn primitives**: Dialog, AlertDialog, Drawer, Popover, Select, Dropdown, Tooltip; plus bulk-action-bar, focus-mode accent |
| `z-[9998]` / `z-[9999]` | dev tools (inspect overlay, dev FAB, annotate canvas) |
| `z-[10000]` | **Sheet** (overlay+content), **FabMenu**, dev review dialog, inspect tooltip |
| `z-[10001]` | `Z_DIALOG_ABOVE_SHEET` — a primitive opened *inside* a Sheet |
| `~10^9` | Sonner toasts (library default) |

### Problems

1. **No tokens.** Order lives in raw literals (`z-[10000]`, `z-[10001]`,
   `z-[9998]`) plus prose in `CLAUDE.md`/`styles.ts`. This is the exact
   anti-pattern every source warns against. The discipline is real but enforced
   by comments and reviewer memory, not by the type system.

2. **The scale is inverted vs. the industry consensus — this is the root bug.**
   Zeta puts `Sheet = 10000` but leaves `Popover/Select/Tooltip = 50`. So a
   popover spawned *inside* a Sheet renders **9,950 levels below it** and is
   invisible/unclickable. That is literally the *Nueva deuda personal* date
   picker bug. Every other system avoids this by putting popovers **above**
   modals globally.

3. **A per-call-site hack papers over (2).** `Z_DIALOG_ABOVE_SHEET = z-[10001]`
   must be remembered and threaded into *every* Dialog/Popover opened from a
   Sheet (destinatario picker; and, until this branch, the date pickers were
   simply broken because nobody threaded it). The repo's own `BACKLOG.md`
   already flags this as a trap. Forgetting it is silent breakage.

4. **The `10000` band is overloaded and unspaced.** Sheet, FabMenu, dev review
   dialog and the inspect tooltip all sit at exactly `10000`; dev tools crowd
   `9998–10000`. No room to express "above the sheet" except `+1`, which is how
   we got `10001`. Meanwhile there's a 9,950-wide empty gap below it.

5. **Two disconnected universes.** shadcn's native `z-50` model (flat tier +
   DOM order) was half-abandoned by promoting Sheet/FabMenu to `10000`, but the
   *other* primitives were left at `50`. We get neither shadcn's "DOM order just
   works" nor a clean ascending scale — we get the failure modes of both.

---

## 3. Target model (recommendation)

Adopt a **token-based, spaced, ascending overlay scale** that matches the
industry order — crucially **popover/tooltip above modal/sheet**. This deletes
the `Z_DIALOG_ABOVE_SHEET` hack structurally: a calendar opened inside a sheet
outranks it because *every* popover outranks *every* modal, by design.

```css
/* globals.css :root — referenced via z-[var(--z-layer-*)] */
--z-layer-raised:    10; /* in-flow: badges, gradient masks, sticky sub-headers */
--z-layer-sticky:    30; /* page topbars / sticky section headers */
--z-layer-nav:       40; /* mobile tab bar, bottom nav, fixed bottom action bars */
--z-layer-modal:   1000; /* Dialog, AlertDialog, Sheet, Drawer, FabMenu — overlay + content */
--z-layer-popover: 1100; /* Popover, Dropdown, Select, ContextMenu, date-picker */
--z-layer-toast:   1200; /* Sonner toasts */
--z-layer-tooltip: 1300; /* Tooltip */
--z-layer-dev:     9000; /* dev-only inspector/overlays */
```

Why this specific shape:

- **`nav` (40) < `modal` (1000)** → a Sheet/Dialog covers the tab bar, same as
  today.
- **`popover` (1100) > `modal` (1000)** → the load-bearing fix. Calendars,
  selects, dropdowns opened inside a sheet/dialog appear above it **with no
  per-call-site bump**. `Z_DIALOG_ABOVE_SHEET` is deleted.
- **`toast` (1200) > modal** → toasts stay visible over a sheet (matches the
  current intent; Sonner drops from ~10⁹ to a sane, in-scale value).
- **`tooltip` (1300)** on top of interactive overlays, per all three systems.
- **Modal-over-modal** (e.g. a Dialog opened from a Sheet, or FabMenu over a
  sheet) is handled by **Radix DOM insertion order** at the shared `--z-modal`
  tier — the later-opened surface is later in the DOM and paints on top,
  including its own backdrop. This is exactly how shadcn's all-`z-50` default
  behaves; we're just relocating that tier and giving popovers/tooltips their
  own slots above it.
- **`dev` (9000)** keeps debug overlays above everything without colliding with
  product surfaces (today the inspect tooltip ties Sheet at `10000`).

Exposed as Tailwind utilities (`z-modal`, `z-popover`, …) via `@theme`, plus TS
constants in `styles.ts` for the few places that compose class strings
dynamically. No component should ever write a raw `z-[number]` again — the lint
rule below enforces it.

---

## 4. Migration plan (phased, low-risk)

**Phase 0 — define the scale (no behavior change yet). ✅ Done.**
- Add the tokens above to `globals.css` `@theme` and expose `z-*` utilities.
- Add TS mirrors to `styles.ts` (`Z_NAV`, `Z_MODAL`, `Z_POPOVER`, `Z_TOAST`,
  `Z_TOOLTIP`, `Z_DEV`). Update the doc-comment block.

**Phase 1 — primitives (the high-value swap). ✅ Done.** Replace raw values in:
`ui/sheet.tsx`, `ui/dialog.tsx`, `ui/alert-dialog.tsx`, `ui/drawer.tsx`,
`ui/popover.tsx`, `ui/select.tsx`, `ui/dropdown-menu.tsx`, `ui/tooltip.tsx`,
`mobile/fab-menu.tsx`, and the Sonner `<Toaster>` config.
- Sheet/Dialog/AlertDialog/Drawer/FabMenu → `--z-modal`.
- Popover/Select/Dropdown/ContextMenu/date-picker → `--z-popover`.
- Tooltip → `--z-tooltip`; Sonner → `--z-toast`.

**Phase 2 — delete the hack. ✅ Done.** Remove `Z_DIALOG_ABOVE_SHEET` and its usages
(`destinatario-zone-picker.tsx`, `date-picker.tsx` `contentClassName`,
`create-personal-debt-sheet.tsx`). The `variant="dialog"` workaround in the
destinatario picker can stay (it's also a pointer-events/focus fix), but no
longer needs the z-bump.

**Phase 3 — app-level fixed surfaces. ✅ Done.** Tokenized the chrome/overlay
surfaces: sticky topbars (`z-30 → z-[var(--z-layer-sticky)]`), the mobile tab
bar / bottom nav / fixed bottom action bars (`z-40`/`z-50 → --z-layer-nav`), and
the dev inspector/overlays (`9998–10001 → --z-layer-dev`, using
`calc(var(--z-layer-dev)+N)` where dev tools stack internally). Purely in-flow
micro-stacking was intentionally left as standard Tailwind utilities — `z-10`
for sticky section headers / gradient masks / avatar badges, `z-[1]`/`z-[2]` for
treemap label layering — since those are local (well below every overlay) and
don't belong in the global scale.

**Phase 4 — guardrail. ✅ Done.** Added a `no-restricted-syntax` ESLint rule
(`webapp/eslint.config.mjs`) that flags any `z-[<2+ digits>]` Tailwind literal —
catching every escalation (`z-[50]`, `z-[9999]`, `z-[10000]`) while allowing
standard utilities (`z-10`/`z-40`), single-digit local stacking (`z-[1]`), and
token/calc references (`z-[var(--z-layer-*)]`, `z-[calc(var(--z-layer-dev)+2)]`).
The `zetas-front-guy` review gate carries the same rule for PR review.
> Note: the repo's `pnpm lint` currently reports ~59 pre-existing, unrelated
> errors, so lint is not yet a clean CI gate — the rule fires correctly (zero
> z-index violations after this refactor) and is enforced at review time via the
> agent until the broader lint baseline is cleaned up.

**Verification per phase:** `pnpm build`, then manually exercise the known
nesting hotspots — date picker + destinatario picker inside *Nueva deuda
personal*, FabMenu over a sheet, a Dialog opened from a Sheet, toast over a
sheet, tooltip inside a dialog. Spawn `zetas-front-guy` as the review gate.

**Risk:** low–medium. The only behavioral subtlety is modal-over-modal relying
on Radix DOM order; this already works for shadcn defaults and is covered by the
hotspot checks above. Roll out per-phase so any regression is isolated.

---

## Sources
- [The Value of z-index — CSS-Tricks](https://css-tricks.com/the-value-of-z-index/)
- [Z-index design tokens — U.S. Web Design System (USWDS)](https://designsystem.digital.gov/design-tokens/z-index/)
- [z-index — Material UI](https://mui.com/material-ui/customization/z-index/)
- [Z-index — Bootstrap 5.3](https://getbootstrap.com/docs/5.3/utilities/z-index/)
- [Z-Index — Chakra UI](https://chakra-ui.com/docs/theming/z-index) · [Portals and z-index — Chakra UI](https://v2.chakra-ui.com/community/recipes/z-index)
- [OutSystems UI Layer System: Managing z-index at scale — Bernardo Cardoso](https://medium.com/@bernardocardoso/outsystems-ui-layer-system-managing-z-index-at-scale-68dca9e543de)
- [The Z-Index Problem: Why Stacking Contexts Are a CSS … — Medium](https://medium.com/@ss-tech/the-z-index-problem-91226fb74955)
- [Elevation Design Patterns: Tokens, Shadows, and Roles — designsystems.surf](https://designsystems.surf/articles/depth-with-purpose-how-elevation-adds-realism-and-hierarchy)
