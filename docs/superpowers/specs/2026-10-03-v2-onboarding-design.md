# Zeta v2: onboarding design (2026-10-03)

**Decisions:** S10-3, S10-4, S10-5, S10-6 (`docs/mlp/12-decision-log.md`).
**Prototype:** the "Zeta onboarding propuestas" Claude Design canvas (owner's private artifact, `claude.ai/artifact/Saoowe3KM2Bdf9YzNp7T1R`). Its *Recomendada v2* artboard is the target flow. Visual details come from the v2 tokens and widget rules, not from the prototype.

## Problem

The first-run onboarding (`mobile/v2/components/Onboarding.tsx`, PR #452) had three steps: payday, accounts, and fixed payments.

Step 3 blocked the user. Once you tapped a chip such as Arriendo, the app required an exact amount and a day between 1 and 28. Most people don't have those numbers at hand on day 1, the owner included.

The flow also didn't sell the app. It never showed what you would get, and it never told you how to come back and finish later.

## Principles

1. **Show first, ask later.** A three-screen tour uses Laura's sample data.
2. **Never block on what you don't know.** Basics are enough to get a number. Everything else is optional and becomes a task.
3. **The number is honest.** It shows Disponible together with a precision level (Borrador, Aproximado, Real). Completing setup feels like progress, not paperwork.
4. **Statements are the shortcut, not a gate.** Three months of PDFs fill in most of the picture.
5. **Onboarding continues.** The "Afina tu número" tasks stay on Hoy until they're done. Each section also gets its own intro when it opens (later phases).

## First-run flow

```
Tour (3, skippable) → Objetivos (optional) → ¿Cómo empezamos?
   ├─ Tengo mis extractos → guía por banco → subir PDF(s) → Esto encontré (pagos fijos Sí/No + ¿cuándo te pagan?) → Hoy
   │                                      └─ Lo hago después → Lo digo yo
   └─ Lo digo yo → Lo básico + ¿Tienes más a la mano? (blocks) → Hoy
Hoy: Disponible with precision · "Afina tu número" card · first-time coach mark (once)
```

### Tour (Laura)
1. **"Cuánto puedes gastar, hoy"** shows her Disponible ($421.100, $35.000 por día, Vas bien), her next bill and her Nu card at the cut.
2. **"En qué se le va y cuánto debe"** shows a spending split bar, her debt with its monthly interest, and one improvement point.
3. **"Sus herramientas de plata"** shows Te deben, Pagos, Presupuesto and her USD debt.

The tour ends with the button **"Quiero esto con mis datos"**. "Saltar" is always available.

### Objetivos
These are optional chips, saved on the phone. For now they only order Hoy's emphasis.
- Saber cuánto puedo gastar
- Entender en qué se me va
- Ordenar mis deudas
- Controlar un presupuesto
- Llevar cuentas con amigos
- Ahorrar para algo

### Tengo mis extractos
- **Bank chips:** Bancolombia, Nu, Davivienda, Otro / correo. Each shows three steps.
  - **The step texts must be verified by the owner** before release.
  - The PDF password is usually the cédula, and Zeta can remember it.
- **Upload:** "Ya los tengo, subir PDF" uses the existing picker and `ExtractoSheet`.
- **"Esto encontré":**
  - What the statements show: accounts, cards and balance.
  - **Detected fixed payments** (S10-6), each with a Sí/No answer.
  - "¿Cuándo te pagan?" chips.
- **Saving the setup:** the balance anchor is the sum of the accounts that count for Disponible. Accepted payments become `createPagoFijo` commands.
- **"Lo hago después"** falls back to Lo digo yo. The "Sube tus extractos" task stays on Hoy.

### Lo digo yo
- **Lo básico (required):**
  - When you get paid (chips).
  - How much arrives each time (not asked for "Varía").
  - How much you have today, in total. A round number is fine.
- **¿Tienes más a la mano? (optional):** each block opens in place and has "Listo" and "Ahora no".
  - **Mis cuentas por separado:** a name and balance per account. When this block is filled, it replaces the total.
  - **Pagos fijos:** chips plus Otro. Amount and day are optional. Incomplete ones become pending tasks.
  - **Tarjetas de crédito:** name, limit, what you owe, payment day, currency.
  - **Créditos:** name, balance, monthly installment.
  - *(Later, M4)* Te deben / Tú debes. The interest rate also waits until the engine stores it.
- **Progress bar:** the top bar shows "Tu número empezará en {nivel} · {n}%". It animates on every change and flashes what was added ("+20% · Pagos fijos").

## Precision (S10-4)

`setupProgress()` in `packages/shared` is a pure function. Its inputs are cycle settings, accounts, templates, statements, recent capture methods and phone-only flags.

| Task | Weight | Done when |
|---|---|---|
| Lo básico | 20 | schedule + balance anchor (+ income unless irregular) |
| Extractos | 35 | any statement snapshot or `PDF_IMPORT` movement |
| Pagos fijos | 20 | ≥ 1 active template and no pending names, or "No tengo" |
| Tarjetas | 15 | a `CREDIT_CARD` account, or "No tengo" |
| Captura automática | 10 | an `EMAIL_IMPORT` / `NOTIFICATION` capture in the last 14 days |

**Levels:** Borrador < 40 %, Aproximado 40–79 %, Real ≥ 80 %. The amount shows "≈ " until Real.

**Hoy shows:**
- The precision chip on the Disponible block. Tapping it opens a sheet that explains what is missing.
- The "Afina tu número" card with the open tasks. Each task has its action and a "No tengo" option where it applies. The card disappears at 100 %.

## Phone-only state

These keys live in the `local_state` table. They are per user and never synced.

| Key | Holds |
|---|---|
| `onboarding.tour_seen` | whether the tour was shown |
| `onboarding.goals` | chosen goals |
| `onboarding.path` | extracto or manual |
| `onboarding.pending_bills` | names of incomplete fixed payments |
| `onboarding.no_cards` | "No tengo" answered for cards |
| `onboarding.no_bills` | "No tengo" answered for fixed payments |
| `guide.hoy_seen` | the Hoy coach mark was shown |
| `revisar.dismissed_pagos` | candidate keys answered "No" |

Moving these to a synced side table can wait until a second device matters.

## Later phases (not in the first PR)

- Section intros: welcome state, then incomplete notice, then the first-time walkthrough.
- Compartir → Zeta, which needs a native PDF intent.
- Statement forwarding by email in v2.
- The budget examples screen, which comes with the Presupuesto phase.
- The 4-tab navigation and the contextual +.
