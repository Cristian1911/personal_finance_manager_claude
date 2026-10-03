# Handoff: v2 onboarding, phase 1 (2026-10-03)

This is the first file to read when resuming this work on branch `ccr-8048e38b-y9t8p0`.

## Context

- **Decisions:** S10-1…S10-13 in `docs/mlp/12-decision-log.md`. The new use cases N1–N10 are in `docs/mlp/11-use-cases.md`.
- **Design:** `docs/superpowers/specs/2026-10-03-v2-onboarding-design.md`.
- **Prototype:** the owner's private Claude Design canvas "Zeta onboarding propuestas". The target is the *Recomendada v2* artboard.
- **Build order (S10-13):** onboarding (this work) → Debo → Gasto → Presupuesto → Te deben + people connections → the rest.

## Done

### Engine (`packages/shared`, commit `bc6abfe`)
- **`engine/disponible/setup.ts`**
  - `setupProgress()` returns a precision percent, a level (Borrador / Aproximado / Real) and the "Afina tu número" tasks.
  - Weights: basics 20, statement 35, fixed payments 20, cards 15, automatic capture 10.
- **`engine/disponible/revisar.ts`**
  - `pagosFijosSugeridos()` adapts `detectRecurringCandidates` to the phone's movements.
  - `firstPagoDate()` holds the shared start-date rule.
- **Tests:** `engine/disponible/__tests__/setup.test.ts`. All 1097 shared tests pass.

### Mobile (commit "wip(v2): onboarding…")
- **`lib/v2/local-state.ts`:** phone-only UI memory in `local_state`. The keys are in `ONBOARDING_KEYS`.
- **`lib/v2/inicio/load.ts`:** now also returns `setup`, `guideSeen`, `tourSeen` and `pendingBills`.
- **`v2/components/Onboarding.tsx`:** the controller. It runs Tour → Goals → PathChoice → ExtractoPath | ManualPath.
- **`v2/components/onboarding/`:**
  - `Tour`: Laura's three screens.
  - `Goals` + `PathChoice`.
  - `ManualPath`: the basics plus optional blocks for accounts, fixed payments, cards and loans, with the live `ProgressBar`.
  - `ExtractoPath`: a per-bank guide, then `ExtractoSheet`, then "Esto encontré" with detected fixed payments (Sí/No), payday and balance.
  - `parts`: shared pieces.
- **`v2/components/SetupCard.tsx`:** the "Afina tu número" card and `PrecisionSheet`.
- **`v2/components/DisponibleBlock.tsx`:** an optional `precision` chip, and "≈" until the level is Real.
- **`app/(v2)/inicio.tsx`:**
  - The onboarding receives `userId` and `tourSeen`.
  - The first-time guide card, `SetupCard`, the precision sheet, and task routing (`SETUP_ROUTES`).
  - "No tengo" for cards and bills.
- **`app/(v2)/pagos.tsx`:** `?add=1&name=` prefills the name. Saving removes it from the pending bills.
- **`app/(v2)/revisar.tsx`:** "¿Pagas X cada mes?" cards. Sí runs `createPagoFijo`; No is remembered in `revisar.dismissed_pagos`.
- **Check:** `pnpm --dir mobile check:v2` passes (boundary and tsc).

## Update (local session, 2026-10-03)

- `origin/main` merged (decision-log conflict: S9 rows first, then S10).
- **Seen running** in `pnpm preview:web:shots` (demo, light, 390): tour → Lo digo yo → Hoy with "≈", precision chip, Afina tu número, first-time guide. Fixed: the basics' inputs collapsed (`Field flex={0}`); the preview went blank in demo mode (`lib/supabase.ts` `??` → `||` on empty env).
- **Reviews done** (`zeta-v2-reviewer`, `mobile-perf-doctor`), fixes applied: stable ids so a retry is a duplicate, not a second account/bill; empty balance no longer saved as $0; balance refills after another statement until edited; cancelling the upload is not an error (`ExtractoSheet onClose(imported)`); precision chip moved out of the block's Pressable (screen readers) and read in the block's label; 44pt targets; pending bill names can be dropped ("Ya no los pago"); card fields say dólares; "Le falta" uses nouns; `EMAIL_PDF_IMPORT` no longer counts as automatic capture; Revisar keeps only the latest load; `EXISTS` for the statement check; tabular numbers.
- **Still open:** extract path with a real PDF (needs `EXPO_PUBLIC_API_URL`), dark mode and 360/430 shots, bank step texts (owner), device test (owner). Optional polish: ProgressBar `scaleX` instead of width; cache "has statement" in `local_state`.

## Still to do before a PR (original list)

1. **See it running.** Nothing has been run in a browser or on a device yet. In `mobile/`, use `pnpm preview:web`, or for shots:
   `HEIGHT=1800 pnpm preview:web:shots "/inicio" "/inicio@Siguiente|Siguiente|Quiero esto con mis datos|Seguir|Lo digo yo"`
   - Check the tour, Lo digo yo (open two blocks and watch the bar move), "Ver mi número", and Hoy with the precision chip, "Afina tu número" and the guide card.
   - Take shots at widths 360, 390 and 430, in light and dark.
   - The demo data may already have cycle settings. If so, the onboarding won't show; use a fresh dev user or clear `user_cycle_settings` in `/v2-debug`.
2. **Extracto path.** Try it with a real or test PDF all the way to "Esto encontré". Parsing needs `EXPO_PUBLIC_API_URL`.
3. **Reviews.** Spawn `zeta-v2-reviewer` on the diff and `mobile-perf-doctor` on `ProgressBar` and the Inicio additions.
4. **Bank step texts.** In `ExtractoPath.tsx` (`BANK_STEPS`), the owner must verify them against each bank app.
5. **Device acceptance** by the owner.

## Known risks and notes

- **Precision chip and screen readers.** The chip sits inside the Disponible block's Pressable, so a screen reader may not focus it on its own. `SetupCard` and the precision sheet carry the same information. Consider moving the chip out of the block.
- **Retries can duplicate.** If a command fails partway through onboarding, retrying re-runs the earlier commands. This was already true before; it may duplicate accounts.
- **Phone-only state.** Goals, "No tengo", pending bills and dismissed suggestions are not synced. That is intended for now; see the design spec.
- **Out of the onboarding.** "Te deben / Tú debes" (no engine command until M4) and the loan interest rate (no field to store it yet) are not included.
- **Before a PR.** Dry-merge `origin/main` first, per `CLAUDE.md`.

## Next PRs

- **PR 2:** tabs Hoy · Movimientos · Mi plata · Herramientas, a contextual +, and an avatar menu (S10-2).
- **PR 3:** Compartir → Zeta (a native PDF intent) and statement forwarding by email in v2 (S10-5).
- **Then the phases:** Debo (including the exchange-rate metric, S10-8) → Gasto → Presupuesto (start from v1's `webapp/src/components/budget/budget-builder.tsx` and `budget-group-lines.tsx`, redesigned so it's easy to read) → Te deben + people connections.
