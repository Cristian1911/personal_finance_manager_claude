# v2 overnight build — notes for the owner

Started 2026-10-02 ~01:00. Plan: `docs/superpowers/specs/2026-10-02-v2-launch-plan.md` (decisions S9-1…S9-6).
Each PR is stacked on the previous one and **none is merged**. Nothing touches production: the app and
the tests talk to zeta-dev only. To undo anything, close its PR (and the ones above it).

## PRs (merge in this order)

| PR | Branch | What | State |
|---|---|---|---|
| #446 | `feat/v2-components-tabbar` | Shared controls, tab bar, v2 boundary check, `zeta-v2-reviewer` agent | Open. **Merge together with the next one**: on a real phone the + and the outlined buttons render unstyled until the `Tap` fix in the accounts PR |
| (next) | `feat/v2-accounts` | Debt-aware balances (cards/loans), createAccount/editAccount/archiveAccount, Mis cuentas, Cuenta, Agregar | Being finished |

## Decisions I took for you (simplest option; change any)

- **D1. Mis cuentas header = the sum of the accounts that count** (the rows add up). Inicio's Disponible still starts from the
  "¿Cuánto tienes hoy?" answer in the first cycle, so if you add accounts later the two can differ for that cycle.
  Onboarding will ask the balance per account so they start equal. *Open question:* when you add an account mid-cycle,
  should Zeta re-base Disponible on your accounts? (Today: no.)
- **D2. Cuadrar (set an account's real balance) is postponed**: setting an absolute balance while movements replay on the
  server is an ordering problem. Until then a wrong balance is fixed by anotar an adjustment. In BACKLOG.
- **D3. Archivar** is a red confirm (it ends the account's use) but it's reversible in the data; there's no "Archivadas"
  screen yet to bring one back.
- **D4. Agregar kinds:** Cuenta (Ahorros/Corriente), Efectivo, Tarjeta, Crédito. Inversión/Otro aren't offered.
  "Desde un extracto" comes with PDF import.
- **D5. Placeholders say "Ej: …"**: plain examples ("Tarjeta Nu", "27") looked like filled-in values on the phone.

## Found and fixed

- **Card balances moved the wrong way in the v2 engine** (a card purchase lowered the debt). Now cards/loans
  follow v1: purchases raise what you owe, payments lower it. Tests on both databases + zeta-dev.
- **NativeWind breaks `Pressable` style functions on native** (web preview hid it): the + vanished and outlined buttons
  lost their borders. New `Tap` component; `pnpm --dir mobile check:v2` now rejects the pattern.

## Still pointing at v1 screens (fixed as each v2 screen lands)

Inicio widget buttons: `capture` (/capture), `add_bill` and `see_bills` (/recurrentes), `import_statement` (/import),
`split_purchase`, `lend`, `see_people` (/personas), Disponible detail "Por pagar" (/recurrentes). The + opens the
engine debug screen until Anotar lands.

## Pre-existing, not mine

- `packages/shared` tsc: `scenario-engine.test.ts` → `Cannot find name 'DebtAccount'` (on main).
