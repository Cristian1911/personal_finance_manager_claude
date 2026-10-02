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
| #453 | `feat/v2-categorias` | The 25 categories, destinatarios (comercios/personas), matched on capture; Categoría · ¿Quién? on the open row | Open, reviewed, fixes in |
| #454 | `feat/v2-email` | Bank emails: forwarding address, Bancolombia alerts as commands (merge / hold / new), Revisar "¿Es el mismo?", Correos del banco | Open, reviewed, fixes in |
| #455 | `feat/v2-pdf` | Subir un extracto (PDF): statements as commands, unknown accounts offered, balance anchored at the cut | Open, reviewed, fixes in |

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
- **D17. Texts shorter than 4 letters aren't remembered** ("Pan" would match "empanadas"). Correcting who a text
  belongs to moves its rule to the new destinatario (one rule per text, as Supabase already enforces).
- **D18. One "últimos 4" per account.** On a savings account it matches the account's alerts (Cta *1234) and its
  debit card's (T.Deb *0735). If you have both numbers, put the card's; account-number alerts then need the Revisar
  card that isn't built yet (see below). A second field can come if this bites.
- **D19. A bank email that may be something you anotaste is held, not counted, until you answer** in Revisar ("¿Es
  el mismo movimiento?" · Sí, es el mismo / No, son dos). S1-2 says weak matches are never resolved alone; holding
  keeps Disponible right in the common case (it was the same purchase). Strong matches (same amount + same place)
  merge on their own: the bank's row takes over and keeps your category, destinatario and note.
- **D20. Emails reach the phone when you open Zeta** (sync on foreground). A push that wakes the sync comes later.
- **D21. Bank names are shown readable**: "DUNKIN DONUTS" → "Dunkin Donuts", "CREPES Y WAFFLES" → "Crepes y Waffles".
  Bank rows show the bank's time (3:31), not when the email arrived.
- **Not built yet (email):** an alert from a card no account has (unknown last 4) is skipped and logged; D1 wants a
  Revisar card "agregar como nueva / es de…". Attachments (statement PDFs by email) are ignored by v2 for now.
  Every email outcome is logged in `email_ingest_logs` with v1's statuses (the template-drift replay covers v2).
  Known gaps: merging a fixed payment's movement re-stamps its paid date to the merge time; the `From` header can
  be spoofed (same as v1 — only Bancolombia's sender is accepted, so a fake alert is the risk, not data loss).
- **D22. Subir un extracto (PDF)** lives in Mis cuentas. Zeta's server reads the PDF; a statement whose account it
  knows (kind + last 4) goes there; an unknown one asks: Crear «Bancolombia tarjeta ••7706» (default), "Es <cuenta>",
  or No importar (D1, never silent). Rows merge with emails and what you anotaste (the statement is the highest
  tier); the account is set to the statement's final balance at its cut plus what moved after it; a new card learns
  its cut day, payment day and limit. Uploading the same PDF again changes nothing. Not in yet: rows in another
  currency (USD sections), investments, saved PDF passwords (asked each time), the "¿Es el mismo?" for statement vs
  anotado with different words (held to Revisar, same as email).
- **D23. Every account knows "as of when" its balance is true**: when you told it (Agregar), or the end of a
  statement's cut day. Bank movements from before that instant are already inside it: they show up in Movimientos
  but don't move the balance, and an older statement never re-anchors a newer balance. So a new user who adds
  "Bancolombia: $1.000.000" today and then uploads September gets September's movements and categories without
  their balance changing. A card created *from* its statement takes the statement's balance at the cut.
- **Statement questions:** "Crear" is the default only when you have no account of that kind; with one, Zeta
  assumes it's that one; with several, you choose (a second "Bancolombia" would count everything twice). A USD
  section of a card statement is shown as "Zeta aún no lleva otras monedas" and never touches the COP card.
- **Speed (check on the VPS):** each statement row is ~15 database round trips. From here (159 ms to sa-east-1) a
  4-row statement took ~20 s. If the VPS is far from São Paulo, a 60-row statement will be slow; then batch the
  rule and template lookups per import.
- **Statements land by date in Disponible:** a bank row without a time is placed by its date, so last month's
  statement doesn't count as spent after your starting balance (fixed in the engine, applies to emails too).

## Things only you can do

- **Bank emails for v2:** in Resend, add a webhook endpoint `https://<app domain>/api/v2/email` for `email.received`
  and put its signing secret in the VPS `.env` as `RESEND_WEBHOOK_SECRET_V2` (falls back to `RESEND_WEBHOOK_SECRET`).
  The v2 route ignores the web app's addresses; the web app's route will log v2 addresses as "No active ingest
  address" (harmless noise in `email_ingest_logs`). If the VPS DB role for v2 isn't `postgres`, it needs SELECT on
  `email_ingest_addresses_enc` (to route an email to its user).

- **Deploy the server before the phone build** whenever sync tables change: a new phone build pulling from an old
  server fails every pull ("Snapshot without destinatarios" / "field_versions").

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

None: Inicio's "Importar extracto" opens Mis cuentas' PDF picker; Te deben's buttons (Dividir una compra, Anotar un
préstamo, Ver todo) say "Muy pronto" instead of opening v1 screens that write v1's data. The Tarjeta widget reads
the cards (next bill = purchases of its period, due date, cut, total owed).

- **D24. A card's bill in Disponible is what you bought in its period (D11), not the statement's minimum.** The spec
  (S3-6) says minimum by default; the statement's minimum isn't stored yet. Decide: keep "the whole bill" (safer
  number) or switch to the minimum once statements bring it.

## Pre-existing, not mine

- `packages/shared` tsc: `scenario-engine.test.ts` → `Cannot find name 'DebtAccount'` (on main).
