# Follow-up prompt for Claude Design (paste into the same project)

> Adds what was decided after the first prompt. Still no app name or internal vocabulary.

---

Great start. Keep the direction you chose and everything already designed; change only what's listed here. Show new and changed screens only, with the same persona and data (Laura).

## 1. Categories: a short default list, taught per merchant
The app ships with **25 default categories** (the user can add their own). Use exactly these, grouped:
- **Comida:** Mercado · Restaurantes y café · Domicilios
- **Transporte:** Apps y taxis · Transporte público · Carro y moto
- **Hogar:** Vivienda · Servicios · Casa y mantenimiento
- **Salud** · **Mascotas** · **Suscripciones** · **Compras**
- **Ocio:** Entretenimiento y hobbies · Viajes
- **Personas:** Regalos · **Personal:** Cuidado personal y deporte · **Educación**
- **Finanzas:** Pago de tarjeta o crédito · Intereses, comisiones e impuestos · Préstamos entre personas · Ahorro e inversión
- **Ingresos:** Salario · Otros ingresos
- **Otros:** Efectivo y otros

Rules to make visible:
- The unit of teaching is the **comercio** (merchant), not each transaction: one answer applies to all past and future transactions from it. People are **personas** and live in Te deben; they're never categorized in these flows.
- Suggestions always come as **3 chips** (most likely first) plus "Otra…". A chip is **pre-selected** only when the app is very sure; otherwise none is. Design the three chip states: suggested, pre-selected, selected.
- Most merchants have one usual category, but some have exceptions (Laura's Rappi is usually Domicilios, sometimes food for her dog or medicine).

## 2. Revisar: update the categorize card
- After choosing a category for a merchant: **"¿Siempre es así con Rappi?"** with three answers:
  - **Siempre:** apply it, never ask again.
  - **Casi siempre:** apply it, but ask when something is unusual (optional line: "Pregúntame si pasa de $80.000").
  - **Depende, pregúntame:** always ask, showing Rappi's usual categories as the chips.
- For a merchant set to "Casi siempre", show the card that appears for an unusual transaction: "Rappi −$96.000 · ¿Domicilios o algo distinto esta vez?" with chips Domicilios / Mascotas / Salud.

## 3. New: "Ordenar en 1 minuto" (the playful way to teach)
A 10-card session, reachable from Revisar and from the weekly digest.
- One **merchant card** in the centre: "Rappi · 14 movimientos · $610.000" (the bank's raw text in small type underneath).
- **4 drop zones** around it: the 3 suggested categories + "Otra…". Drag the card or tap a zone.
- On drop: haptic tick, the card flies into the zone and shows the consequence, "14 movimientos → Domicilios". Undo toast.
- Progress "8 de 10", skip button, end screen: "Listo. Ahora reconozco 12 comercios más."
- Design the dragging state, hover-over-zone state, drop confirmation and the end screen. Must work one-handed on a small phone.

## 4. New: "Lo que Zeta sabe" (Ajustes › Categorías)
- Header: "Reconozco 48 comercios · 92% de tus movimientos se clasifican solos."
- Categories grouped as above; each lists the merchants that feed it ("Domicilios: Rappi, iFood, JYD Hermanos"). Long-press a merchant to drag it to another category (same drop interaction).
- A "Para revisar" section: merchants with mixed history or a recent correction.
- **Merchant detail sheet:** name (editable), how the bank writes it (the patterns it recognizes), usual category, policy (Siempre / Casi siempre / Pregúntame), "Unir con otro comercio" (e.g. `DLO*GOOGLE YouTube` and `GOOGLE *PLAY YOUTUBE`), "Aplicar a movimientos anteriores".

## 5. New: add an expense by voice or text
Mic button + text field in the "+ gasto" flow. Laura says *"almuerzo con Juan, 45 mil, pagué yo y me debe la mitad"* and gets a pre-filled row: Almuerzo · −$45.000 · Restaurantes y café · "Tu parte $22.500" · "Juan te debe $22.500", confirmed with one tap. States: listening, understood (pre-filled), "No entendí el monto" (asks only for the missing field).

## 6. Refinements to existing screens
- **Inicio / "¿Cómo se calcula?":** add a compact **"Mis cuentas"** list (balance per account, updated time) inside the breakdown sheet. Not a tab.
- **"Ya salió" line → "¿En qué se me fue?":** a simple list by category for the cycle (amount + share), sorted by amount. No chart.
- **Detail sheet, category row:** opens the grouped 25-category picker with the 3 suggested chips on top.
- **Te deben:** keep it. Make sure lending is tracked as its own thing ("Préstamos entre personas"), never counted as spending, and the "¿Deberías parar de prestar?" warning is visible.

## 7. Mini design system additions
Draggable merchant card, drop zone (idle / hover / accepted), chip states (suggested / pre-selected / selected), the "Siempre / Casi siempre / Pregúntame" segmented control, and the merchant detail sheet.
