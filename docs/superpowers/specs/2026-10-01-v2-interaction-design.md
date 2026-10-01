# Zeta v2 — interaction design (navigation, movements, destinatarios, accounts, Anotar, Ajustes)

**Date:** 2026-10-01 · **Status:** approved by the owner (2026-10-01) · **Decisions:** S8-1 … S8-9 in `docs/mlp/12-decision-log.md`
**Mockups (source of truth for layout):** `claude-ai-design/v2-movimientos-acciones/` — `mapa.html`, `opciones.html` (Detalle A), `destinatarios.html`, `cuentas.html`, `anotar.html`, `ajustes.html`, `botones.html`.

## 1. Why this spec

Screens were being designed one at a time without mapping how you reach them. The interaction map (`mapa.html`) found the gaps: no way to see or create accounts, no list of destinatarios (and people never designed as destinatarios), no v2 screen to write a movement down, no Ajustes, and a tab bar the plan and the design disagreed on. This spec fixes the whole interaction before more code: what each screen is for, how you get there, what it does, the shared components, the engine commands behind each action, and in which milestone each piece lands.

**Success:** every v2 use case has a screen and at least two ways in (one from a place visited daily); the common case of each flow takes 1–2 taps; no screen shows an action that doesn't work yet unless it's clearly marked "Pronto".

## 2. Navigation (S8-1)

- **Bar:** Inicio · Movimientos · **(+)** · Pagos · Revisar. The "+" is the only FAB (58, black) and opens **Anotar**. Revisar shows a counter.
- **Ajustes** from the avatar on Inicio.
- Secondary screens (Mis cuentas, Cuenta, Hoja de destinatario, Destinatarios, Tu flujo, Ajustes children) open **inside the tab you came from**; the bar stays visible and back returns you.
- The Inicio mic leads to Anotar › Dictar (no separate voice entry).

| Screen | Ways in |
|---|---|
| Movimientos | Tab · Últimos widget · Gastado (hero detail) · Cuenta › Ver movimientos · Hoja de destinatario › Ver los N |
| Detalle | Row › ⋯ · Revisar card · push / `?id=` |
| Hoja de destinatario | Tap the destinatario in Detalle · Ajustes › Destinatarios · Te deben › persona · Revisar |
| Destinatarios (list) | Ajustes › Destinatarios · "Ver todos" in the picker |
| Mis cuentas | Mis cuentas widget · Ajustes › Mis cuentas · hero detail ("¿De dónde sale?") |
| Cuenta | Mis cuentas › row · Detalle (tap the account) |
| Anotar | The "+" · Inicio mic (Dictar) |
| Ajustes | Avatar |

## 3. Movements (S8-3)

**Row (closed):** destinatario avatar (shape by kind, §5), name, amount (tone per Z Cuentas: spending `bad.text`, money in `ok.text`, card/neutral `muted`), then category chip (M3) or a status chip ("Ignorado", "No cuenta"), time and account tags. No source line.

**Row (open, tap):** one open at a time; the rest of the list dims (`Dim`). Shows **Categoría · Destinatario · ⋯**: each shows its current value ("Domicilios", "Rappi") or "Elegir". ⋯ opens Detalle. Height animates with `Collapse`; reduced motion respected.

**Detalle (design A "Lista"), top to bottom:**
1. Facts: amount, destinatario, a line with the **source as an icon** + word (✉ Correo · hoy 12:41 · Banc ··4821), the bank text when there is one, a status pill when it doesn't count ("No cuenta · va a la factura").
2. One list: **Categoría ›**, **Destinatario ›**, **Qué fue ›** (Gasto default), **Nota ›**; **Cuotas ›** only on card purchases.
3. "No es un movimiento" (text button): deletes a manual entry, ignores a bank one; both with Deshacer (5 s).
4. **Listo** (primary).
- Amount, date and account are editable **only on manual entries** (tap the amount or the facts line); bank movements follow the capture tier (S1-2).
- The "Cuenta para Disponible" toggle **leaves Detalle** (S8-4); it lives in Mis cuentas / Cuenta.

**Qué fue** (one picker, options by direction): spending → Gasto · Fue compartido · Le prestaste · Pago fijo (of this destinatario) · A mi cuenta. Money in → Ingreso · Reembolso · Me pagaron · De mi cuenta. Choosing compartido / préstamo / me pagaron asks *with whom* (person picker) when the destinatario isn't already a person.

## 4. Movimientos screen

Already built in PR #445 (cycle navigator, filters Todos/Gastos/Entradas/Tarjetas, search, by day). Adds: the **filter chip** for an account or a destinatario (removable, e.g. "Bancolombia ✕", "Rappi ✕"), the open-row behavior, Detalle A.

## 5. Destinatarios (S8-2, S8-6, S8-9)

One system for **comercio** and **persona** (`destinatarios.kind`), no new tables.

- **Avatar:** comercio = squircle + store glyph, one initial; persona = outlined circle + person glyph, two initials. Never color (color = state).
- **Picker "¿Quién es?":** shows the bank text, search, tabs **Comercios · Personas** (preselected by the movement: transfer → Personas, card purchase → Comercios), Zeta's match first ("Coincide"), recent ones, "+ Nuevo/a «…»" prefilled and **created with the open tab's kind**. After choosing, one question turns the bank text into a pattern: "¿Las «NEQUI A LAURA G» son siempre Laura?" → Sí, siempre (also the past ones) / Solo esta.
- **Hoja de destinatario:** facts (this cycle, per cycle with a bar per held cycle) → for a persona, the **balance block** (Te debe / Le debes / A paz y salvo, Registrar pago, Recordarle) → Categoría + policy → **Pagos fijos (N)** with + Agregar → **Lo reconozco por** (rules with match counts, + Agregar) → movements (Ver los N → Movimientos filtered) → text buttons Renombrar · Unir · "Es una persona/un comercio".
- **Policy:** comercio → Siempre once a category is chosen; persona → Pregúntame. Optional category for people.
- **Pagos fijos:** a destinatario owns several (Google Play: YouTube, Google One, a game). A charge links by destinatario + amount (± tolerance) + day; ambiguity → Revisar; Qué fue › Pago fijo offers only that destinatario's.
- **List (Ajustes › Destinatarios):** same tabs, count per tab, open balance on people.

## 6. Accounts (S8-4, S8-5)

- **Mis cuentas:** "Cuentan para tu Disponible" total (+ Aparte, Debes); **Cuentas** with a switch per row; **Tarjetas y créditos** (debt + bill/cuota) opening the same screen as Pagos; "+ Agregar" → Cuenta · Efectivo · Tarjeta de crédito · Crédito o préstamo · Desde un extracto.
- **Every switch asks first and explains the effect.**
- **Cuenta:** balance and its origin, an **alert when the bank hasn't confirmed the balance in a long time** (→ Cuadrar), "Cuenta para mi Disponible", "Cuadrar con mi saldo real" (D14), latest movements + "Ver los N" (Movimientos filtered), "Editar cuenta" (text), archive (destructive).

## 7. Anotar (S8-9)

Sheet from the "+". Kinds on top: **Gasto · Ingreso · Entre cuentas**.
- Amount first (pad from onboarding); live effect line ("Te quedan $376.100 hasta el 30 · $31.300 al día" / "Tu Disponible sube a …" / for Entre cuentas the consequence of the destination account counting or not).
- Gasto: recent destinatarios (M3) · En qué · Categoría (M3) · Cuenta (prefilled) · Fecha (Hoy). Ingreso: kind row **Ingreso extra · Me pagaron · Mi sueldo** (equal three-column row). Entre cuentas: De → A with balances.
- Mic on the pad → Dictar (M6).
- Guardar closes the sheet; Disponible moves at once; toast "Anotado · … · Deshacer" (5 s). No confirmation screen.

## 8. Ajustes (S8-7)

Profile → **Tu número** (Cuándo me pagan, Ahorro, Mis cuentas) → **Lo que Zeta sabe** (Destinatarios, Categorías) → **Captura** (Fuentes, containing Plantillas, Ignorados, Extractos) → **La app** (Apariencia, Avisos, Bloqueo, Privacidad) → Ayuda y reportar → **Cerrar sesión (destructive)**. Each row shows its state; a failing source says so in words. Cuándo me pagan / Ahorro show the effect before saving. "Tu plan" hidden until v1.1.

## 9. Shared components (`mobile/v2/components`)

| Component | Notes |
|---|---|
| `Button` | variants primary · secondary · text · destructive (outline; `destructiveConfirm` fill only in confirmations); sizes L 50 / M 44 / S 32 (+hitSlop); pressed, disabled (own colors), loading (spinner, same size). S8-8. |
| `Chip`, `Segmented`, `IconButton` | selectors and navigation per `botones.html`. |
| `TabBar` + FAB | the 4 tabs + "+", counter on Revisar. |
| `Sheet` | exists (#445): scrim fades in place, sheet slides. |
| `Collapse`, `Dim` | exist. |
| `Avatar` | `kind` (comercio / persona / none), size, initials, glyph. |
| `Toast` | "… · Deshacer" for 5 s (D15). |
| `ConfirmSheet` | title, consequence text, destructive or primary confirm — every switch and every destructive action uses it. |

## 10. Engine commands (all with contract tests on both adapters)

| Command | Use | Milestone |
|---|---|---|
| `setTransactionNote`, `setTransactionExcluded` | Nota, No es un movimiento (bank) | built |
| `setAccountCountsInDisponible`, `setCycleSettings` | Mis cuentas switch, Cuándo me pagan / Ahorro | built |
| `captureManualTransaction` | Anotar Gasto / Ingreso | built (UI M1) |
| `deleteTransaction` | No es un movimiento (manual) + Deshacer | M1 |
| `editTransaction` | amount / date / account of a manual entry | M1 |
| `createAccount`, `editAccount`, `archiveAccount` | Mis cuentas › Agregar, Editar, Archivar | M1 (see §12) |
| `adjustBalance` (cuadrar) | Cuenta › Cuadrar | M2 (plan) |
| `captureTransfer` | Anotar › Entre cuentas | M2 |
| `setCategory` (this / destinatario / + past) | Categoría | M3 |
| `setDestinatario`, `createDestinatario`, `renameDestinatario`, `mergeDestinatarios`, `setDestinatarioPolicy`, `setDestinatarioKind`, `addDestinatarioRule`, `removeDestinatarioRule` | §5 (replace the plan's merchant-only commands) | M3 |
| `setMovementKind` (Qué fue), split / loan / repayment commands, link to pago fijo | §3 Qué fue | M4 |

## 11. By milestone

- **M1 (finish "the number"):** tab bar + FAB; Anotar Gasto/Ingreso (plain "En qué", account, date, effect line, Deshacer); Movimientos open row with **only ⋯ active** and Detalle A without Categoría/Destinatario rows (they appear in M3 in their slot — no greyed-out placeholders); `deleteTransaction`, `editTransaction`; Mis cuentas + Cuenta (switch with ConfirmSheet, Agregar, Editar, Archivar); Ajustes shell with Tu número + La app (Apariencia, Bloqueo) + Cerrar sesión; `Button`/`Chip`/`Segmented`/`IconButton`/`Avatar`/`Toast`/`ConfirmSheet`; past cycles (already planned).
- **M2:** Entre cuentas; Cuadrar; Fuentes (with Plantillas/Ignorados/Extractos); account names/balances from sync.
- **M3:** Categoría (row + open row + Anotar), destinatarios (picker, sheet, list, avatars by kind, recent in Anotar), Categorías in Ajustes.
- **M4:** Qué fue, persona balance block, pagos fijos list on the sheet, Pagos tab content.
- **M6:** Dictar. **M7:** Avisos, Privacidad.

## 12. Owner decisions on this spec (S8-10)

1. **Accounts in M1:** phone schema v5 adds `name`, `mask` and `institution_name` to the phone's `accounts` (same columns as the Postgres view); `createAccount` / `editAccount` / `archiveAccount` run on the phone in M1; M2 sync merges by id.
2. **Open row in M1 with only ⋯**, and Detalle A without the Categoría / Destinatario rows; they appear in their slot in M3. No greyed-out placeholders.
3. **Order of work:** update #445 → shared components → tab bar + FAB + Anotar → accounts → Ajustes shell. One PR each.

## 13. Out of scope

Pagos, Te deben, Límites, Revisar contents (their own milestones); Claude Design redraws (the mockups are the reference until then); web app.
