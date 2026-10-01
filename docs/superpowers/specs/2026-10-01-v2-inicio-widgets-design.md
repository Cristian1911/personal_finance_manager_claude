# v2 Inicio — first 6 widgets + alerts (M1) — design

Date: 2026-10-01 · Branch: `feat/v2-inicio-widgets` · Milestone: M1 "The number" (`docs/mlp/10-build-plan.md` §10)
Rules: `docs/mlp/13-widget-design-rules.md` (S5-4, S5-R). Visual source: `design/zeta-v2/Z Widget.dc.html`, `Z Inicio.dc.html`.

Written by Claude while the owner was away; every ruling below is one line so the owner can overrule it.

## What ships

The default layout for a new user (`13` §Layout), under the Disponible block and "Así sale tu número":

| Row | Widget | Size | Data on the phone today |
|---|---|---|---|
| 1 | Tu flujo | full | live: cycle, Disponible, spending pace |
| 2 | Hoy · Próximo pago | half · half | Hoy live; Próximo pago from `obligations` (none on the phone yet → empty) |
| 3 | Te deben · Tarjeta | half · half | Te deben from a people list (none yet → empty); Tarjeta one per card with data (none yet → not shown) |
| 4 | Últimos movimientos | full | live: last captured movements |

Plus the **alerts**: amber/red chip per widget, red adds a thin full outline, and the most critical widget opens by itself once per day.

## Rulings

- **W1 — Honest empty, no fake numbers.** The phone's v2 database has accounts, transactions and cycle settings only; bills (M2 sync / M4), people (M4) and card statements (M2) aren't there yet. Próximo pago and Te deben render their "empty" case; their view functions already take the real inputs (`obligations`, people) so they light up when the data lands, and every data case is covered by tests and the gallery. *Alternative considered:* ship only the 3 live widgets — rejected because the grid, sizes and alerts would then be untested with half-width pairs.
- **W2 — Tarjeta is per card.** No credit-card data → no Tarjeta widget (a user without cards never sees one). Te deben then sits alone in its row at half width.
- **W3 — All widget state comes from `@zeta/shared`** (`buildInicioWidgets`), never from the component (`13` §Attention). Components only draw view models: strings, a 0–100 visual value and an attention level.
- **W4 — Hoy shows what's left today** (the design's value: "$22.000", "−$6.000"), the bar shows the share spent. `13`'s catalog says "spent today"; the screens (Claude Design) win per CLAUDE.md. Today's allowance = (Disponible + spent today) ÷ days left including today, rounded down to $100 — the per-day number as it stood this morning. Amber "Casi al tope" at ≥ 85% spent (same threshold as the verdict), red "Te pasaste hoy" above 100%.
- **W5 — Próximo pago attention:** amber when the next bill is due within `BILL_RISK_DAYS` (3) with the reason "Hoy"/"Mañana"/"En N días"; red "No alcanza" when `findBillAtRisk` says the counted balances won't cover it.
- **W6 — Te deben attention:** amber "Hace N días" when the oldest debt is ≥ 30 days old, red at ≥ 60.
- **W7 — Tu flujo mini is a pace projection,** not the real Tu flujo: end of cycle = Disponible − (spent so far ÷ days elapsed) × days left. Red "No llegas al N" with "A tu ritmo te quedas sin plata el X · gasta ≈ $Y menos al día." when the projection goes below 0; otherwise one sentence "A tu ritmo terminas con $X". The line is the day-by-day Disponible (actual to today, projected after). Ceiling marked with `ponytail:`; the real projection (bills on their dates, next-cycle amber) is the Tu flujo PR.
- **W8 — Últimos movimientos** shows the last 3 (expanded: 5) by capture time: description, "hoy/ayer/30 sep · 8:10", signed amount. No category or account name yet (not in the phone's schema). `readInicioData` now also reads `clean_description`.
- **W9 — Expand:** one widget open at a time. Half → a full-width panel under its row, the rest of the row dims to 38%; full → in place. "Ver todo ›" only when the screen exists (none in this PR: Movimientos and Pagos are later M1/M4 PRs).
- **W10 — Auto-open once a day:** most critical = red before amber, ties by layout order. Remembered in `local_state` (`inicio.auto_open_day`), the UI-memory table `load.ts` already writes raw.
- **W11 — Out of scope:** "Organizar" (order, presence, sizes) — the layout is the fixed default until that PR; the other 7 catalog widgets (M4+).

## Shape

- `packages/shared/src/engine/disponible/widgets.ts` — view types (`InicioWidget` union by `key`), `buildInicioWidgets(input)`, `pickAutoOpen(widgets, lastDay, today)`, thresholds as exported constants. Pure; tested per data case: normal, empty, long ($14.250.000), negative, amber, red.
- `buildInicio` returns `widgets` with the ready state; `StoredTransaction` gains `description`.
- `mobile/v2/components/widgets/` — `WidgetCard` (collapsed), `WidgetPanel` (expanded), visuals (bar, initials, mini line), `InicioWidgetGrid` (rows, expand, dim, auto-open). `FittedAmount` moves to its own file and is shared with the Disponible block.
- Gallery: every widget × allowed size × collapsed/expanded × data cases, built by the real `@zeta/shared` functions.

## Owner device check

1. Inicio after the three questions: Tu flujo, Hoy, Próximo pago (empty), Te deben (empty), Últimos movimientos (empty) under the number.
2. `/v2-debug` → Crear cuenta de prueba → Anotar gasto de 25.000 → Inicio v2: Hoy's bar moves and its value drops by $25.000; the expense is the first row of Últimos movimientos; Tu flujo's sentence changes.
3. Tap Hoy: a full-width panel opens under its row, Próximo pago dims; tap again closes.
4. Gallery `/v2-gallery`: amber and red chips, red outline, every widget at 360/390/430.
