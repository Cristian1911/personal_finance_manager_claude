# Living Timeline — Claude Design → Zeta implementation notes

Source: Claude Design project "Zeta living timeline redesign" (`7d58f4c9-7c25-482c-a182-4813304928a0`), files `Zeta Living Timeline.dc.html` (canvas) → `BudgetBoard.dc.html` + `IncomeCard.dc.html` + `ExpenseCard.dc.html`. Pull fresh anytime via `DesignSync get_file`.

This is the **visual source of truth** for the build. Translate it into Zeta's real token system + React — do NOT copy raw hex or the Geist font.

## Design hex → Zeta token map

| Design hex | Role | Zeta token |
|---|---|---|
| `#d9b681` | brass (Puedo gastar, primary CTA, HOY pill, brand Z) | `z-brass` / `BRASS_BUTTON_CLASS` |
| `#5CB88A` | green (confirmado/pagado, saldo dot) | `z-income` |
| `#E0976A` | amber (comprometido, committed bar) | `text-amber-400` (or propose `z-committed` token) |
| `#c98b8b` | red (atrasado, source-risk) | `z-expense` |
| `#F6F0E3` | primary ink | `foreground` / `z-ink` |
| `#D9CCB9` | secondary text | `z-ink/80` (closest existing) |
| `#938C7E` | muted | `text-muted-foreground` |
| `#121412` | board bg | `bg-card` / surface |
| `#1b1f1b` | sheet/elevated surface | `bg-popover`/elevated card |
| `rgba(255,255,255,0.06)` | hairline border | `border-white/6` |

Propose `z-committed` (amber) to `docs/design-system/TOKENS.md` before using a raw amber if `text-amber-400` reads wrong against brass.

## Layout (matches plan Task 11)

- **Header strip**: brand Z + "Periodo / plan vivo" + period selector pill ("Junio 2026 ▾").
- **Hero card** (radial+linear gradient): left = segmented toggle `Puedo gastar | Comprometido`, big 47px number (brass; red `#c98b8b` when puedoGastar<0), secondary line (the other number), split bar (libre brass / comprometido amber, inactive side dims to 0.4 opacity), `Libre … / Comprometido …` legend. Right = two stat tiles: **Saldo actual** (green dot, "cuentas reales · vivo") + **Comprometido** ("N gastos por pagar"). Hero swap animation `heroSwap 300ms`.
- **Mobile only**: `Ingresos | Gastos` segmented tabs (net-new), and a bottom tab bar (Inicio/Periodo/Cuentas/Más) — but in Zeta this is the existing app shell, so DON'T re-render a tab bar; just the in-board Ingresos/Gastos tabs.
- **Collapsed settled groups** (both columns): dashed bordered button, green check chip, `"N confirmados · $X"` / `"N pagados · $X"`, "Confirmados · ya en el saldo" / "Pagados · ya descontados", `mostrar ▾` / `ocultar ▴` chevron. Collapsed by default.
- **HOY divider**: hairline — pill — hairline. Pill: brass dot + `Hoy · 25 jun` + `quedan N días`.
- **Actionable columns** (2-col desktop `flex 1 1 360px`, single column per active tab on mobile): section eyebrow + meta (`$X recibido · $Y por confirmar`), an **atrasado banner** (red, AlertTriangle) when any income atrasado, an **unassigned banner** (brass, Info) when any expense sin asignar, then the cards.

## IncomeCard
- Icon tile (state-tinted), label + amount, **state pill** (Confirmado green / Atrasado red / Esperado muted) + date label (`recibido 15 jun` / `venció 20 jun · hace 5 días` / `llega 28 jun`).
- If committed>0: a thin amber committed bar + `Comprometido … / Libre …`.
- If not confirmado: **Confirmar recibido** brass button → **opens the confirm sheet** (pure-C; drop the design's quick-confirm + "ajustar" link).
- If confirmado: account line (`Bancolombia`). Atrasado card: red-tinted bg/border.

## ExpenseCard
- Icon tile, label + amount, **state pill** (Pagado green / Pendiente amber) + date (`pagado 5 jun` / `vence 26 jun`).
- Assigned → reassign chip (`source · date`, dot colored by source state) ; unassigned → **Asignar ingreso** brass-outline CTA.
- **Source-risk flag** (red, AlertTriangle): "Depende de un ingreso atrasado" when assigned income is atrasado → this is where the **cuenta-ahora** reason surfaces.
- Pending → **Marcar pagado** ghost button → opens PayExpenseDialog.

## Bottom sheet (one component, two modes)
- Desktop: centered modal (radius 18, max-w 440); mobile: bottom sheet (radius 20 20 0 0, `sheetUp` anim). Maps to Zeta Sheet/Drawer with `MOBILE_SHEET_SAFE_AREA_CLASS`, z `--z-layer-modal`.
- **Confirm mode**: "$ amount" input (prefilled, editable) → account chips → brass **Confirmar $X** → divider "o vincula un movimiento" → candidate movement buttons (link). = `ConfirmIncomeDialog` (plan Task 7).
- **Assign mode**: list of income options (dot by state, `free` amount) → pick. = existing `AssignmentDialog`.

## Flujo del mes chart (PlanFlowChart) — placement decision (2026-06-25)
The Claude Design dropped the flow chart; user loves it. Decision: **keep it, collapsible directly under the hero.** Collapsed by default on mobile (`Ver flujo del mes ▾`), expanded by default on desktop. Extract its **danger-zone banner** ("Saldo negativo proyectado del N al M") so it stays visible even when the chart is collapsed. **Drop** the chart's Ingresos/Gastos/Neto footer totals — the hero now covers them.

## ⚠️ Divergences from the design (deliberate — honor the spec, not the mockup)
1. **Time-aware Comprometido** — the design computes `comprometido = all assigned pending`; we keep the spec §4 classifier: hero "Comprometido" number = `comprometido_ahora`; add a secondary **"+ $X cubierto por próximo ingreso"** line. `puedoGastar = saldoActual − comprometido_ahora`. The per-card "source-risk" red flag is the cuenta-ahora reason made visible.
2. **Pure-C confirm** — "Confirmar recibido" always opens the sheet; no quick-confirm path.
3. **Saldo actual** — design uses `confirmedTotal − paidTotal`; we read the **live real accounts balance** (`accounts.current_balance`), per spec. (Equivalent when everything flows through the plan, but the real balance is ground truth.)
