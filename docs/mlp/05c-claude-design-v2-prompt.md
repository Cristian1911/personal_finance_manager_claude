# Prompt for Claude Design — full screen set v2 (paste into the same project)

> Third round. Replaces the visual direction of the first two rounds with the one chosen in planning. Self-contained on purpose. The product name is **Zeta** ("Alcanza" was a working name; never use it).

---

Thank you for the first two rounds. We've finished planning and made decisions that change the look and some screens. Please redraw the **full screen set** with the direction and rules below. Keep the persona (Laura) and Colombian Spanish (tú), money as `$1.250.000` (no decimals, no "COP").

## 1. Visual direction: "Oliva afinada" (default) + "Nítido" (optional theme)

We keep Oliva's warm identity but fix what made it flat: the text contrast was fine, the **shapes** weren't (cards melted into the background, chip borders were too faint to look tappable, and "Vas bien" was a tint so pale it looked like an ordinary card).

**Oliva afinada — light:** background `#E9E0CC`, cards `#FFFCF5` with a soft shadow (`0 1px 2px rgba(40,30,10,.10), 0 4px 12px rgba(40,30,10,.06)`), ink `#14160F`, secondary `#4B463B`, dividers `#E6DDC9`, **control borders `#8C7F63` (≥ 3:1)**, sunk `#EFE7D6`, buttons `#14160F` on `#FFFCF5`.
States (tint / text / solid): ok `#CFE0A6 / #2E4A12 / #4E7A1E`, warn `#F6D98C / #5C3F00 / #B27800`, bad `#F4BFA8 / #7A2410 / #C4452A`.
**Oliva afinada — dark:** background `#12130E`, cards `#1F2119`, ink `#F3EFE3`, secondary `#B8B09C`, dividers `#2E3027`, control borders `#858270`, sunk `#2A2C22`, buttons `#F3EFE3` on `#12130E`. States: ok `#2A3A14 / #CFE39A / #8DB84A`, warn `#3D2F0A / #F2CE74 / #E0A626`, bad `#43190F / #F4A58C / #E0664A`.

**Nítido — light:** background `#EEF0F3`, cards `#FFFFFF` + soft shadow, ink `#0E1116`, secondary `#475061`, control borders `#7A8394`, sunk `#EEF0F3`. The Disponible block is filled **solid** with the state color: ok `#16804A` (white text), warn `#F2A900` (text `#1A1300`), bad `#D1382A` (white text); soft tints for chips `#DDF3E6 / #FFF0C2 / #FCE0DB`. Numbers in **Bricolage Grotesque**.
**Nítido — dark:** background `#0B0D10`, cards `#171B21`, ink `#F4F6F8`, secondary `#A7AFBC`, control borders `#6B7383`; solids ok `#2BB36A`, warn `#FFC23D`, bad `#FF6A55` (dark text on them).

Type: **Geist** (UI) and **Geist Mono** (raw bank text, small eyebrows). Show every key screen in Oliva light and dark; show Nítido light and dark for Inicio, Revisar and Pagos.

## 2. Rules that apply everywhere
- **Black = you can tap it; color = how you're doing; gray = data.** Buttons are black rectangles; verdicts are round pills with a dot.
- **Never use a colored side stripe or left accent bar** on cards, rows or callouts. Show state with a chip, a full outline or a tint.
- **Only the Disponible number is heavy and bold.** Every other number is semibold and smaller, so nothing competes with it.
- **One number, one verdict:** only Vas bien / Cuidado / Te pasaste, from the same thresholds everywhere.
- **Every row opens the same bottom-sheet detail.** No swipes, no edit modes.

## 3. Inicio: the Disponible block + a widget grid the user organizes
- The Disponible block is fixed on top: verdict pill, "Te pagan en N días", big number, per day, "+$X cuando te paguen".
- Below it, a **2-column grid**. Each widget is **half or full width** (never smaller than its minimum). Rules for every widget:
  - Collapsed: **icon + title + one primary value or one small visual** (bar, ring, initials, mini line, split bar), at most a 3-word hint. No second number.
  - Content **centered** and **synchronized**: in a row, values at the same height, chips aligned at the bottom.
  - Tapping a half widget opens a **full-width panel under its row** (the rest of the row dims); a full widget **expands in place**. The panel ends with "Ver todo ›".
  - **Alerts:** amber (soon) or red (critical) as a centered chip with ≤ 4 words ("Mañana", "Hace 34 días", "No llegas al 30"); red also gets a thin full outline. The most critical widget opens by itself when the app opens.
  - Amounts shrink to fit on small phones instead of clipping.
- **Widgets:** Hoy · Próximo pago · Te deben · Tarjeta (per card) · Deudas · Límites · Mis cuentas · Tu flujo · ¿En qué se me fue? · Últimos movimientos · Tus comercios · Dólar hoy (only with USD debt) · Viaje (later).
- **"Organizar" mode:** change size (half/full), reorder, remove, add from a list showing each widget's question.
- Default layout: Tu flujo (full) · Hoy, Próximo pago, Te deben, Tarjeta Nu (half) · Últimos movimientos (full).
- Design each widget at half and full (where allowed), collapsed and expanded, normal / amber / red, at 360, 390 and 430 px wide.

## 4. Tu flujo (a chart you can touch)
Evolve this from the flow chart in the current app: a balance line above $0, daily bars around the $0 line.
- **One pay cycle at a time** (Pasado / Este ciclo / Próximo, and swipe), with **2 shaded days on each edge** so you see how cycles connect (e.g. the next salary arriving).
- Line solid until "Hoy", dashed after (projected). Bars up = money in; bars down = money out: solid = done, **outlined = bill still to pay**, light gray = estimated daily spending. The lowest point ahead is marked. Card cut dates marked with a small diamond.
- **Drag** across the chart to read the balance on any day (date + amount above the chart). **Tap** a day to list its items below.
- Totals under the chart: Llega · Sale · Terminas con.
- States to design: normal; **running out this cycle** (line and area under $0 in red; "A tu ritmo te quedas sin plata el 22 sep · gasta ≈ $28.000 menos al día"); **big payment next cycle** (amber card in the current cycle: "El próximo ciclo no alcanza por ≈ $433.900 (Matrícula, 9 oct) · Apartar").

## 5. Decisions that change screens
- **Credit cards:** card purchases **don't** lower Disponible; the **card bill** does, in the cycle it's due, at the **minimum payment by default** (per-card switch "Suelo pagar el total"). Show each card's growing next bill ("≈ $480.000 · al corte ≈ $620.000 si sigues a este ritmo").
- **Accounts that count:** the user chooses which accounts add up to Disponible ("Cuenta para mi Disponible" toggle); savings kept apart show as "aparte".
- **Pagos:** tabs Este ciclo · Próximo · **Deudas**. 60 days ahead; big bills up to 12 months ahead appear as **"Prepárate"** with "Aparta $120.000 por ciclo"; **partial payments** ("Pagado $600.000 de $1.100.000"); variable bills marked "≈" until the real amount arrives; loans with "Te faltan $X · termina en mar 2028"; a "Registrar pago" that shows the consequence before saving ("Cubre la cuota de octubre y deja el crédito en $0 · se cancelan las cuotas siguientes").
- **Te deben + Tú debes** in one screen (money you owe people is a pending payment).
- **Past cycles:** a cycle switcher; a closed cycle shows its result, four lines, where the money went, its movements.
- **Capture setup:** Android: pick bank apps, plus the SMS app (only allowed bank senders) and Google Wallet. iPhone: forwarding-address setup, "Conectar Gmail" (read-only), and a **guided Shortcuts setup** for Apple Pay ("Transacción") and bank SMS ("Mensaje").
- **Balance notices:** "Bancolombia dice $1.320.000, yo tengo $1.290.000 · ¿Agregar ajuste de $30.000?" as a Revisar card.
- **Onboarding:** payday → income → balance today → bills before payday → **accounts (optional)** → the number → capture setup per platform → first questions.
- **Ajustes:** Apariencia (tema Oliva / Nítido × claro / oscuro / sistema), Mis cuentas, Fuentes (health dots), Plantillas, Ignorados, Categorías ("Lo que Zeta sabe"), Privacidad ("Hoy descartamos 214 avisos…"), Avisos, **Tu plan**.

## 6. Zeta Plus (paid, comes a bit after launch)
- Free: the whole promise, 3 statement PDFs a month (unlimited the first 7 days), last 3 months of history.
- Plus: unlimited PDFs, full history, screenshots (send a bank screenshot, Zeta updates balances/movements), Viajes, Nítido theme. $12.900/mes · $99.900/año · 14 días gratis.
- Design: the **paywall** (only appears when tapping a Plus feature; honest, no countdowns), **Tu plan** in Ajustes, the "4th PDF this month" moment ("Este extracto queda guardado; se importa con Plus o el 1 de noviembre"), the screenshot flow (share → review → saved), and **Historia** (trends by category, debt shifts, income vs out; older months locked with a calm Plus note).

## 7. Sample data (Laura, updated)
Paid $2.100.000 on the 15th and 30th. Counted accounts: Bancolombia $1.320.000, Nequi $330.000, Efectivo $200.000; Ahorros Nu $2.400.000 aparte. Cycle 15–29 sep, today Thu 18 sep, 12 days left.
Llega $2.100.000 · Por pagar $1.378.900 (Arriendo $700.000 on 19 sep, Tarjeta Nu minimum $640.000 on 22 sep of $1.850.000 owed, Netflix $38.900 on 24 sep) · Ahorro $200.000 · Ya salió $100.000 → **Disponible $421.100, $35.000 al día, Vas bien**. Cuidado variant: Ya salió $250.000 → $271.100, $22.500 al día.
Te deben $380.000 (Juan $180.000 · 34 días, Caro $140.000, Ana $60.000); Tú debes $50.000 (Mateo). Deudas $14.250.000 (crédito libre inversión $11.450.000 · termina mar 2028; Nu $1.850.000; Visa $950.000). Límites: Domicilios $165.000 de $180.000 (Cuidado), Salidas $138.000 de $250.000, Compras $80.000 de $200.000. Prepárate: SOAT $1.100.000 on 15 dic.

## 8. Deliverable
All screens above in Oliva afinada light + dark, key screens also in Nítido light + dark, plus an updated mini design system: tokens (4 sets), type scale, widget anatomy (half/full, collapsed/expanded, normal/amber/red), chips, verdict pill, buttons, bottom sheet, segmented control, the Tu flujo chart states. Use 390 × 844 frames, plus 360 and 430 for Inicio.
