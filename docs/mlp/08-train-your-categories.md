# "Enséñale a Zeta" — training categorization from the phone (2026-09-27)

## Principle: train merchants, not transactions
The eval showed 93–95% of transactions carry their merchant's usual category. So the unit of teaching is the **merchant**: one answer fixes every past and future transaction from it. Transaction-level answers are only for the exceptions (Rappi for the dog).

"Training" never means retraining a model. Each answer writes deterministic data the engine uses directly:
- **merchant → default category** (the existing destinatario default category),
- **merchant → exception policy** (below),
- **examples** that the small LLM receives for new merchants (the eval showed they make its confidence trustworthy).

## Three surfaces

### 1. Sort session (the visual one) — "Ordenar en 1 minuto"
Entry: Revisar, when ≥5 merchants are still uncertain, and a card in the weekly digest.
- One **merchant card** in the centre: name as the bank writes it, how many transactions and how much ("Rappi · 14 movimientos · $610.000").
- **4 drop zones** around it: the top 3 suggestions + "Otra…". Only 4, never all 25 categories: small phones, thumbs, and the suggestions are right ~84% of the time in the top 3.
- **Drag or tap** a zone; haptic tick; the card flies in and shows the consequence: "14 movimientos → Domicilios".
- A session is 10 cards, about a minute; progress bar "8 de 10". Skipping sends a card to the back.
- **Undo** toast after every drop; everything reversible from the merchant detail.

### 2. Exceptions per merchant — "¿Siempre es así?"
After a drop on a merchant with mixed history, one question with three answers:
- **Siempre** → auto-apply, never ask.
- **Casi siempre** → apply the default, but ask when a rule fires: amount outside the usual range, or a user-chosen condition ("si pasa de $80.000, pregúntame").
- **Depende, pregúntame** → never auto-apply; every transaction goes to Revisar with the merchant's usual categories as the chips.

That's how Rappi → Domicilios coexists with Rappi → Mascotas: default Domicilios, "Casi siempre", and the dog-food orders are either caught by the amount rule or corrected in one tap, and a correction adds that category as a second chip for next time.

### 3. "Lo que Zeta sabe" (Ajustes › Categorías)
The engine made visible and editable:
- **Headline:** "Reconozco 48 comercios · 92% de tus movimientos se clasifican solos."
- **By category:** each of the 25 categories lists the merchants that feed it ("Domicilios: Rappi, iFood, JYD Hermanos"). Long-press a merchant to move it; it's the same drag-to-zone interaction, reused.
- **Needs a look:** merchants with conflicting history or a recent correction.
- Per merchant: policy (Siempre / Casi siempre / Pregúntame), rename, merge ("DLO*GOOGLE YouTube" and "GOOGLE *PLAY YOUTUBE" are the same), and "aplicar a los anteriores".

## Why this beats the drag-everything idea
- Dragging each transaction doesn't scale (40–100 a month) and trains nothing new after the first time a merchant is seen. Dragging **merchants** does, and the queue empties within the first week.
- Free-floating objects over 25 zones are slow and error-prone on a phone. The fun is kept (drag, haptics, the card flying into place), but the precision comes from showing only the likely zones.

## Metrics
- **Automation rate** (share of transactions categorized without a question): target 90% by week 3.
- **Correction rate** on auto-categorized rows: under 5%; a merchant with 2 corrections in a month drops to "Casi siempre".
- **Sort session completion**; the queue should be empty for most users by day 10.

## MLP cut
- **v1:** Revisar card with 3 chips + "¿Siempre para X?" (already in the proposal), exception policy, "Lo que Zeta sabe" as a list.
- **v1.1:** the drag-to-zone sort session and drag inside "Lo que Zeta sabe". Build it once the queue exists and we can measure whether people come back to it.
