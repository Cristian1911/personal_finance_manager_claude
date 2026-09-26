# Prompt for Claude Design (paste as-is)

> Self-contained on purpose: no app name, no existing screens, no internal vocabulary.
> Optional second round: attach `03-experience-proposal.md` and ask for a variant that follows it.

---

Design a **native mobile app** (iPhone 15 / Pixel 8 frames, 390×844) for personal finance in Colombia. Start from zero: there's no existing brand or UI to respect. Propose **2 visual directions** (different personalities: e.g. calm and editorial vs bold and friendly), then take the stronger one through all the screens below. All UI copy in **Colombian Spanish (tú)**, money as `$1.250.000` (no decimals, no "COP").

## Who and why
Young Colombian professionals (23–35), paid monthly or on the 15th and 30th, with 1–3 banks (Bancolombia, Nu, Nequi, Davivienda) and a credit card. They feel money disappears between paydays, don't know finance jargon and won't type every purchase.

**Job to be done:** "Tell me how much I can still spend until payday without me typing anything, and never let a bill surprise me."

## The product in one sentence
One number, **Disponible**: what you can still spend until your next payday, and per day. Transactions arrive automatically from bank notifications (Android), Gmail (iPhone) or the monthly statement PDF. The user only answers quick one-tap questions.

`Disponible = lo que te llega este ciclo − pagos pendientes − ahorro − lo que ya salió`

## Rules the design must make obvious
- **One number, one verdict.** Only three states anywhere: **Vas bien** / **Cuidado** / **Te pasaste**. No scores, no percentages, no health meters.
- **Three tabs:** Inicio, Movimientos, Revisar (with badge). Everything else opens from Inicio.
- **One row grammar:** icon · title · amount on the right · one subtitle line · at most one chip. Every row, everywhere, opens the **same bottom-sheet detail**. No swipes, no edit modes.
- **Value before setup:** the user sees their own number within ~90 seconds, before any permission.
- **Paying the credit card is never spending** (the purchases already counted). Instalment purchases ("cuotas") count only this month's cuota.
- **Te deben (money lent):** when you pay for a group, only your share is spending; the rest is money friends owe you. Disponible still drops by the full amount, with "+$X cuando te paguen" shown beside it. A signal appears when lending gets too high ("¿Deberías parar de prestar?").
- **Trips:** a separate pot with its own amount and dates; spending inside it doesn't lower the monthly Disponible.
- **Category limits:** 3 by default, suggested from real spending after a few weeks, the user can add more. Limits are a lens on Disponible, never a second number.
- **Privacy is a feature:** the app only reads notifications from bank apps the user picked; everything else is discarded on the phone.
- No charts dashboard, no gamification, no AI language (smart suggestions appear as ordinary pre-selected chips).

## Screens to design
1. **Onboarding** (6–8 screens): welcome → payday and income → "¿Cuánto tienes hoy en tus cuentas?" → bills before payday (chips + amount) → **the aha screen** showing their Disponible → Android: pick bank apps + explainer before the system's scary notification-access warning → iPhone: "Conectar Gmail" (read-only, bank senders only) → first 3 quick questions.
2. **Inicio** in 3 states: Vas bien, Cuidado, Te pasaste. Show the big number, per-day amount, verdict, a 4-line breakdown of the formula (each tappable), "+$180.000 cuando te paguen", next bill, active-trip chip, "+ gasto en efectivo".
3. **"¿Cómo se calcula?"** sheet opened by tapping the number, with **"¿Algo no cuadra?" → "Cuadrar con mi saldo"**.
4. **Movimientos:** list grouped by day, search, filter chips, plus the **detail bottom sheet** (category, account, amount, date, note, actions "Fue compartido", "Es de un viaje", "Cuotas", and the raw origin text of the bank notification).
5. **Revisar:** one-card-at-a-time queue. Design these card types: categorize ("Rappi → ¿Domicilios, siempre?"), **train an unknown notification** (the user taps parts of the message text to mark amount / merchant / card, then chooses Salió / Entró / No es un movimiento), possible duplicate, "¿A cuántas cuotas?", "¿Pagas Netflix $38.900 cada mes?", "Juan te envió $80.000, ¿es lo que te debía?". Plus the empty state "Todo al día".
6. **Pagos del ciclo** (bills): this cycle vs next, card payment row explaining what it covers, cuotas grouped under the card, Pendiente / Pagado / Atrasado.
7. **Te deben:** total, per-person rows, the "¿deberías parar de prestar?" warning, person detail with [Registrar pago] [Recordarle por WhatsApp] [Perdonar deuda].
8. **Viaje:** pot, spent, left, per day left, foreign-currency rows marked "≈".
9. **Límites:** 3 rows with bar vs pro-rated line and verdict word; the suggestion card "Te sugiero 3 límites".
10. **Push notifications and weekly digest:** lock-screen mockups for "Mañana pagas Arriendo…", "Te llegó el sueldo…", Sunday digest.
11. **Agregar gasto por voz o texto:** mic button + text field; the user says "almuerzo con Juan, 45 mil, pagué yo y me debe la mitad" and gets a pre-filled row (amount, category, "tu parte $22.500", "Juan te debe $22.500") to confirm with one tap. Show listening, parsed and "no entendí el monto" states.
12. **Ajustes → Fuentes and Privacidad:** each bank source with a health dot, and "Hoy descartamos 214 avisos de otras apps sin leerlos".

## Sample data (use it, keep it consistent across screens)
Persona: **Laura, 27**, Medellín. Paid the 15th and 30th, $2.100.000 each. Bancolombia debit *4410, Nu credit card *7731.
Cycle 15–29 Sep, today Thu 18 Sep. Disponible **$412.000**, **$27.400 al día**.
Breakdown: Llega este ciclo $2.100.000 · Por pagar −$968.000 · Ahorro −$200.000 · Ya salió −$520.000.
Bills: Arriendo $1.100.000 (mañana), Claro $65.000 (día 5), Netflix $38.900, Tarjeta Nu $640.000 (vence el 22), Celular Samsung cuota 4 de 12 $118.000.
Recent: Rappi −$48.900, Éxito −$132.400, Uber −$18.700, Tostao −$9.800, Cena Andrés −$240.000 (shared with 3, her part $60.000), Nómina +$2.100.000.
Te deben: $380.000 — Juan $180.000 (34 días), Ana $60.000, Caro $140.000.
Trip: Cartagena, $640.000 of $1.500.000.

## Deliverable
Both directions as 3 key screens each (onboarding aha, Inicio, Revisar card), then the full screen set in the chosen direction, plus a one-page mini design system: colors (light + dark), type scale, the row, the chip, the verdict pill, the bottom sheet, the primary/secondary button.
