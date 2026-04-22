# design.md — Zeta

Index of design truth. This file doesn't define the design system — it tells you
where each part of it lives. When two docs disagree, the linked source wins.

---

## TL;DR

- **Voice**: Obsidian & Brass. Editorial, dark-first, Spanish, mobile-first.
- **Promise**: every screen answers *"Am I on track?"* without explanation.
- **Primary surface**: mobile (390×844). Webapp mirrors; desktop scales up.
- **Ship target for any redesign**: Variant A of the matching flow in `claude-ai-design/Zeta Wireframes.html`.

---

## Sources of truth

| Topic | File | Owns |
|---|---|---|
| Brand, voice, palette intent | [`zetas_design_system_handoff/BRAND_BRIEF.md`](zetas_design_system_handoff/BRAND_BRIEF.md) | "Why it looks this way" |
| Tokens (canonical) | [`docs/design-system/TOKENS.md`](docs/design-system/TOKENS.md) | Eyebrow, cards, progress, buttons, metrics |
| Raw color tokens | [`zetas_design_system_handoff/tokens/colors.css`](zetas_design_system_handoff/tokens/colors.css) | CSS variables |
| Frontend standards | [`docs/FRONTEND_STANDARDS.md`](docs/FRONTEND_STANDARDS.md) | Architecture, a11y, responsive, forms |
| Wireframes (ship target) | [`claude-ai-design/Zeta Wireframes.html`](claude-ai-design/Zeta Wireframes.html) | Flows 01–07, Variant A default |
| Live component reference | [`zetas_design_system_handoff/storybook-static/`](zetas_design_system_handoff/storybook-static/) | 41 stories — check before inventing |
| Current-state screens (NOT target) | [`zetas_design_system_handoff/mobile-screens/`](zetas_design_system_handoff/mobile-screens/) | Snapshot of what exists today |
| Repo-level UI rules | [`CLAUDE.md`](CLAUDE.md) → "UI Rules" | Mobile clearance, safe-area, debt-direction |

---

## Non-negotiables (fast reference)

Detail lives in the linked sources; these are the ones most frequently broken.

1. **No hardcoded colors.** Tokens only. New color → add to `TOKENS.md` first.
   Never pure `#000` or `#fff` — kills the warm palette.
2. **Three button variants only**: `BRASS_BUTTON_CLASS`, `GHOST_BUTTON_CLASS`,
   `BRASS_GHOST_BUTTON_CLASS` from `webapp/src/lib/constants/styles.ts`.
3. **Borders are `border-white/6`**. Not `/4`, not `/8`, never flat gray.
4. **Cards have three tiers** (surface, compact, stat) — see `TOKENS.md §3`.
   Radii are `rounded-xl` or `rounded-2xl` only. No arbitrary `rounded-[18px]`.
5. **Financial numbers are `tabular-nums`**. Always.
6. **Eyebrow label token** is `text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark`. Don't improvise.
7. **Mobile safe area**: every top-level screen honors `useSafeAreaInsets()` or
   mounts `MobileHeader`. Bottom sheets pad with `MOBILE_TAB_BAR_CLEARANCE_CLASS`.
8. **Icons are `lucide-react`, monochrome**. No emoji as UI affordance.
9. **Spanish-first copy.** Direct, human, short. Numbers carry the narrative.
10. **Sheets, not modals.** `vaul` bottom sheets for secondary flows.

---

## Workflow for design work

1. **Find the flow** in `claude-ai-design/Zeta Wireframes.html`
   (Flows 01 Onboarding, 02 Home, 03 Add, 04 Import, 05 Plan, 06 Settings, 07 Afford).
2. **Implement Variant A** unless the task names another. Variant A = Safe = ship.
3. **Reuse first** — check `webapp/src/components/ui/` (41 stories) and
   `zetas_design_system_handoff/storybook-static/` before creating anything.
4. **Token check** — verify each class against `TOKENS.md`. No hex in components.
5. **Review gates** (CLAUDE.md → Agents):
   - `zetas-front-guy` after any TSX/CSS change
   - `frontend-auditor` for comprehensive review
   - `mobile-perf-doctor` for lists / animated surfaces
   - `ux-analyst` for cross-flow cohesion

---

## What lives where (directory map)

```
design.md                               ← this file (index)
CLAUDE.md                               ← repo-level rules incl. UI Rules
claude-ai-design/                       ← WIREFRAMES (redesign target)
docs/
  FRONTEND_STANDARDS.md                 ← architecture, patterns, a11y
  design-system/
    TOKENS.md                           ← canonical token catalog
  design-system-audit-2026-04-03.md     ← latest audit snapshot
  ui-component-recommendations.md
zetas_design_system_handoff/
  BRAND_BRIEF.md                        ← voice, positioning, palette intent
  README.md
  reference/FRONTEND_STANDARDS.md       ← (mirror of docs/ version)
  tokens/{TOKENS.md,colors.css}
  mobile-screens/                       ← current-state, NOT target
  storybook-static/                     ← live components
  assets-brand/
brand/                                  ← logo + brand guideline images
design/                                 ← source files (.pen)
mockups/                                ← visual drafts
ui-showcases/                           ← rendered showcase pages
```

---

## When this file goes stale

If the linked docs move, update the table above — don't inline their content
here. This file stays thin on purpose so it doesn't drift. Anything longer
than ~120 lines means content that belongs in a linked source.
