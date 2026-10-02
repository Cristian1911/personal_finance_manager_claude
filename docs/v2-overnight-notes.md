# v2 overnight build — notes for the owner

Started 2026-10-02 ~01:00. Plan: `docs/superpowers/specs/2026-10-02-v2-launch-plan.md` (decisions S9-1…S9-6).
Each PR is stacked on the previous one and **none is merged**. Nothing touches production: the app and
the tests talk to zeta-dev only. To undo anything, close its PR (and the ones above it).

## PRs (merge in this order)

| PR | Branch | What | State |
|---|---|---|---|
| #446 | `feat/v2-components-tabbar` | Shared controls, tab bar, v2 boundary check, `zeta-v2-reviewer` agent | Open. **Merge together with the next one**: on a real phone the + and the outlined buttons render unstyled until the `Tap` fix in the accounts PR |
| #447 | `feat/v2-accounts` | Debt-aware balances (cards/loans), createAccount/editAccount/archiveAccount, Mis cuentas, Cuenta, Agregar | Open, reviewed, fixes in |
| (next) | `feat/v2-anotar` | Anotar (Gasto/Ingreso/Entre cuentas), live effect line, Dictar, Pagar tarjeta, captureTransfer | Open, reviewed, fixes in |

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

- **D6. Only "Mi sueldo" can be the salary** when written by hand. It's saved with the fixed description "Sueldo"
  (what you type in "De qué" goes to the note) so Inicio recognizes it. An Ingreso extra or Me pagaron near payday
  adds to Disponible instead of replacing the expected salary. Upgrade path: a real mark when salaries link to
  their recurring income.
- **D7. Paying a card lowers Disponible when you pay it.** The spec says the card *bill* is reserved in Por pagar
  beforehand; card bills aren't wired into Pagos yet. When they are, payments will settle the reserved bill instead.
- **D8. "Me pagaron" is a plain income** until Te deben exists (then it should settle who owed you).
- **D9. Dictar only works with an on-device Spanish model** (privacy labels say audio stays on the phone). Phones
  without one get a clear message. Not testable on the simulator.
- **D10. Anotar fecha: Hoy / Ayer only.** Older dates: fix them in Detalle.

## Found and fixed

- **Card balances moved the wrong way in the v2 engine** (a card purchase lowered the debt). Now cards/loans
  follow v1: purchases raise what you owe, payments lower it. Tests on both databases + zeta-dev.
- **NativeWind breaks `Pressable` style functions on native** (web preview hid it): the + vanished and outlined buttons
  lost their borders. New `Tap` component; `pnpm --dir mobile check:v2` now rejects the pattern.

- **Quick capture (v1 too)**: "300 mil" was read as 300 millones, "2 millones" as $2, and plain "20000" wasn't read.
  Fixed with tests; also ships to the web's quick capture.
- **Deleting a manual transfer leg could delete a bank row** linked to it by v1's "link as transfer". Now only
  all-manual transfers delete together.
- **Accounts could go negative silently** (seen on the simulator): Anotar warns before saving.

## Still pointing at v1 screens (fixed as each v2 screen lands)

Inicio widget buttons: `add_bill` and `see_bills` (/recurrentes), `import_statement` (/import),
`split_purchase`, `lend`, `see_people` (/personas), Disponible detail "Por pagar" (/recurrentes). The Tarjeta widget doesn't
read accounts yet ("Sin tarjetas aún" even with a card) — comes with Pagos.

## Pre-existing, not mine

- `packages/shared` tsc: `scenario-engine.test.ts` → `Cannot find name 'DebtAccount'` (on main).
