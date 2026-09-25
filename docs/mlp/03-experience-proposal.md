# Experience Proposal — "Disponible" (MLP)

A clean-sheet design for a Colombian personal-finance app built around one number. Explanations are in English, and every UI string is in Spanish (Colombian register, tú). Where a choice is a bet, it is marked **[BET]**.

---

## 1. Principles

1. **One number, one verdict.** Every screen either shows Disponible or explains something that moves it. No other screen may compute its own "am I on track?". The verdict (Vas bien / Cuidado / Te pasaste) comes from a single function, and category limits use the same words and thresholds.
2. **Value before setup.** The user sees their own Disponible before we ask for any permission, connection or budget. Setup gets offered as a way to *keep the number right*, not as a toll gate.
3. **The bank types, you answer.** Capture is automatic. The user's only job is answering short questions (one tap, rarely two). We never ask the user to type something the bank already said.
4. **Cash reality, no accounting.** Money that leaves counts, whether it went to a friend, a card purchase or the cuota of a purchase. Paying the card is never spending, and money coming back is never "income". No jargon: we say "Te deben", "Cuota", "Pago de tarjeta" and never "pasivo", "devengado" or "flujo".
5. **Precision over recall.** A missed transaction is recoverable (the statement PDF catches it). A wrong amount destroys trust. Auto-capture happens only on an exact template match, and anything uncertain goes to Revisar.
6. **Same thing, same behavior.** One row grammar, one detail sheet, one way to edit, one verdict vocabulary. If two rows look alike, tapping them does the same thing.
7. **Show your work.** Tapping any number shows the lines that produced it. Every automatic decision (merge, ignore, category) can be seen and undone in ≤2 taps.
8. **Quiet by default.** The bank already buzzes on every purchase, so we don't buzz again. We only push when we know something the user doesn't: a bill tomorrow, payday, a change in verdict, a friend who owes too long.

---

## 2. Information architecture

### Tabs (3) **[BET: three tabs, not five]**

| Tab | Purpose | Contains |
|---|---|---|
| **Inicio** | Answer the question | Disponible + per day + verdict, a breakdown of four lines (each drills into its ledger), the next bill, an active trip chip, and a Te deben line. A "+" button for cash. |
| **Movimientos** | What happened | One chronological list in the canonical row grammar, a search box, and filter chips (Cuenta, Categoría, Por revisar). A month/cycle switcher. Nothing else. |
| **Revisar** (badge) | The only "work" surface | A card queue: categorize, train templates, confirm bills, possible duplicates, "¿le prestaste?", cuotas questions. Zero state: "Todo al día". |

An avatar in the Inicio header opens **Ajustes**.

### Screens reached from Inicio (not tabs)
- **Pagos del ciclo** (bills): from the "Por pagar" line and the next-bill card.
- **Te deben**: from the "+$X cuando te paguen" line.
- **Límites**: from the "Ya salió" line. It appears only once limits exist, from week 3 on.
- **Viaje**: from the trip chip while a trip is active or upcoming.
- **Detalle de movimiento**: a bottom sheet, the same from everywhere.

### Ajustes
Cuándo me pagan · Mis cuentas y tarjetas · Fuentes (notificaciones / Gmail / PDF) · Plantillas aprendidas · Ignorados · Reglas de categoría · Ahorro del ciclo · Avisos · Privacidad y datos (export, delete) · Ayuda.

### Deliberately NOT in the app
- Charts dashboard, health score, net worth, investments.
- Budgets for every category. Three limits by default, never a 20-row budget.
- Debt-payoff simulators, "¿me alcanza para…?" calculators, wishlists, scenarios.
- OCR, voice or chat capture (≈0% usage). The generic "detect any number" parser.
- Streaks, badges, points. Gamification here would reward opening the app, not spending well.
- Couples/shared households. Accounting vocabulary.
- A standalone "Tarjetas" tab. Cards are accounts, and their payments are bills.

---

## 3. Onboarding to first "aha"

**The aha is:** *"$412.000 disponibles hasta el 30 · $27.400 al día"*, which is **their** number, within **~90 seconds**, before any permission. **[BET]** We anchor the first cycle on the balance the user already knows (they check their bank app daily), not on history we don't have yet.

### Step 0 — Store page
- Title: **"Disponible: cuánto puedes gastar hasta tu día de pago"**
- Screenshot 1: the Inicio number. Caption: **"Sin escribir nada. Tus bancos le avisan a la app."**
- Screenshot 2: the Revisar card "Rappi → ¿Domicilios, siempre?". Caption: **"Tú solo respondes. Un toque."**
- Screenshot 3: a bill reminder. Caption: **"Ningún pago te coge por sorpresa."**
- Screenshot 4: privacy. Caption: **"Solo leemos las apps de tus bancos. Lo demás nunca sale de tu celular."**
- Drop-off risk: "reads notifications" sounds creepy, so privacy sits on screenshot 4 and not buried.

### Step 1 — Welcome (5 s)
> **Descubre cuánto puedes gastar hasta tu próximo pago.**
> Sin hojas de cálculo. Sin escribir cada compra.
> [Continuar con Google] [Continuar con Apple]

Account creation happens here because data must sync and be encrypted. We ask for no name and no phone number.

### Step 2 — Payday (15 s)
> **¿Cuándo te pagan?**
> (chips) `El 15 y el 30` · `Cada 30` · `Cada 15` · `Otro día…` · `Varía (independiente)`
>
> **¿Cuánto te llega cada vez?** (neto, lo que ves en tu cuenta)
> [$ ________ ]

For "Varía", the copy is "¿Cuánto te entra en un mes normal? Lo usamos solo como referencia." Irregular mode is described in §7.

### Step 3 — Balance today (10 s)
> **¿Cuánto tienes hoy en tus cuentas?**
> Suma lo de todos tus bancos. No cuentes tarjetas de crédito.
> [$ ________ ]   *"No sé exacto" → acepta un número redondo*

### Step 4 — Fixed payments before payday (30 s)
> **¿Qué te falta pagar antes del 30?**
> (chips with editable amounts) `Arriendo` `Tarjeta de crédito` `Celular` `Internet` `Gimnasio` `Streaming` `Crédito/Préstamo` `Otro`
> [Nada más] [No tengo pagos pendientes]

Tapping a chip opens a single amount field plus a day ("¿Qué día?"). The "Tarjeta de crédito" chip says: "Lo que te toca pagar este mes (el pago mínimo o total que sueles hacer)".

### Step 5 — AHA (≈90 s from install)
> **$412.000**
> **disponibles hasta el 30 · $27.400 al día**
> Tienes $1.180.000, te faltan pagar $768.000.
> *Así de simple. Ahora hagamos que se actualice solo.*
> [Mantenerlo al día automáticamente]
> [Ver la app primero]

The optional savings goal is **not** asked here. It is offered at the first payday ("¿Quieres apartar algo este ciclo?"), because a savings question before value lowers the number and reads as a lecture.

### Step 6A — Android: notifications (40–60 s)
**6A.1 Pick banks.** Logos appear pre-checked if the app is installed (we query installed packages via a declared `<queries>` list of known bank packages only).
> **¿De qué bancos quieres que lea los avisos?**
> ☑ Bancolombia ☑ Nu ☐ Nequi ☐ Davivienda … [Otra app]
> *Solo leeremos los avisos de estas apps. Todo lo demás se descarta en tu celular sin guardarse.*

**6A.2 Pre-permission explainer** (the Android system screen is scary: "podrá leer todas las notificaciones…"):
> **Android te va a mostrar una advertencia fuerte.**
> Es el mismo permiso que usan los relojes inteligentes. Nosotros filtramos en tu celular: solo pasan Bancolombia y Nu.
> [Abrir ajustes] → system toggle → auto-return.

**6A.3 Instant proof.** On permission grant, we read the *currently active* notifications in the shade from the chosen apps. If there are bank notifications, we parse them right away:
> **Encontré 2 avisos de Bancolombia de hoy. Ya están en tu Disponible.**

If there are none:
> **Listo. Tu próxima compra aparecerá aquí sola, en segundos.**
> *¿Quieres probar? Haz una transferencia pequeña o paga algo con tarjeta.*

**6A.4 Offer backfill (optional):** "¿Tienes tu extracto en PDF? Súbelo y te muestro en qué se te fue la plata el mes pasado." [Subir extracto] [Después]

### Step 6B — iPhone: Gmail (40–70 s)
> **Conecta tu Gmail para que tus compras lleguen solas.**
> Solo leemos correos de tus bancos (lista fija de remitentes). Nunca leemos otros correos ni podemos enviar nada.
> [Conectar Gmail] → Google OAuth (read-only)

Right after that we run a backfill of 60 days of bank-sender mail:
> **Encontré 57 movimientos desde el 1 de agosto.**
> Desde el 15 te han salido $1.320.000.

Now the first-cycle anchor gets cross-checked. The balance anchor stays the source of truth for the current cycle (email can miss things), and history powers everything else: recurring detection, limit suggestions and categories.

Fallback without Gmail (Outlook/Hotmail users, or anyone who refuses): "Sube tu extracto PDF" plus manual entry. Email forwarding setup is offered later, from a desktop link (v1.1).

### Step 7 — First answers (20–40 s, max 5 cards)
Only if history exists (from the shade, Gmail or a PDF):
> **3 preguntas rápidas para que todo quede bien clasificado**
> Rappi · 6 veces · $214.000 → **¿Domicilios?** [Sí, siempre] [Otra categoría]

These go through the same Revisar card component the user will use forever. It teaches the core loop in onboarding.

### Step 8 — Notification permission (in context, iOS/Android 13+)
> **¿Te aviso un día antes de cada pago?**
> [Sí, avísame] [No por ahora]

### Paths compared

| Situation | What Inicio shows at the end of onboarding |
|---|---|
| Zero data, no capture enabled | Disponible from the balance anchor, a "Se actualiza solo cuando conectes tus bancos" banner, and "+" for manual entry. Revisar is empty. |
| Android, capture on, nothing in the shade | Same number, plus a banner that disappears on the first auto-capture: "Esperando tu primer aviso de Bancolombia…". |
| Gmail or PDF backfill | Same number, but "Ya salió" shows the real cycle spending. Detected recurring payments show up in Revisar ("¿Pagas Netflix $38.900 cada mes?"). Limit suggestions become available immediately if there are 3+ weeks of history. **[BET]** A backfill fast-forwards the product to "week 3". |

### Drop-off risks, ranked
1. **Android notification-access screen.** Expect 30–45% abandonment there. Mitigation: explainer, the value already shown, "Ver la app primero" as an escape, and a retry from a banner later.
2. **Google OAuth for Gmail** needs a restricted scope. That means a security assessment and verification delay, and any "unverified app" warning kills conversion. This is a **launch blocker** to verify early.
3. **Balance question.** Users may not know the number. The "No sé exacto" option accepts a rough figure, and it gets corrected later with "Cuadrar con mi saldo".
4. **PDF password.** Default hint: "Casi siempre es tu número de cédula." We store it encrypted only if the user opts in ("Recordar para el próximo extracto").

---

## 4. Journeys

### Day 1
| When | App does | User does | Time |
|---|---|---|---|
| Onboarding | Shows the aha and captures active notifications | Answers 3–5 questions | ~3 min |
| First real purchase | Captures silently (no push) and updates Disponible | Nothing | 0 s |
| 8:00 pm, if Revisar has items | One push: "Tienes 3 movimientos por revisar · 20 segundos" | Opens and answers the cards | 20–40 s |
| Bills | Creates reminders only for what was declared in step 4 | — | — |

The Day-1 goal is to see one purchase appear on its own. That is the second aha, and it is our activation metric (§12).

### Week 1
- **Capture:** 10–25 transactions auto-captured. Most categorize by default from the shipped merchant dictionary (deterministic list: RAPPI→Domicilios, EXITO→Mercado, UBER→Transporte, …), and unknowns go to Revisar.
- **Revisar load:** ~5–10 cards on days 1–3, dropping to ~1–3/day as rules accumulate. Each card takes ≤1 tap. Total effort: ~2 min over the week.
- **First unknown format:** someone's Lulo or Falabella notification doesn't match, and a training card appears (§6). It's done once per format.
- **First Te deben moment:** a dinner for 4 at $240.000. The user taps "Fue compartido" on the Revisar card or detail sheet, and gets "Tu parte $60.000 · Te deben $180.000 (Ana, Juan, Caro)".
- **Payday (15th or 30th):** push "Te llegó el sueldo. Nuevo ciclo: $1.050.000 disponibles hasta el 30." The first cycle switches from the balance anchor to the income formula. If the previous cycle ended positive: "Te sobraron $85.000 — ¿los pasas a ahorro?" [Sí] [Déjalos].
- **Sunday 7 pm:** first weekly digest.

### Week 4
- **Revisar:** ~0–2 cards/day. Most days it's empty.
- **Recurring bills:** 3–8 detected and confirmed. Card payment and cuotas show as bills. Day-before reminders are working.
- **Limits:** around days 14–28 (once ≥14 days of data, or immediately after a backfill), one card appears: "Con lo que has gastado, te sugiero 3 límites por ciclo: Domicilios $180.000 · Salidas $250.000 · Compras $200.000." [Usar estos] [Ajustar]. Suggestion = median spend per cycle of the top-3 discretionary categories, minus 10%, rounded to $10.000. **[BET]** These are the categories with the most variance, not the most spend (rent is big but not controllable).
- **Statement arrives:** push "Ya debe estar tu extracto de Nu. Súbelo para cuadrar (1 minuto)." The import reconciles, finds 2 missing transactions and corrects 1 foreign-currency amount. The user sees "Cuadrado ✓ · 2 movimientos que no habíamos visto".
- **Te deben:** Juan's debt is 21 days old, and the app offers a WhatsApp reminder message.
- **Time spent:** ~1–2 min/day glancing at Inicio, plus ~2 min/week on the digest and Revisar.

---

## 5. Core screens

### 5.1 Inicio

```
┌─────────────────────────────────────┐
│ Ciclo 15 sep – 29 sep          (◉)  │  avatar → Ajustes
│                                     │
│   Disponible                        │
│   $412.000                          │
│   $27.400 al día · 15 días          │
│   ● Vas bien                        │  verdict pill (one of 3)
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Llega este ciclo   $2.100.000 › │ │  → ingresos
│ │ Por pagar          −$968.000 ›  │ │  → Pagos del ciclo
│ │ Ahorro             −$200.000 ›  │ │  → ajustar
│ │ Ya salió           −$520.000 ›  │ │  → Movimientos (cycle) / Límites
│ └─────────────────────────────────┘ │
│                                     │
│ + $180.000 cuando te paguen  (Te deben) ›
│                                     │
│ Próximo pago                        │
│ Arriendo · mañana      $1.100.000   │
│                                     │
│ ✈ Cartagena · $640.000 de $1.500.000 ›  (only if trip)
│                                     │
│ [ + Agregar gasto en efectivo ]     │
├─────────────────────────────────────┤
│  Inicio   │ Movimientos │ Revisar ③ │
└─────────────────────────────────────┘
```

- The four breakdown lines are the formula itself, so the number is always auditable.
- Tapping the big number opens "¿Cómo se calcula?" with the same four lines plus adjustments (carryover, trip overflow), and an "¿Algo no cuadra?" button (§9).
- If there's a data gap, a small grey line goes under the per-day figure: "Sin avisos de Nu desde el 18 ›".
- Nothing else. No chart. **[BET]** A sparkline of Disponible over the cycle is tempting, but it was cut because it invites a second interpretation.

### 5.2 Movimientos (list) and Detalle

The list is grouped by day ("Hoy", "Ayer", "Mié 17 sep"). Each group shows only the day's total out. Filter chips sit on top, and "Por revisar" rows have a dot.

**Detail sheet** (the same sheet opens from every row, everywhere):

```
┌─────────────────────────────────────┐
│ ─────                               │
│ Rappi                   −$48.900    │
│ Hoy 8:42 pm · Bancolombia Débito    │
│─────────────────────────────────────│
│ Categoría        Domicilios       › │
│ Cuenta           Bancolombia *4410› │
│ Monto            $48.900          › │
│ Fecha            25 sep           › │
│ Nota             —                › │
│─────────────────────────────────────│
│ [ Fue compartido ] [ Es de un viaje]│
│ [ Cuotas ] (tarjeta de crédito only)│
│─────────────────────────────────────│
│ Origen: aviso de Bancolombia ›      │  shows raw captured text
│ No es un gasto / Eliminar           │
└─────────────────────────────────────┘
```

Every field is a tappable row that opens an inline picker or keypad. Changing the category prompts: **"¿Siempre que sea Rappi?"** [Sí, siempre] [Solo esta vez]. "Origen" shows the exact notification, email or PDF line, with sources merged if it was deduplicated ("Aviso + extracto ✓").

### 5.3 Revisar (review and training inbox)

One card at a time, with a stack count on top. Card types, in priority order:
1. Possible duplicate
2. Training (unknown format)
3. Partial match
4. Transfer to a person
5. Cuotas question
6. Categorize
7. Confirm recurring bill
8. Limit suggestion

```
┌─────────────────────────────────────┐
│ Revisar                   3 de 7    │
│ ┌─────────────────────────────────┐ │
│ │ Bancolombia · hoy 1:14 pm       │ │
│ │ MERCADOPAGO*FALABELLA  −$89.900 │ │
│ │ T. Crédito *7731                │ │
│ │                                 │ │
│ │ ¿Qué fue?                       │ │
│ │ (Compras) (Ropa) (Mercado)      │ │  top-3 suggestions (deterministic)
│ │ (Otra…)                         │ │
│ │                                 │ │
│ │ ☑ Siempre para este comercio    │ │
│ │                                 │ │
│ │ Fue compartido · Cuotas · Viaje │ │  secondary actions
│ └─────────────────────────────────┘ │
│  [Saltar]                           │
└─────────────────────────────────────┘
```

- **Suggestions** are deterministic: (1) the user's own rule for similar merchant tokens, (2) the shipped dictionary, (3) the user's 3 most-used categories. We never say "IA" or "sugerencia inteligente".
- **Answering** advances to the next card and shows "Listo" with an undo toast (5 s).
- **Zero state:** "Todo al día. Te avisamos si algo necesita tu ojo."
- "Saltar" moves a card to the back of the queue. Skipped transactions still count in Disponible with category "Sin clasificar".

### 5.4 Pagos del ciclo (bills)

It has two sections: **Antes del 30** (this cycle) and **Próximo ciclo**. Each row shows name, day, amount and status (Pendiente / Pagado ✓ / Atrasado).
- Card rows: "Tarjeta Nu · vence el 22 · $640.000". Tapping one shows what the payment covers: "Compras del ciclo anterior $410.000 (ya restadas de tu Disponible entonces) · Cuotas de este mes $230.000".
- Cuota rows are grouped under their card: "Celular Samsung · cuota 4 de 12 · $118.000".
- Detected bills arrive through Revisar ("¿Pagas Claro $65.000 cerca del 5 cada mes?" [Sí] [No es fijo]). After confirmation they auto-mark as paid when a matching transaction arrives (same merchant tokens, amount ±15%, date ±5 days).
- There is no separate "subscriptions" screen. Netflix is just a bill.

### 5.5 Te deben

```
┌─────────────────────────────────────┐
│ ‹ Te deben                          │
│   $380.000                          │
│   4 personas · el más viejo: 34 días│
│ ┌─────────────────────────────────┐ │
│ │ ⚠ Llevas 22% de tu sueldo       │ │  only when threshold hit
│ │ prestado. ¿Deberías parar de    │ │
│ │ prestar un tiempo?              │ │
│ └─────────────────────────────────┘ │
│ Juan Pérez            $180.000  ›   │
│   Cena Andrés · Uber · 34 días      │
│ Ana                    $60.000  ›   │
│   Cena Andrés · 12 días             │
│ Caro                  $140.000  ›   │
│   Préstamo · 5 días                 │
│                                     │
│ [ + Presté plata ]                  │
│ ─ Ya te pagaron (este mes) ─        │
│ Mateo                 $45.000 ✓     │
└─────────────────────────────────────┘
```

- **Person detail:** the list of items and partial repayments, plus actions [Registrar pago] [Recordarle por WhatsApp] [Perdonar deuda]. The WhatsApp message is pre-written: "¡Hola Juan! Te paso la cuenta: cena en Andrés $60.000 + Uber $20.000 = $80.000. Nequi 300 123 4567 🙌" (the user edits it; we never send anything ourselves).
- **Repayment detection:** an incoming transfer whose sender name matches a debtor (normalized name tokens) shows up in Revisar as "Juan te envió $80.000. ¿Es lo que te debía?" [Sí, cierra la deuda] [Es parte] [No].
- **"Perdonar deuda"** converts the remaining amount into spending in the original category. The copy is honest: "Queda como gasto tuyo de ese día."
- **Lending-too-much signal** (either condition): total > 20% of cycle income, **or** any single item > 45 days, **or** a person with 3+ open items. It shows once per cycle on this screen, in the digest, and never as a standalone push.

### 5.6 Viaje (trip)

- **Create:** name, dates, amount, currency (COP default, plus USD/EUR/MXN…), and "¿De dónde sale la plata?" [Ya la tengo ahorrada] [Sale de este ciclo (resta de tu Disponible)] [Sale de varios ciclos: apartar $X por ciclo hasta la fecha].
- **During the dates:** transactions within the dates and outside your home city can't be detected deterministically, so the rule is **every** captured transaction gets a Revisar card: "¿Es del viaje?". The default follows the currency: foreign currency = yes, COP = ask. After 3 consecutive "yes" answers we flip the default for the rest of the trip ("Durante el viaje todo cuenta como viaje. Cambiar").
- **Trip screen:** pot, spent, left, and per-day left, with the same verdict words. Shared trip expenses use the same "Fue compartido" flow, and friends' shares go to Te deben tagged with the trip.
- **Overflow:** if the trip exceeds its pot, the excess hits Disponible as a line "Viaje Cartagena se pasó −$120.000".

### 5.7 Límites

The screen appears only after the suggestion is accepted. It shows 3 rows (users can add up to... any number, but the "+" is low-key). Each row: category, a bar of spent vs the pro-rated line, the verdict word, and "Te quedan $X". The limit period equals the pay cycle. Spending in a limited category still reduces Disponible; limits are a lens, not a separate pot. **[BET]** Limits never change Disponible, so there is never a second number.

### 5.8 Ajustes
- **Fuentes:** each source with a health dot ("Bancolombia · último aviso hace 2 h ●"), plus Gmail status and the last PDF per bank.
- **Plantillas aprendidas:** per sender, with a last-matched date, [Probar con un aviso] and [Borrar].
- **Ignorados:** the last 30 days of dropped bank notifications (OTP, promos, balances, rejected), each with "Esto sí era un movimiento".
- **Reglas de categoría:** a list with delete. Also: Cuándo me pagan, Ahorro, Avisos (per-type toggles), Privacidad (export CSV, delete all, "Qué sale de mi celular").

---

## 6. The notification-training flow

### Pipeline (on device)
1. **Package filter:** anything not from a chosen package is dropped in memory. It is never stored or logged.
2. **Classifier by exact templates**, in order:
   - Ignore templates: OTP ("código", "clave dinámica", 6-digit + "no compartas"), promos, "saldo disponible", login alerts.
   - Transaction templates: shipped per bank, plus user-trained.
3. **Outcomes:**
   - **Full match** leads to auto-capture.
   - **Partial match** (the sender is known and ≥1 anchor phrase matches but not all fields extract) leads to a Revisar card prefilled with what was extracted.
   - **No match**, when the text contains no ignore keywords, leads to a training card.
   - **No match** that looks like marketing (no digits after `$`) is silently dropped into Ignorados.
4. Only the **structured result** (amount, merchant, account last-4, direction, timestamp) plus the raw text of *chosen-bank* notifications is uploaded, encrypted. The raw text is kept only so "Origen" can show it.

**Templates** are deterministic patterns: literal anchors plus typed slots (`{monto}`, `{comercio}`, `{tarjeta4}`, `{fecha}`, `{hora}`, `{moneda}`). Shipped templates come as a signed, versioned pack downloaded from the server, so we can fix a bank's wording change for everyone within hours without an app release. **[BET: the server template pack is the single most important ops investment.]** User notifications are never used to build it unless the user opts into "Compartir la forma del aviso (sin montos, nombres ni números)", which is v1.1.

### Training card (unknown format)

```
Lulo Bank · 11:02 am
"Hiciste un pago de $32.500 en TOSTAO CALLE 85 con tu tarjeta terminada en 2291"

Toca las partes del mensaje:
[$32.500]  ← Monto ✓ (auto-highlighted: tokens after $)
[TOSTAO CALLE 85] ← Comercio (user taps words)
[2291] ← Tarjeta
¿Entró o salió plata?  (Salió) (Entró) (No es un movimiento)

[Guardar y usar para avisos iguales]
```

- The user taps highlighted chunks. We pre-segment by tokens and pre-select candidates for amount (a `$` prefix) and card (4 digits after "terminada/\*").
- **"No es un movimiento"** creates an ignore template for that shape.
- On save, we generalize: the literal text stays as anchors and the tapped spans become slots. Before activating, we **test the template against the last 20 notifications from that sender** and show "Esta plantilla también reconoce 3 avisos anteriores" (those get added after confirmation). This proves it works and backfills in one step.
- A trained template auto-captures only after it has matched **2** notifications that the user confirmed or didn't correct. Until then, its matches go to Revisar prefilled. **[BET]** One confirmation is cheap insurance against a mis-tapped slot.

### Edge cases

| Case | Behavior | User sees |
|---|---|---|
| **New bank format** (a new sender, or a bank we don't ship) | Training card as above. | "Aviso nuevo de Lulo. Enséñame una vez y lo reconozco siempre." |
| **Same bank changes wording** | The shipped template fails and the anchors partially match, giving a partial-match card prefilled. If 3+ partial matches from the same sender happen within 48 h, a banner appears and we flag the server pack. When the pack updates, pending cards resolve automatically. | "Bancolombia cambió cómo escribe sus avisos. Mientras lo ajustamos, confírmalos aquí (1 toque)." |
| **Refund** ("reverso", "devolución", "abono por devolución") | An explicit refund template. It is linked to the original purchase when merchant + amount match within 60 days. It reduces that category's spend and raises Disponible. It is never labeled income. | Row: "Reembolso · Falabella +$89.900" with the chip "Devuelve compra del 12 sep". |
| **Declined purchase** ("rechazada", "no aprobada", "fondos insuficientes") | An ignore template. Nothing is captured, but it is logged in Ignorados with its reason. If a matching approved purchase arrives within 10 min, nothing changes. | Nothing, or visible in Ajustes › Ignorados: "Compra rechazada en Éxito $120.000". |
| **Transfer between my own accounts** | Pairing: an outflow in account A plus an inflow in account B, same amount, ±24 h, is recorded as a transfer and is neutral to Disponible. If only one side is visible (e.g. Nequi isn't a chosen app), a card asks "¿Esta transferencia a Nequi 300…567 es a tu propia cuenta?" [Sí, siempre a esta] [Es a otra persona]. The answer becomes a rule on the destination identifier. | Row with "↔" and a neutral color: "A Nequi · Transferencia propia $200.000". |
| **Card payment** | The debit side ("Pago a tarjeta", "PSE … TARJETA") plus the card side ("Recibimos tu pago") become one transfer. It marks the card bill as paid. It is never income and never spending. If only the debit side is seen, it matches the card bill amount ±5% and asks once. | Bill row: "Tarjeta Nu · Pagado ✓". Disponible doesn't move at payment time (it already moved when the purchases happened, or it was reserved as "Por pagar"). |
| **Instalment purchase** | Notifications rarely state cuotas. Rule: a credit-card purchase ≥ $300.000 (user-adjustable) gets a Revisar card "¿A cuántas cuotas?" (1)(3)(6)(12)(24)(36)(Otra). Below the threshold we assume 1. Until answered, the purchase counts as **1 cuota (full amount)**, which is conservative. The next statement PDF confirms or corrects silently and reports "Corregimos: Samsung era a 12 cuotas". | Row: "Samsung · Cuota 1/12 · −$118.000" (the amount that counts), with the full price in detail: "Precio $1.200.000 · Total con intereses ≈ $1.416.000". |
| **Foreign-currency charge** | The template extracts `{moneda}` and `{monto}`. We convert at the day's reference rate plus 3% (typical bank markup) and mark it approximate. The statement replaces it with the exact COP amount. | "Netflix · ≈ −$52.300 (USD 12,99)". The "≈" disappears after reconciliation. |
| Purchase + OTP arriving together | The OTP is ignored by template. The purchase is captured once. | — |
| Same purchase via notification and email and PDF | Dedup (§9). | One row, origin shows "Aviso + extracto ✓". |
| Notification is edited or updated by the bank app (same notification ID) | Keyed by package + notification key + text hash. Updates don't create new rows. | — |

---

## 7. Disponible: computation and explanation

### Cycle
A cycle runs from a payday to the day before the next payday. With a 15th/30th schedule there are two cycles per month, and each gets its own quincena. If a payday lands on a weekend or holiday, the income is expected on the prior business day, and the cycle still starts when the money actually arrives (or on the expected date if it hasn't arrived by then, with a flag).

### Formula (as the user sees it)
```
Disponible = Llega este ciclo − Por pagar − Ahorro − Ya salió (+ ajustes)
Por día    = Disponible ÷ días que faltan (incluye hoy)
```

- **Llega este ciclo** is the expected income for this cycle. Once the salary arrives, the actual amount replaces the expected one. Other inflows count here only if categorized as income (bonus, freelance). Repayments from Te deben count too, but in their own line ("Te pagaron").
- **Por pagar** is confirmed bills due before the next payday and not yet paid, plus card payments due this cycle, **minus the part of the card payment already counted as "Ya salió" in a previous cycle** (see below), plus cuotas due.
- **Ahorro** is the savings goal for this cycle (optional; 0 by default).
- **Ya salió** is every outflow this cycle that isn't a transfer to yourself, a card payment, or a trip-pot expense. That includes debit purchases, credit-card purchases (their cuota for this cycle), cash, and money lent. Refunds net against it.

### How each special case works
- **Credit-card purchases count when you buy, not when you pay.** A 1-cuota card purchase hits "Ya salió" the day you make it. When the card payment comes, that portion is already covered: the bill shows it as "ya restado", and only the unreserved remainder (cuotas, interest, fees, purchases from before you used the app) reduces "Por pagar". Copy in the card bill detail: **"Tus compras con tarjeta ya se restaron cuando las hiciste. Pagar la tarjeta no te resta otra vez."**
- **Cuotas:** only this cycle's cuota counts, in the cycle in which it will be billed. Future cuotas show up as bills in future cycles. Interest is estimated from the card's rate (asked once per card when the first cuota purchase appears, or read from the PDF), and it is included in the cuota amount.
- **Te deben:** the full amount you paid hits "Ya salió" (cash reality). Your share is *spending* in the category; the rest is *prestado*. Inicio shows "+$X cuando te paguen", which is never added to Disponible. **[BET]** We never count on friends paying back. When they do, the money enters as "Te pagaron" and Disponible goes up.
- **Trips:** spending inside the trip is drawn from the pot and never touches "Ya salió". Funding the pot "de este ciclo" enters as a bill ("Viaje Cartagena −$500.000"), and overflow enters as a line.
- **Irregular income** (the "Varía" mode) uses **only money already received this cycle plus the balance anchor**. A cycle is a calendar month. Expected income is shown but not counted: "Si te entra lo de siempre (~$3.000.000), tendrías $X más." **[BET]** Conservative is right for freelancers; the optimistic number is visible but secondary.
- **Carryover:** if a cycle ends negative, the next cycle opens with a line "Te pasaste el ciclo pasado −$X". If it ends positive, the surplus is **not** carried forward automatically. The user is asked "¿A ahorro o lo dejas disponible?" and the default is "lo dejas", which adds a line "Te sobró +$X".
- **First cycle:** Disponible = balance today − bills before payday − savings. Card debt due this cycle counts as a bill. Subsequent cycles use the income formula.

### Verdict (one function, used everywhere)
Let `ritmo_inicial` = Disponible at cycle start ÷ cycle days, and `ritmo_hoy` = Disponible now ÷ days left.

| State | Condition | Copy |
|---|---|---|
| **Vas bien** (green) | `ritmo_hoy ≥ 0,85 × ritmo_inicial` | "Vas bien. Puedes gastar $27.400 al día hasta el 30." |
| **Cuidado** (amber) | `0 ≤ ritmo_hoy < 0,85 × ritmo_inicial`, **or** the account balance won't cover a bill due in the next 3 days | "Cuidado: para llegar al 30, gasta máximo $14.000 al día." |
| **Te pasaste** (red) | Disponible < 0 | "Te pasaste por $85.000. Lo restamos del próximo ciclo." |

- **Hysteresis:** the state worsens immediately but only improves after holding for 24 h, so users don't see it flicker on a refund.
- **Limits:** the same words, with `spent vs limit × (days elapsed / cycle days)` and the same 0,85 factor mirrored.
- **Trips:** the same words, using the pot.

### Missing data states
- **Source silent:** a chosen source has had no transaction for > (its median gap × 3, min 4 days). The number gets a "~" and a line "Sin avisos de Nu desde el 18. ¿Todo bien? ›", which leads to a health check (is the permission still on? battery optimization killing the listener?).
- **Payday passed but no salary detected:** "¿Ya te llegó el sueldo?" [Sí, $X] [Aún no]. Until answered, the expected amount is used with a "~".
- **No capture at all:** the number shows with "Actualizado por ti el 23 sep" and a CTA to connect.
- **Never hide the number.** Degrade to "~" and explain. A blank screen is worse than an approximate number.

---

## 8. Notifications and re-engagement

**Global caps:** max **2 pushes/day** from us, excluding day-before bill reminders the user explicitly asked for. Quiet hours are 9:30 pm–7:30 am (bills are moved to 8 am). No push for individual captures. **[BET]**

| Push | Trigger | Copy | Cap |
|---|---|---|---|
| **Pago mañana** | A confirmed bill due tomorrow and not paid | "Mañana pagas Arriendo: $1.100.000. Te quedarían $412.000 disponibles." | 1 per bill; grouped if several: "Mañana: Arriendo y Claro ($1.165.000)" |
| **Pago hoy, sin registrar** | Due date passed at 6 pm and no match | "¿Ya pagaste Claro? Márcalo para que tu Disponible cuadre." | 1 per bill |
| **Te llegó el sueldo** | A salary inflow is detected | "Te llegó el sueldo. Nuevo ciclo: $1.050.000 disponibles hasta el 30." | 1 per cycle |
| **Cambio a Cuidado** | The verdict worsens to Cuidado | "Vas más rápido que de costumbre. Para llegar al 30: $14.000 al día." | 1 per cycle |
| **Te pasaste** | Disponible < 0 | "Te pasaste por $40.000 este ciclo. Mira en qué ›" | 1 per cycle |
| **Por revisar** | ≥3 cards pending at 8 pm | "3 movimientos por revisar · 20 segundos" | 1/day, only if the app wasn't opened that day; off after 3 ignored in a row until the user returns |
| **Resumen semanal** | Sunday 7 pm | See below | 1/week |
| **Límite** | A limit reaches 85% (Cuidado) | "Domicilios: te quedan $30.000 para lo que queda del ciclo." | 1 per limit per cycle |
| **Fuente callada** | A source is silent beyond threshold | "No he visto movimientos de Nu en 6 días. ¿Sigue activo el permiso?" | 1 per source per 7 days |
| **Extracto listo** | Card cut date + 3 days (learned from past PDFs or asked) | "Ya debe estar tu extracto de Bancolombia. Súbelo para cuadrar (1 minuto)." | 1/month per card |
| **Te deben** | An item reaches 21 days | "Juan te debe $80.000 hace 3 semanas. ¿Le mandas un recordatorio?" | 1 per person per 14 days |
| **Plantilla rota** | 3 partial matches from the same sender | "Bancolombia cambió sus avisos. Confirma 2 movimientos para que no se te pierdan." | 1 per sender per 7 days |

### Weekly digest
The format is one verdict plus up to 3 lines, rule-generated by picking the top 3 by priority from a fixed rule list:

> **Vas bien esta semana.**
> Te quedan $412.000 para 8 días ($51.500 al día).
> Domicilios: $96.000, más que la semana pasada (+$40.000).
> Juan y Ana te deben $240.000.

Rule priority:
1. The verdict.
2. The biggest category delta vs a 4-week average (only if >25% and >$30.000).
3. Bills in the next 7 days.
4. The Te deben total, if > 0 (with the "parar de prestar" signal when triggered).
5. The Revisar backlog.
6. A positive fact ("Gastaste 18% menos en Salidas que tu promedio").

Its in-app version is a card at the top of Inicio on Sunday and Monday, and it is dismissible.

**Dormancy:** the user has been silent 7 days while capture still runs. One push: "Esta semana te salieron $620.000 sin que escribieras nada. Tu Disponible: $210.000." That shows the value accrued in their absence. After that, nothing more until something they explicitly asked for (bills).

---

## 9. Empty, error and trust states

### Duplicate detection
There is one row per real-world transaction. Matching keys:
- **Strong:** the same account last-4 + the exact amount + the date ±1 day + merchant token overlap ≥ 1. The sources are auto-merged silently, and origin lists both.
- **Weak:** the same amount, ±3 days, but a different merchant string, or a missing account. A Revisar card asks "¿Es el mismo movimiento?" and shows both, with [Sí, es uno] [No, son dos].
- **Authority:** the statement PDF beats email, email beats the notification, and the notification beats manual entry. The higher source wins on amount/date/merchant, and user-set fields (category, note, share, trip) always survive the merge.
- **Manual cash vs captured:** if a manual entry matches a later capture (e.g. a debit-card purchase the user also typed), a weak-match card asks.
- **PDF import summary:** "124 movimientos · 118 ya los tenía · 5 nuevos · 1 corregido (monto en dólares)". [Ver nuevos] Nothing is ever duplicated silently.

### Wrong categorization
Tap the row, tap Categoría, pick one, then "¿Siempre para Rappi?" That's 2 taps plus a choice. Rules are editable in Ajustes. Past transactions change **only** if the user says "Sí, también las anteriores" in the same prompt (a third option appears when ≥3 past matches exist).

### Missing notifications
- **The listener gets killed** (Xiaomi/Samsung battery optimization): detected by a heartbeat (no listener callbacks in 24 h while the phone was in use). We show a device-specific fix: "Tu Xiaomi está apagando la lectura de avisos. Toca aquí y elige 'Sin restricciones'."
- **The user swiped away the notification before we processed it:** not possible (the listener receives it on post), unless the service was dead, which is the case above.
- **Gap caught by PDF:** "5 movimientos nuevos que no nos llegaron por aviso", with the source health updated.

### "My number is wrong": fix in ≤2 taps
Tap Disponible, then tap **"¿Algo no cuadra?"**. The options are:
- **"Cuadrar con mi saldo"**: type the real bank balance. The app computes the difference and shows "Te faltan $X por registrar. Lo agregamos como 'Ajuste de saldo'" [Agregar] [Buscar el movimiento]. The adjustment is one visible row and can be undone. **[BET]** This is the universal escape hatch that makes trust recoverable without a support ticket.
- **"Un movimiento está mal"**: opens the cycle list, sorted by largest amount (most wrong numbers are big ones: card payments, transfers).
- **"Un pago no aplica"**: opens Pagos del ciclo.

A wrong amount on a single transaction: tap the row, tap Monto, and type it.

### Empty states
| Where | Copy |
|---|---|
| Movimientos, no data | "Aquí aparecerán tus movimientos solos. Mientras tanto, agrega un gasto en efectivo." [+ Agregar] |
| Revisar, empty | "Todo al día." |
| Pagos, none | "Aún no sé qué pagas cada mes. En unas semanas te lo propongo." [+ Agregar un pago] |
| Te deben, none | "Nadie te debe. Cuando pagues por otros, toca 'Fue compartido'." |
| Límites, before data | *(screen doesn't exist)* Inicio line only: "En unos días te sugiero límites con base en lo que gastas." |

### Errors
- **PDF wrong password:** "Esa clave no abre el extracto. Suele ser tu cédula sin puntos."
- **Bank not supported in PDF:** "Todavía no leemos extractos de Confiar. Tus avisos sí funcionan."
- **Gmail token revoked:** a banner in Inicio: "Se desconectó tu Gmail. Reconectar (10 s)", plus a "~" on the number.

### Privacy trust surface
Ajustes › Privacidad › "Qué sale de mi celular" shows, in plain Spanish, what leaves the phone and what doesn't, plus a live counter: "Hoy descartamos 214 avisos de otras apps sin leerlos ni guardarlos."

---

## 10. Consistency rules

### One row grammar
```
[cat-icon]  Title                          ±Amount
            Category · Account · Time      [≤1 chip]
```
- **Title:** the cleaned merchant name, or the person's name for transfers, or the bill name.
- **Amount:**
  - money out is "−$48.900" in the default text color;
  - money in is "+$80.000" in green;
  - own transfers and card payments are "↔ $200.000" in grey.
  - Trip rows in foreign currency show COP with "≈".
- **One chip max,** by priority:
  1. "Por revisar" (dot)
  2. "Cuota 3/12"
  3. "Tu parte $60.000"
  4. "Viaje"
  5. "Reembolso"
- The same grammar applies in Movimientos, Pagos, Te deben items, Viaje, search results and Revisar card headers.
- **Tap always opens the Detalle sheet**, for every row, everywhere. No swipe actions and no long-press menus. **[BET]** Discoverability and consistency over power-user speed.

### One verdict language
- There are only three words: **Vas bien / Cuidado / Te pasaste**, with one color each. They come from one function with the same 0,85 threshold everywhere (Disponible, limits, trips).
- No screen may show a percentage score, grade, health index or "on track" synonym.

### One way to edit
- **Everything is edited in the Detalle sheet:** tap the field and change it. There are no edit modes, no pencil icons and no separate edit screens.
- **Learning prompt:** "¿Siempre para X?" appears after category, merchant-name or "es transferencia propia" changes, and never for amount or date.
- Every automated action has an undo toast (5 s) and is reversible later from Detalle.

### Copy rules
- Use tú, short sentences, and a verb first in CTAs ("Súbelo", "Conectar", "Recordarle").
- **Money format:** "$1.250.000" with no decimals, "COP" never shown, and foreign currency as "USD 12,99".
- **Dates** are relative when close ("hoy", "mañana", "el jueves"), otherwise "25 sep".
- **Banned words:** presupuesto (use "límite"), ingreso neto, pasivo, flujo de caja, balance (use "saldo"), transacción (use "movimiento").

---

## 11. MLP cut line

### v1 (launch)
| Item | Reason |
|---|---|
| Onboarding with the balance anchor and aha before permissions | Activation is the problem, and this fixes it first. |
| Android notification capture with shipped templates: Bancolombia, Nu, Nequi, Davivienda, Banco de Bogotá, Falabella, Lulo | Where ~85% of users are, and the channel that proved automatic capture works. |
| Training inbox plus partial-match review | Needed so that long-tail banks and wording changes don't break trust. |
| Signed server template pack | Wording changes will happen in month one, and a release cycle is too slow. |
| iPhone: Gmail read-only (bank senders) with 60-day backfill | The only automatic path on iOS. |
| PDF import for Bancolombia, Nu, Davivienda, Falabella | Backfill plus reconciliation for the biggest banks. |
| Inicio / Movimientos / Revisar / Detalle | The core loop. |
| Deterministic categorization: dictionary plus "¿siempre?" rules | The most frequent action; it must be one tap. |
| Pagos del ciclo: detection, confirmation, day-before reminder, card payment as bill, cuotas | "Never let a bill surprise me" is half the JTBD. |
| Card and cuotas logic, with the cuotas question at the ≥$300k threshold | Wrong card math was the top complaint. |
| Te deben: share split, per-person ledger, repayment detection, WhatsApp reminder text, lending signal | Very common behavior, and it keeps Disponible honest. |
| Dedup across notification/email/PDF/manual | Duplicates kill trust instantly. |
| "¿Algo no cuadra?" and "Cuadrar con mi saldo" | The universal trust repair. |
| 3 suggested limits (from ≥14 days of data) | Delivers value only after data exists, as decided. |
| Weekly digest plus the push set in §8 with caps | The re-engagement engine. |
| Source-health monitoring plus OEM battery fixes | Silent capture failure is the #1 hidden churn cause on Android. |
| Privacy screen with the discard counter | Privacy is the selling point, so make it visible. |

### v1.1 (4–10 weeks after)
| Item | Reason |
|---|---|
| Trips (pot, dates, multi-currency, shared trip expenses) | Rare event (2–4/year). Ship before the December/January travel season, not on day 1; foreign charges already work as normal rows. |
| Desktop link for email forwarding (Outlook, other providers) | A one-time task for the minority not on Gmail. |
| PDF parsers for Banco de Bogotá, Lulo, Nequi, others | Long tail, prioritized by user demand. |
| Opt-in "compartir la forma del aviso" to improve the template pack | Scales coverage; needs privacy review first. |
| Home-screen widget (Disponible + per day) | The highest-leverage glance surface, but not needed to prove the loop. |
| Savings goal suggestions ("te sobró X tres ciclos seguidos") | Needs cycles of history. |
| Retroactive rule application UI | Useful, but the in-prompt option covers most needs. |

### Never
| Item | Reason |
|---|---|
| AI/ML categorization or "smart" parsing | Breaks determinism and the product constraint; users hate misfires. |
| A generic money-number detector in notifications | Explicitly the thing users hate. |
| Debt simulators, scenarios, wishlists, affordability calculators | Built before, and nobody used them. |
| Health score, dashboards, charts tab | Creates conflicting answers to "am I on track?". |
| Budgets for every category / zero-based budgeting | Too much setup and too many concepts. |
| OCR, voice, chat capture | ≈0% observed usage. |
| Couples/shared mode | Out of scope, and it doubles every concept. |
| Streaks, badges, gamification | Optimizes opens, not outcomes, and cheapens the tone. |
| Reading SMS | Play Store policy risk and redundant with notifications. |
| Sending money or collecting debts on the user's behalf | Regulatory scope; the app only drafts the WhatsApp text. |

---

## 12. Success metrics and first risks to test

### North star
**Weekly users who viewed a Disponible backed by ≥1 automatic capture in the last 7 days.** It combines trust, automation and habit.

### Activation funnel (targets)
| Step | Target |
|---|---|
| Install → sees their Disponible (step 5) | ≥ 85% |
| → enables a capture source (notifications / Gmail / PDF) | ≥ 60% |
| → **first automatic transaction within 48 h** (activation) | ≥ 50% (vs 33% "ever recorded" today) |
| → answers ≥ 5 Revisar cards in week 1 | ≥ 40% |
| D7 retention (opened on ≥ 3 distinct days in week 1) | ≥ 35% |
| W4 retention | ≥ 25% |

### Quality metrics
- **Automation rate:** ≥ 85% of transactions captured automatically.
- **Wrong auto-captures** (the user edited the amount or direction of an auto-captured row): **< 0,5%**. This is a hard guardrail.
- **Revisar load:** median < 2 cards/day by week 3.
- **Duplicate rate after PDF import:** < 0,2%.
- **"Cuadrar con mi saldo" usage:** tracked as a trust-failure signal. If > 20% of users need it per cycle, the math is wrong.
- **Bill reminders:** % of bills paid on or before the due date among reminded users.
- **Concentration:** no single user holds > 10% of the data at 200 users (today one user holds 75%).

### Risks to test first (in order)
1. **Android notification-access acceptance.** Build the explainer plus the permission flow first and test it with 15 target users on Xiaomi, Samsung and Motorola. If acceptance is < 50%, reconsider putting PDF or Gmail as co-primary on Android.
2. **Google restricted-scope verification for Gmail.** Start the security assessment now. Without it, iPhone has no automatic path; if it slips, iPhone launches PDF-first.
3. **Template brittleness.** Collect ~30 real notification samples per bank (from the team and volunteers) and measure full-match rate. Run a 2-week diary study to observe wording drift. The template-pack pipeline must exist before launch.
4. **Disponible comprehension.** Run a 5-second test on Inicio: "¿Cuánto puedes gastar hoy?" Target ≥ 80% correct. Test the card-payment copy separately ("¿Por qué no bajó tu Disponible cuando pagaste la tarjeta?").
5. **Balance-anchor honesty.** Do users know their balance? Measure the "No sé exacto" rate and the size of the first-week "Cuadrar" corrections.
6. **Background listener survival on OEM Android.** Run a 7-day soak test on the top 5 device models sold in Colombia, and measure heartbeat gaps.
7. **Cuotas question fatigue.** Is ≥ $300.000 the right threshold? Measure the answer rate, and the PDF corrections where a purchase we assumed was 1 cuota was actually split.
8. **Play Store policy review** for notification-listener use in a finance app (prominent disclosure, data-safety form). Submit an internal build early to surface rejections.
