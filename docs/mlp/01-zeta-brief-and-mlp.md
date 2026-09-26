# Zeta — Brief, critique and MLP (2026-09-25)

Status: **draft, pending decisions** (see §6). Input for the zero-context experience agent.

---

## 1. What Zeta says it is

> Personal finance for Colombians. "Every screen should answer *Am I on track?* without explanation."

Spanish-first, no AI in categorization (deterministic rules), speed over animation. Bank data enters via PDF statements and forwarded bank alert emails, since Colombia has no usable open banking.

## 2. What Zeta actually is (feature inventory, ~30 surfaces)

| Area | Features built |
|---|---|
| **Capture** | Manual form · PDF import wizard (9 banks, 6 steps, reconciliation, cuotas) · Email ingest (bank alerts + statements by email, triage tray) · Telegram bot · voice · OCR screenshot · natural-language quick capture · location tagging · MCP/API endpoint |
| **Organize** | Categories (≈100) + rules auto-categorize · Categorizar inbox · Destinatarios (merchant/person entity with rules, merge, suggestions) · Tags + tag groups · "Clase de flujo" · transfers linking · merge/reconcile |
| **Understand** | Dashboard (health score, verdict chip, widgets catalog, heatmap, burn/waterfall, alerts, customizable layout, nav_focus) · Tendencias · weekly digest engine |
| **Plan** | Budgets (50/30/20, wizard, "armar presupuesto", Dominio/Ritmo) · Plan page (Periodo/envelopes, planning entries) · Recurrentes (templates → occurrences, candidate detection) · Suscripciones · Deseos (wishlist) · ¿Puedo pagarlo? / ¿Comprarlo? |
| **Debt** | Credit cards & loans, cuotas, avalanche/snowball planner, scenarios, extra payment, USD debts + FX timing page |
| **Social / life** | Personas (lend/borrow), shared purchases in cuotas, split groups, Modos/Viajes (trip mode with review tray, participants, multi-currency) |
| **Platform** | Responsive web (Next.js) **and** native Expo app with offline SQLite + sync engine · envelope encryption on 9 tables · demo mode · coach-marks · push reminders · bug reporter · 13 specialist review agents |

## 3. What the data says (production, read-only aggregates)

- **45 sign-ups → 15 ever recorded a transaction (33%) → 9 with ≥20 → 2 with ≥200.** One user holds **75 %** of all transactions.
- ~12 users active in the last 30 days.
- **How transactions arrive (last 120 days):** email-PDF 737 · email alert 546 · PDF upload 525 · manual 164 · OCR 2 · quick-text 1 · voice/Telegram ≈0.
  → **~90 % of data is bank-sourced and automatic. Exotic capture channels are unused.**
- **Near-zero usage:** debt_scenarios 0, budget_scenarios 0, wishlist 3, modos 3, subscriptions 5, tag_groups 2, personal_debt_allocations 0.
- **Heavily used:** categorization (266 user rules, `category_selected` is the #1 web event), imports, dashboard views.

## 4. Critical analysis — the fundamental issues

1. **Built for n=1.** The roadmap follows the developer's life (trips, splitting with friends, USD cards, shared cuotas). Each feature is individually reasonable; together they bury the core. Other users don't activate (67 % never log a transaction).
2. **The core promise has a long, fragile dependency chain.** "Am I on track?" needs income + budgets + complete capture + correct categorization + correct debt semantics. Any missing link produces a wrong verdict (budgets at 2116 %, income counting card payments, savings bucketed as wants, balance drift on mobile). **In finance, one wrong number destroys trust in all numbers.**
3. **Two frontends + offline sync = a permanent parity tax.** Responsive web and native Expo diverge constantly (parity audits, `mobile-webapp-parity`, `mobile-sync-doctor`). A large share of effort goes to keeping two apps equal instead of making one good.
4. **Concept overload.** Destinatario, modo, periodo, sobre, clase de flujo, occurrence, 50/30/20, dominio/ritmo, tier, herramienta vs widget. Internal model names leaked into the UI. A new user must learn a vocabulary before getting value.
5. **The answer is spread over 3–4 screens with 3 different "verdict languages"** (Inicio chip, Presupuestos chip, Plan raw red number). No single number to trust.
6. **Setup before value.** Budgets ask for limits before history exists; onboarding doesn't lead to a first "aha" with real data.
7. **Architecture weight.** Envelope encryption (6-step column adds), cache topology rules, 160+ migrations — good engineering, but it makes every product iteration slow.

**What is genuinely strong (keep):**
- **Automatic capture from Colombian banks** — email alert parsing + PDF parsers + idempotency/reconciliation engine. This is the moat. Nobody else in CO does it well.
- **Deterministic categorization with learned rules** (`@zeta/shared`).
- **Recurring detection → occurrences** (bills calendar).
- **Credit-card/cuota semantics** (paying a card ≠ spending; cuotas ≠ full price) — very Colombian, very painful elsewhere.
- **The import wizard's "consequence, not data" style** — best screen in the app.

## 5. Proposed MLP (minimal lovable product)

**Job to be done:** *"Tell me how much I can still spend this month without me having to type anything, and never let a bill surprise me."*

**One number:** **"Disponible"** — safe-to-spend until next payday (and per day):
`income − upcoming bills/cuotas − savings goal − already spent`. Every surface answers with this number or a bill.

### Core loop
1. Bank alerts arrive by email → Zeta ingests automatically (no typing).
2. Zeta categorizes by rules; unknowns land in a 10-second swipe inbox; each answer teaches a rule.
3. Home shows **Disponible hoy** + pace + next bills.
4. Push: the day before a bill, and a weekly 20-second digest ("Vas bien · te quedan $X").

### In scope (7 things)
1. **Onboarding ≤ 3 min → first real number**: payday + income, connect email forwarding (or drop one PDF as backfill), savings goal (optional). Show Disponible immediately, even if estimated.
2. **Automatic capture**: email alerts (Bancolombia first, then Nu/Davivienda), PDF statement for backfill + reconciliation. **Manual quick-add** (amount → category, 3 taps) for cash.
3. **Home = Disponible** + pace + next 3 bills. Nothing else above the fold.
4. **Movimientos**: list, search, edit category. One row grammar.
5. **Bills (Recurrentes)**: auto-detected, calendar, reminder push. Card statements & cuotas are bills.
6. **Categorize inbox** with rule learning.
7. **Weekly digest** (push + in-app).

### Parked (kept in DB/code, removed from product)
Health score, 50/30/20 buckets, per-category budgets (maybe v1.1 as "limits" on 2–3 categories only), Periodo/envelopes, debt planner & scenarios, Personas/splits, Modos/Viajes, Deseos, ¿Comprarlo?, tags, Tendencias, Telegram, voice, OCR, location, MCP, dashboard customization, nav_focus, multi-currency beyond display. **Destinatarios** stays as an internal merchant-normalization layer, not a user-facing concept.

### What makes it *lovable* (not just minimal)
- Zero typing for 90 % of transactions — the "magic" moment is seeing yesterday's purchases already there.
- One honest number, in plain Spanish, with a tone ("Vas bien", "Frena un poco").
- Never wrong about cards: paying the card is never "spending", cuotas are shown as what they cost this month.
- Fast: cache-first, no skeleton walls.

### Success metrics
- Activation: % of sign-ups who see a Disponible computed from ≥10 real transactions within 24 h (today: effectively <20 %).
- Week-4 retention: opened the app or the digest in week 4.
- Trust: % of transactions the user re-categorizes (should fall week over week).

## 6. Decisions

### Locked (2026-09-25)
| Decision | Choice |
|---|---|
| Target user | Bancarized Colombian young professionals (1–3 banks/cards). The developer is *a* user, not the spec. |
| Platform | **Native app only** (Expo). No web↔native parity. |
| North star | **Disponible** — safe-to-spend until next payday, and per day. |
| Capture onboarding | **Personal forwarding address** + guided Gmail filter setup. No Gmail OAuth (avoids CASA audit). |
| Web app | **Backend + small companion**: APIs, email ingest, parser proxy, bulk PDF import/editing. Never kept in parity. |
| Keep-list (overrides §5 "parked") | **Personas/splits**, **category budgets**, **trips (Modos)** stay in the MLP. |

| Splits | **Not spending.** Only the user's share counts as spending. The rest is a trackable receivable ("Te deben"), per person, that closes when they pay. Today it counts as spending until friends repay (`amount − split_repaid_amount`). |
| Category budgets | **3 limits by default**, suggested from history after 2–4 weeks, shown under Disponible. The user can add more. No 50/30/20, no setup wizard before there's data. |
| Trips | A separate pot. Trip spending doesn't lower the monthly Disponible; friends' shares go to "Te deben". |

| Te deben | **First-class ledger.** Money lent (the others' share of a split, or a direct loan) is its own tracked category, per person, with a running total and a signal when lending gets too high ("¿debería parar?"). Never counted as spending. |
| Disponible vs lending | **Disponible drops by the full outflow** (cash reality). Next to it: "+$X cuando te paguen". This is why lending must be tracked. |
| Capture (Android) | **Bank notification reading, done right**: opt-in; the user picks which apps' notifications Zeta may read (everything else is dropped on-device); pre-built exact templates per bank; unknown notifications from chosen apps go to a training inbox where the user marks amount / merchant / card, which becomes a deterministic template for that sender. Auto-capture only on a full template match; partial matches go to review. Never a generic "any number looks like money" regex; OTP/promo/balance messages are recognized and ignored. |

| AI assist (optional) | AI proposes, deterministic code decides. Typed outputs only. v1: voice/text manual capture (phone speech-to-text, deterministic parser first, AI fallback) + shared merchant-name normalization. Never for idempotency keys, Disponible or live parsing. See `06-ai-assist.md`. |

### Open / assumed
- iOS capture: Gmail read-only connect (≤100 users without Google's audit) + monthly statement PDF. Desktop setup page for email forwarding is a later upgrade, not onboarding.
- Single user (no couples mode); encryption kept, schema frozen for the MLP.
