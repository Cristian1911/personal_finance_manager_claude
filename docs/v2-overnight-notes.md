# v2 overnight build — notes for the owner

Started 2026-10-02 ~01:00. Plan: `docs/superpowers/specs/2026-10-02-v2-launch-plan.md` (decisions S9-1…S9-6).
Each PR is stacked on the previous one and **none is merged**. Nothing touches production: the app and
the tests talk to zeta-dev only. To undo anything, close its PR (and the ones above it).

## PRs (merge in this order)

| PR | Branch | What | State |
|---|---|---|---|
| #446 | `feat/v2-components-tabbar` | Shared controls, tab bar, v2 boundary check, `zeta-v2-reviewer` agent | Open. **Merge together with the next one**: on a real phone the + and the outlined buttons render unstyled until the `Tap` fix in the accounts PR |
| #447 | `feat/v2-accounts` | Debt-aware balances (cards/loans), createAccount/editAccount/archiveAccount, Mis cuentas, Cuenta, Agregar | Open, reviewed, fixes in |
| #448 | `feat/v2-anotar` | Anotar (Gasto/Ingreso/Entre cuentas), live effect line, Dictar, Pagar tarjeta, captureTransfer | Open, reviewed, fixes in |
| #449 | `feat/v2-pagos` | Pagos fijos, card bills, loan cuotas, bill detection, Pagos tab | Open, reviewed, fixes in |
| #450 | `feat/v2-sync` | Sync (phone ↔ zeta-dev), `/api/v2/commands` + `/api/v2/snapshot`, v2 becomes the default screen | Open, reviewed, fixes in |
| #451 | `feat/v2-ajustes` | Ajustes: tu número, apariencia, ayuda, cerrar sesión, borrar mi cuenta | Open |
| #452 | `feat/v2-onboarding` | First run: when you get paid, where your money is, fixed payments | Open |
| (next) | `feat/v2-categorias` | The 25 categories, destinatarios (comercios/personas), matched on capture; Categoría · ¿Quién? on the open row | In review |

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

- **D11. Card bill = what you bought with the card in that statement period** (cut to cut), due on the payment day,
  shown "≈". Debt from before (what you told when adding the card, older statements) is debt, not this bill. The
  spec's S3-6 "minimum payment by default" needs purchase-by-purchase cuotas, which only statements (PDF import) give;
  until then this is the honest estimate. Paying more than the bill is fine; paying less leaves the rest in Por pagar.
- **D12. Pagos fijos are on days 1–28.** The server's generator steps month by month (Jan 31 → Feb 28 → Mar 28), the
  phone computes each month from the start; they only agree on 1–28. "Último día del mes" would need a server change.
- **D13. v2 is the default screen** whenever v2 is on (dev builds and EXPO_PUBLIC_ZETA_V2=1): signed-in users land on
  v2 Inicio; its first-run questions replace v1's onboarding. v1 screens stay reachable by link until deleted.
- **D14. The first category you give a destinatario becomes its default, without asking** ("Desde ahora, Rappi es
  Domicilios · Deshacer"); it also fills that destinatario's past movements that have no hand-picked category. Only
  when it already had a different default does Zeta ask "¿Siempre X para Rappi?" (it may be a one-off). Why: on the
  simulator the question toast vanished before I could answer, and the rule was lost — a real user thinking for 4
  seconds loses it too. Deshacer clears the default but leaves the past movements as filled.
- **D15. Naming a destinatario remembers its text.** "+ Nuevo comercio «Rappi»" saves the movement's cleaned text as
  the pattern, so the next "RAPPI COLOMBIA" (typed, email or PDF) gets Rappi and Domicilios with zero taps (tested).
  Picking an existing one also adds the text as a new pattern. Personas vs Comercios: the tab opens on Personas when
  the text looks like a transfer (transf/Nequi/Daviplata/Bre-B), else Comercios.
- **D16. The category picker** shows the 25 grouped (Comida, Transporte, Hogar, Ocio, Finanzas); groups of one go
  together under "Otras". Only categories for the movement's direction (gastos vs Salario/Otros ingresos). Tapping
  the current one clears it. Detalle doesn't show category/destinatario yet — the open row already does.

## Things only you can do

1. **Production web server env** (for sync to work from real phones): add `V2_SUPABASE_URL`, `V2_SUPABASE_PUBLISHABLE_KEY`,
   `V2_DATABASE_URL` to the VPS `.env` (docker-compose.prod.yml already passes them through, #sync PR). Without them
   `/api/v2/*` answers 503 and phones keep working offline only. For `V2_DATABASE_URL`: the **pooler** URL with
   `sslmode=require` (direct connections are IPv6-only), and ideally a dedicated login role that is only a member of
   `authenticated` — not `postgres` — so nothing on the web server can bypass RLS/encryption by mistake.
   (The launch plan's `V2_SUPABASE_SECRET_KEY` is not needed; the code uses the DB URL.)
2. **Google/Apple sign-in on zeta-dev** (you were on it).
3. **Before launch**: delete the test user `claude-sim@zeta-dev.test` (created for the simulator sync test) and turn on
   backups for zeta-dev.
4. **My local leftovers** (not in git): `mobile/.env` points `EXPO_PUBLIC_API_URL` at `http://localhost:3000` for the sync
   test; the original is in `mobile/.env.before-sync-test`. A local web dev server and Metro may still be running.

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
- **Paying a bill that was already set aside** showed Disponible dropping again in Anotar's preview (seen on the simulator);
  the preview now applies the same detection as saving.
- **A bill paid with a card, or just before the cycle began, stayed subtracted** while Pagos said Pagado; a partial card
  payment erased the whole card bill; a late loan payment paid two cuotas. All fixed with tests (review of #449).
- **iOS drops a modal opened while another is closing** (Pagar from a bill's sheet did nothing): `Sheet.onClosed`.

## Still pointing at v1 screens (fixed as each v2 screen lands)

Inicio widget buttons: `import_statement` (/import), `split_purchase`, `lend`, `see_people` (/personas). The Tarjeta widget
doesn't read accounts yet ("Sin tarjetas aún" even with a card).

## Pre-existing, not mine

- `packages/shared` tsc: `scenario-engine.test.ts` → `Cannot find name 'DebtAccount'` (on main).
