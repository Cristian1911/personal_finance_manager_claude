# Zeta v2 — use-case catalog (draft for review, 2026-09-28)

Every architecture, database and screen decision is checked against this list. Nothing gets built unless it serves a use case here; nothing here ships without a screen that serves it.

**How to read it**
- **Where:** the v2 surface that serves it (Inicio, Movimientos, Revisar, Detalle sheet, Pagos, Te deben, Límites, Viaje, Ajustes, Onboarding, Push). "Auto" = no screen, the app does it.
- **Release:** `v1` launch · `v1.1` · `later` · `out` (deliberately not in the product).
- **Status:** `ok` = follows the decisions in `01`/`03`/`04` · **`DECIDE`** = open, needs your call (collected at the end).
- IDs are stable; later docs reference them (e.g. "UC-F7").

---

## A. Getting started

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| A1 | Sign up with Google or Apple | Onboarding | v1 | ok |
| A2 | Tell Zeta when I get paid (15/30, monthly, biweekly, irregular) | Onboarding, Ajustes › Cuándo me pagan | v1 | ok |
| A3 | Tell Zeta how much I receive each payday | Onboarding, Ajustes | v1 | ok |
| A4 | Tell Zeta how much I have today, to get my first number | Onboarding | v1 | ok |
| A5 | Declare the fixed payments I still owe before payday | Onboarding | v1 | ok |
| A6 | See my Disponible before giving any permission | Onboarding (aha) | v1 | ok |
| A7 | Connect a capture source: bank notifications (Android) / Gmail (iPhone) / a PDF | Onboarding, Ajustes › Fuentes | v1 | ok |
| A8 | Add my accounts and cards (or let Zeta create them from what it sees) | Onboarding, Ajustes › Mis cuentas | v1 | **DECIDE** (D1) |
| A9 | Sign in on a new phone and find everything there | Login | v1 | ok |
| A10 | Existing user: move from the old app to v2 without losing data | First launch of v2 | v1 | ok |

## B. Knowing where I stand

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| B1 | See how much I can still spend until payday, and per day | Inicio | v1 | ok |
| B2 | Know at a glance if I'm doing fine (Vas bien / Cuidado / Te pasaste) | Inicio | v1 | ok |
| B3 | Understand how that number was calculated | Inicio › ¿Cómo se calcula? | v1 | ok |
| B4 | See where my money went this cycle, by category | Inicio › Ya salió › ¿En qué se me fue? | v1 | ok |
| B5 | See the balance of each account and card | ¿Cómo se calcula? › Mis cuentas | v1 | ok |
| B6 | See what still needs to be paid this cycle and next | Pagos del ciclo | v1 | ok |
| B7 | See my next payment | Inicio | v1 | ok |
| B8 | See who owes me and how much | Te deben | v1 | ok |
| B9 | See how my limits are going | Límites | v1 | ok |
| B10 | Get a weekly summary | Push + Inicio card (Sun/Mon) | v1 | ok |
| B11 | See past cycles (how did last month go?) | Movimientos cycle switcher | v1 | **DECIDE** (D2) |
| B12 | See my total debt (cards + loans) and how it's going down | — | later | **DECIDE** (D3) |
| B13 | See a home-screen widget with my Disponible | Widget | v1.1 | ok |

## C. Recording money that moves

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| C1 | Have my purchases appear on their own from bank notifications | Auto (Android) | v1 | ok |
| C2 | Have my purchases appear on their own from bank emails | Auto (Gmail / forwarding) | v1 | ok |
| C3 | Import a bank statement PDF to fill gaps and correct amounts | Ajustes › Fuentes, push "Extracto listo", web companion | v1 | ok |
| C4 | Register a cash expense by hand (amount → category) | Inicio "+" | v1 | ok |
| C5 | Register an expense by voice or text ("almuerzo 45 mil") | Inicio "+" | v1 | ok |
| C6 | Register an income that isn't my salary (bonus, freelance) | Inicio "+", or auto | v1 | ok |
| C7 | Register a transfer between my own accounts (not spending) | Auto pairing, or Detalle "Es a mi cuenta" | v1 | ok |
| C8 | Register a refund of a purchase | Auto (template), Detalle | v1 | ok |
| C9 | Register a payment of a bill (rent, internet) | Auto-match to Pagos, or Pagos › Marcar pagado | v1 | ok |
| C10 | Register a credit card payment (it isn't spending) | Auto, or Pagos › card › Registrar pago | v1 | ok |
| C11 | Register a purchase in cuotas | Revisar "¿A cuántas cuotas?", Detalle › Cuotas | v1 | ok |
| C12 | Register a purchase in another currency | Auto (≈), corrected by PDF | v1 | ok |
| C13 | Register an expense from the past (I forgot) | "+" with date | v1 | ok |

## D. Fixing and organizing

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| D1 | Change the category of one movement | Detalle | v1 | ok |
| D2 | Change it for this merchant from now on ("¿Siempre para Rappi?") | Detalle, Revisar | v1 | ok |
| D3 | Also fix the past movements of that merchant | Same prompt ("también las anteriores") | v1 | ok |
| D4 | Tell Zeta a merchant is sometimes different (Siempre / Casi siempre / Pregúntame) | Revisar, Hoja de comercio | v1 | ok |
| D5 | Rename a merchant | Detalle, Hoja de comercio | v1 | ok |
| D6 | Merge two merchants that are the same | Hoja de comercio | v1 | ok |
| D7 | Fix the amount, date, account or note of a movement | Detalle | v1 | ok |
| D8 | Say "this isn't a movement" or delete it | Detalle | v1 | ok |
| D9 | Decide if two movements are the same (duplicate) | Revisar | v1 | ok |
| D10 | Answer the pending questions quickly | Revisar | v1 | ok |
| D11 | Teach Zeta a notification it doesn't understand | Revisar (training card) | v1 | ok |
| D12 | Sort many merchants in one minute (drag to category) | Revisar › Ordenar | v1.1 | ok |
| D13 | See what Zeta knows (merchants per category, automation %) | Ajustes › Categorías | v1 | ok |
| D14 | Make my number match my real bank balance | ¿Algo no cuadra? › Cuadrar con mi saldo | v1 | ok |
| D15 | Undo something Zeta or I just did | Toast (5 s), Detalle | v1 | ok |
| D16 | Search for a movement | Movimientos | v1 | ok |
| D17 | Create my own category (beyond the 25) | Category picker › Nueva | v1 | ok |
| D18 | Use tags on movements | — | out | **DECIDE** (D4) |

## E. Bills and recurring payments

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| E1 | See what needs to be paid (this cycle / next) | Pagos del ciclo | v1 | ok |
| E2 | Confirm a payment Zeta detected as recurring ("¿Pagas Netflix cada mes?") | Revisar | v1 | ok |
| E3 | Add a recurring payment by hand | Pagos › + Agregar un pago | v1 | ok |
| E4 | Update a recurring payment (amount, day, account) from now on | Pagos › row › Detalle del pago | v1 | ok |
| E5 | Change only this month's amount (the bill came higher) | Pagos › row | v1 | ok |
| E6 | Skip one month | Pagos › row | v1 | ok |
| E7 | Stop a recurring payment (cancelled Netflix) | Pagos › row | v1 | ok |
| E8 | Mark a bill as paid when Zeta didn't see the payment | Pagos › row, push "¿Ya pagaste Claro?" | v1 | ok |
| E9 | Link a movement to the bill it paid (Zeta guessed wrong) | Detalle › "Pagó…" | v1 | ok |
| E10 | Get reminded the day before a bill | Push | v1 | ok |
| E11 | Pay a bill in several parts | Pagos (partial) | v1 | **DECIDE** (D5) |
| E12 | See my subscriptions as a group | — (they're just bills) | out | ok |

## F. Credit cards, loans and debts with banks

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| F1 | Add a credit card (limit, cut day, due day, rate) | Ajustes › Mis cuentas, or from a PDF | v1 | ok |
| F2 | See this month's card bill and what it covers | Pagos › card | v1 | ok |
| F3 | Pay the card (minimum, total or other amount) | Auto, or Pagos › card | v1 | ok |
| F4 | See the cuotas pending on a card | Pagos › card › cuotas | v1 | ok |
| F5 | Register a new loan (bank, vehicle, libre inversión): amount, rate, cuota, day | Ajustes › Mis cuentas › + Crédito | v1 | **DECIDE** (D3) |
| F6 | Register a loan payment that covers the next cuota | Auto-match, or Pagos › loan | v1 | ok |
| F7 | Register a payment that covers the next minimum **and closes the debt** (pay-off) | Pagos › loan/card › Registrar pago | v1 | **DECIDE** (D6) |
| F8 | Make an extra payment to a loan (abono a capital) | Pagos › loan | v1 | **DECIDE** (D6) |
| F9 | See how much I still owe on a loan and when it ends | Pagos › loan | v1 | **DECIDE** (D3) |
| F10 | Plan paying off debts (avalanche/snowball, scenarios) | — | out | ok (01: nobody used it) |
| F11 | Handle a card with USD debt | Pagos › card (≈ COP) | v1 | **DECIDE** (D7) |

## G. Te deben (money I lent) and money I owe people

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| G1 | Say a purchase was shared; only my part is spending | Detalle / Revisar › Fue compartido | v1 | ok |
| G2 | Say who owes me what from it (equal or custom split) | Same flow | v1 | ok |
| G3 | Register money I lent directly (not a purchase) | Te deben › + Presté plata | v1 | ok |
| G4 | Have a repayment detected ("Juan te envió $80.000, ¿es lo que te debía?") | Revisar | v1 | ok |
| G5 | Register a repayment by hand (full or partial) | Te deben › persona › Registrar pago | v1 | ok |
| G6 | Forgive what someone owes (becomes my spending) | Te deben › persona | v1 | ok |
| G7 | Send a reminder by WhatsApp (pre-written) | Te deben › persona | v1 | ok |
| G8 | Be warned when I'm lending too much | Te deben, digest | v1 | ok |
| G9 | Register money **I** owe a person (they paid for me) | — | ? | **DECIDE** (D8) |
| G10 | Share a purchase in cuotas with someone | Fue compartido on a cuota purchase | v1 | ok (engine exists) |

## H. Límites (the budget)

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| H1 | Get 3 limits suggested from what I actually spend | Revisar card (after ≥14 days) | v1 | ok |
| H2 | Create a limit for a category myself | Límites › + | v1 | ok |
| H3 | Change or remove a limit | Límites › row | v1 | ok |
| H4 | See each limit: spent, pace, "te quedan $X" | Límites | v1 | ok |
| H5 | Be warned when a limit reaches Cuidado | Push | v1 | ok |
| H6 | Create a full budget before I have data (all categories, 50/30/20) | — | out | ok (01 decision) |

## I. Saving

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| I1 | Set aside a fixed amount each cycle | Ajustes › Ahorro, first payday prompt | v1 | ok |
| I2 | Decide what to do with what I didn't spend (to savings / keep it) | Push + prompt at new cycle | v1 | ok |
| I3 | See how much I've saved in total / towards a goal | — | later | **DECIDE** (D9) |

## J. Trips

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| J1 | Create a trip with dates, pot and currency | Inicio › + Viaje | v1.1 | ok (plan Q4) |
| J2 | Decide where the trip money comes from (saved / this cycle / several cycles) | Same | v1.1 | ok |
| J3 | Answer "¿Es del viaje?" for movements during the trip | Revisar | v1.1 | ok |
| J4 | See the pot: spent, left, per day | Viaje | v1.1 | ok |
| J5 | Split trip expenses with friends | Fue compartido (tagged with trip) | v1.1 | ok |

## K. Settings, privacy, trust

| ID | I want to… | Where | Release | Status |
|---|---|---|---|---|
| K1 | Choose which bank apps Zeta may read | Ajustes › Fuentes | v1 | ok |
| K2 | See if each source is working, and fix it (permission, battery) | Ajustes › Fuentes, Inicio line | v1 | ok |
| K3 | See and delete the notification formats Zeta learned | Ajustes › Plantillas | v1 | ok |
| K4 | See notifications Zeta ignored and rescue one | Ajustes › Ignorados | v1 | ok |
| K5 | Choose which pushes I get | Ajustes › Avisos | v1 | ok |
| K6 | See what leaves my phone (and the discard counter) | Ajustes › Privacidad | v1 | ok |
| K7 | Export my data (CSV) | Ajustes › Privacidad | v1 | ok |
| K8 | Delete everything | Ajustes › Privacidad | v1 | ok |
| K9 | Lock the app with Face ID / fingerprint | Ajustes | v1 | ok (exists) |
| K10 | Switch light / dark / system theme | Ajustes | v1 | ok |
| K11 | Save my PDF password so I don't type it every month | PDF import | v1 | ok (exists) |

---

## Open decisions in this catalog

| # | Question | My recommendation |
|---|---|---|
| D1 | **Accounts:** does the user create accounts/cards up front, or does Zeta create them from the first notification/email/PDF it sees ("Bancolombia *4410")? | Auto-create from what Zeta sees, confirm with one Revisar card; manual add stays in Ajustes. Onboarding asks only for the balance total (A4). |
| D2 | **Past cycles:** can I browse last month's Disponible/verdict, or only past movements? | Movements + a one-line cycle result ("Ciclo 1–14 sep: te sobraron $85.000"). No history charts. |
| D3 | **Loans as first-class:** 03 treats cards as accounts and cuotas as bills, but says little about bank loans. Do loans get balance, rate, remaining term and payoff tracking, or are they just a recurring bill? | A loan is an account (type LOAN, exists today) with balance + rate; its cuota is a bill. Show "Te faltan $X · termina en mar 2028" in Pagos. No planner. |
| D4 | **Tags:** v1 had tags + tag groups (2 users used them). Keep? | Out. Trips cover the main tag use. Data kept in DB. |
| D5 | **Partial bill payment:** pay rent in two transfers. | v1: an occurrence can have several linked payments; paid when the sum ≥ amount (±5%). |
| D6 | **Pay-off and extra payments** (F7, F8): when a payment covers the minimum and more, or closes the balance. | One "Registrar pago" flow: Zeta shows the consequence ("Cubre la cuota de octubre y deja el crédito en $0 · se cancelan las cuotas siguientes") before saving. Extra payments lower the balance; future cuotas unchanged unless the balance hits 0. Detailed in session 3. |
| D7 | **USD card debt:** show in COP (≈) or keep a separate USD line? | COP ≈ in Pagos, "USD 120" as subtitle; exact on PDF import. The FX timing page is out. |
| D8 | **Money I owe people** (someone paid my share). v1 supports it (`borrowed`); 03 only has Te deben. | v1: yes, as a second section in the same screen ("Tú debes"), same mechanics reversed. It changes Disponible honesty the other way (you'll have to pay it). |
| D9 | **Savings goals** beyond "aparta $X por ciclo". | Later. v1 only tracks the per-cycle amount and the surplus decision. |

**Please review:** add missing use cases, strike what you don't want, move anything between v1 / v1.1 / later / out, and answer D1–D9 (or tell me to take the recommendations).
