# Zeta v2 — widget design rules (v1, 2026-09-29)

Every new or changed Inicio widget follows these rules. They came out of planning session 5 (`sessions/05-visual.html`, decisions S5-4 and S5-R) and will be tightened later with real use.

## Layout
- **Grid:** 2 columns. A widget is **half** or **full** width. No other sizes.
- **Minimum size:** each widget declares the smallest size where its information is still useful; it can't be made smaller.
- **Order and presence** are the user's ("Organizar"). The Disponible block is fixed on top and is not a widget.
- **Default layout (new user):** Tu flujo (full) · Hoy, Próximo pago, Te deben, Tarjeta Nu (half) · Últimos movimientos (full).

## Content
- **One question per widget.** No two widgets answer the same question; only the Disponible block answers "¿cómo voy?".
- **Collapsed = icon + title + one primary value or one small visual** (bar, ring, initials, mini line, split bar), plus at most a hint of 3 words. No second number.
- **Prefer a visual to text** when it says the same thing.
- **Everything else lives in the expanded view.** Half widgets expand into a full-width panel under their row (the rest of the row dims); full widgets expand in place. The expanded view ends with "Ver todo ›" for the full screen.

## Visual
- **Centered and synchronized:** icon + title, value/visual and chip are centered; in a row, values sit at the same height and chips align at the bottom.
- **Only Disponible is heavy/bold.** Widget values are semibold, 16 pt, UI font; hints are muted, 10 pt.
- **No side stripes / left accent bars. Ever.** (Owner rule.)
- **Amounts auto-fit** their space (`adjustsFontSizeToFit`, down to 62%); shorten ("$14,3 M") only when the full amount can't fit at 62%.
- Colors only from theme tokens (Oliva afinada / Nítido × light / dark); state colors only for state.

## Attention
- **States:** normal · **amber** (needs attention soon) · **red** (critical).
- Shown as a **centered chip** with a reason of ≤ 4 words ("Mañana", "Hace 34 días", "No llegas al 30"). Red also gets a thin **full outline** in the state color.
- The **most critical** widget opens automatically when the app opens, **once per day**.
- A widget's state comes from the engine (bills, verdict function, look-ahead), never computed in the widget.

## Testing (required before a widget ships)
- A dev **gallery screen** renders every widget × every allowed size × expanded view.
- Matrix: widths **360 / 390 / 430** × themes **Oliva / Nítido** × **light / dark** × text size **100% / 130%**.
- Data cases: normal, empty (first week), long values ($14.250.000), negative, amber, red.
- Pass: nothing clipped or overlapping; text contrast ≥ 4.5, borders ≥ 3; the primary value readable at a glance.
- Automated screenshots per case, re-run on every change to a widget.

## Widget catalog (v1)
| Widget | Question | Sizes (min first) | Collapsed shows |
|---|---|---|---|
| Hoy | ¿Cuánto llevo hoy? | half | spent today + bar vs today's allowance |
| Próximo pago | ¿Qué tengo que pagar y cuándo? | half, full | next amount + name/date; full adds next 3 dates |
| Te deben | ¿Quién me debe y a quién le debo? | half | total + initials |
| Tarjeta Nu (per card) | ¿Cuánto va mi próxima factura? | half, full | estimated bill + credit-used bar |
| Deudas | ¿Cuánto debo y cuándo termino? | half, full | ring (% paid) + total |
| Límites | ¿Voy bien en lo que quise controlar? | half, full | three bars |
| Mis cuentas | ¿Cuánta plata tengo y dónde? | half | total |
| Tu flujo | ¿Me alcanza hasta el próximo sueldo? | half, full | line + one sentence |
| ¿En qué se me fue? | ¿En qué gasto este ciclo? | half, full | split bar |
| Últimos movimientos | ¿Qué pasó recién? | full | 3 rows |
| Tus comercios | ¿Dónde gasto más seguido? | half, full | top merchant |
| Dólar hoy (only with USD debt) | ¿A cuánto está el dólar? | half | rate + daily change |
| Viaje (v1.1) | ¿Cómo va el viaje? | half | ring (% set aside) + place |
