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

## Revision 2 — owner review (2026-10-01)

The owner reviewed the first build on device. Changes, all built:

- **R1 — Inicio matches Claude Design** (`Z Inicio`, `Z Disponible`, `Z Widget`, `Z Grafico`). These are the target, over the older 16pt/10pt sizes in `13`.
  - Header: "Hola, nombre" + date, Organizar and voice.
  - Hero: "$X al día" and "+$X cuando te paguen" on one line.
  - Widgets: 24pt values, a 3-row layout, an ink outline when open, a panel with close, totals in 3 columns, "Ver todo".
- **R2 — "Así sale tu número" is the hero's expanded view.** The design was picked from mockups (`claude-ai-design/v2-hero-detalle/`): C + D.
  - "De tus $X de este ciclo", then one bar, then rows that open (Por pagar · Ahorro · Gastado), then "Te queda" in green.
  - The open row glows, and only its part of the bar stays lit while the rest dims.
  - Por pagar shows the 3 nearest pending bills; paid ones in that span are struck through.
- **R3 — "+$X cuando te paguen" is the next salary.** It no longer means Te deben, which has its own widget. It is hidden for irregular income.
- **R4 — Tu flujo's widget is the full mini chart** (`flowChart`):
  - the counted balance per day, over the cycle plus 2 shaded days on each side;
  - money in and out up to today, then the projection: expected salary, unpaid bills on their dates, and spending at this cycle's pace;
  - the lowest point, or where the money runs out, in red.
  - The run-out day now comes from that balance line, with bills on their dates. It replaces the flat pace.
- **R5 — Empty widgets offer actions; Tarjeta is never hidden.** This replaces W2.
  - Without data, a widget shows its first action as a chip, and its expanded view lists all actions (Agregar pago fijo, Importar extracto, Dividir una compra, Agregar tarjeta, Anotar un gasto).
  - Actions and "Ver todo" open the v1 screens until the v2 ones exist.
- **R6 — Organizar is built.** This replaces W11 for the six widgets:
  - drag to move, a size chip (allowed sizes per widget), remove, and an "Agregar widget" sheet (the other 7 catalog widgets listed as "Pronto");
  - saved in `local_state` (`inicio.layout`);
  - the voice button says "Pronto" until M6.
