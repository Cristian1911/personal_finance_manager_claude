# Zeta · Plan "Periodo" → Living Timeline — design brief

> Paste this into Claude Design. Decisions below are **locked**; we want your polish + exploration *within* them (Flow 05 · Plan). Where it says "explore", go wide.

## What Zeta is
Spanish-first personal finance app for Colombian users. **Dark UI, brass/gold accent (`#d9b681`), mobile-first.** Speed over animation. The "Periodo" plan is **envelope budgeting**: income envelopes (a real-account "Saldo" item + each paycheck like "Nómina BC") and expenses (e.g. "Pago NU Bank", "Pago VISA"), with **assignments** linking each expense to the income that funds it.

## The problem
Today the plan is a **static day-1 snapshot** — the whole month flat, past and future with equal weight. By the 25th the paychecks landed and the expenses are paid, yet the board still presents stale envelopes to "allocate". It doesn't move with time, so the user can't trust it to answer "where am I right now?"

## The evolution — a LIVING TIMELINE that advances daily

### Locked decisions
1. **Saldo actual** = the user's **real accounts balance**, live. Grows when income lands, shrinks when expenses are paid.
2. **Two headline numbers, both important**, shown in a **TOGGLE hero** (segmented control swaps the big number; the inactive one's bar segment dims, and a small secondary line still shows it):
   - **Puedo gastar** = `saldo actual − comprometido`
   - **Comprometido** = money owed to still-unpaid assigned expenses
   - A single split bar under the number shows libre (brass `#d9b681`) vs comprometido (amber `#e0976a`).
3. **Income envelope states**: `esperado` (not arrived) · `confirmado` (landed) · `atrasado` (past its date, unconfirmed → flagged in soft red `#c98b8b`, never silently dropped).
4. **Confirming income is what makes Saldo real.** Two paths:
   - **Auto**: a recognized bank import links the real transaction → auto-confirmed.
   - **Manual**: **"Confirmar recibido"** always opens a **confirmation sheet** (confirm/adjust amount + account, or link an already-imported movement). Deliberate confirmation gate — this is the action that moves the real balance, so accuracy beats speed; never a careless one-tap.
5. **Assignments persist** after income lands → each envelope still shows *committed vs free*.
6. **Collapse the settled, on BOTH sides.** A **HOY** divider splits the period. Confirmed income and paid expenses **collapse into a single summary bar** each (e.g. `✓ 3 confirmados · $7.200.000  [mostrar ▾]` / `✓ 8 pagados · $7.587.781`). Only the **actionable** items stay expanded: income to confirm, expenses to pay/assign.

### Layout (both in scope — webapp)
- **Desktop (~960px)**: full-width toggle hero (with saldo + comprometido on the right), HOY divider, then **two columns** — Ingresos | Gastos — each collapsing its settled items.
- **Mobile-web (~380px)**: same hero, HOY divider, then **Ingresos / Gastos tabs** (one column), same collapse behavior.
- Native mobile app: out of scope now, parity audited later.

## What we want from you (explore within the locked decisions)
1. **Hero polish** — the toggle's resting state, motion on swap, how the secondary number + split bar read at a glance. Make "am I on track?" answerable in one look.
2. **The HOY divider + collapse** — how "settled past" folds without losing the running total; whether the summary bar should also surface libre/comprometido. Keep it short on mobile (no long scroll).
3. **Envelope/expense cards** — visual language for `esperado / confirmado / atrasado` (income) and `pendiente / pagado` (expense), the confirm + pay affordances, and how assignment chips show committed-vs-free per card.

## Constraints
- **Spanish UI.** Dark theme, brass accent, reuse existing tokens (`text-z-brass`, `bg-z-surface-2`, `border-white/6`).
- **Mobile-first**, tab bar floats at bottom — keep clearance.
- Speed over animation; optimistic updates.
- Reference: **Flow 05 · Plan** (variants A/B/C) in `claude-ai-design/Zeta Wireframes.html`.
