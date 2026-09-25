# Brief for the zero-context experience designer

> This is the only input the agent gets. It deliberately contains no existing app vocabulary, screens or code.

## Your task
Design the **complete experience** of a mobile personal-finance app, from the app-store page to week 4 of daily use. You're designing from scratch: there's no existing app to respect. Be opinionated, concrete and critical. Where a choice is a bet, say so.

## The user
Colombian young professionals (roughly 23–35), paid monthly or twice a month, with 1–3 banks (Bancolombia dominant; also Nu, Davivienda, Banco de Bogotá, Nequi, Falabella, Lulo), usually one or two credit cards. They feel money "disappears" between paydays. They're not finance nerds and won't learn jargon. Spanish only (Colombian register, tú).

## Job to be done
"Tell me how much I can still spend until my next payday, without me having to type anything, and never let a bill surprise me."

## The one number: **Disponible**
Safe-to-spend until the next payday, also shown per day.
`Disponible = income expected this cycle − upcoming bills and card/instalment payments − savings goal − money already out this cycle`.
- It follows **cash reality**: any money that leaves counts, including money lent to friends.
- Every screen either answers with this number or explains something that moves it.

## Colombian realities you must design for
- **No usable open banking.** Data comes from: (a) bank **push notifications** on Android (~85% of the market), (b) bank **alert emails** (Gmail dominant), (c) monthly **statement PDFs** (often password-protected with the national ID number), (d) manual entry for cash.
- **Credit cards and "cuotas".** A purchase can be split into 1–36 monthly instalments with interest. What matters this month is the instalment, not the full price. **Paying the card is not spending**; the purchase was.
- **Splitting with friends is very common.** One person pays the whole dinner or trip and others pay back later, often late or never.
- Payday is usually the 15th and/or 30th. Many bills are monthly (rent, phone, streaming, gym, loans).

## Decisions already made (non-negotiable)
1. **Native mobile app only.** A small web page may exist only for one-time desktop tasks.
2. **Capture, Android:** reading bank app notifications, done right:
   - opt-in; the user picks which apps' notifications may be read, and everything else is dropped on the device;
   - ships with exact, deterministic templates per bank;
   - unknown notifications from chosen apps go to a **training inbox** where the user marks amount / merchant / card / direction, and this becomes a template for that sender;
   - auto-capture only on a full template match, partial matches go to review;
   - OTP codes, promos and balance messages are recognized and ignored;
   - **never** a generic "any number that looks like money" detector. Users hate apps that misfire on random numbers.
3. **Capture, iPhone:** "Connect Gmail" read-only (bank senders only), plus statement PDF. Optional later upgrade: a desktop link to set up email forwarding.
4. **Statement PDF import** is always available for history backfill and to reconcile against notifications (no duplicates).
5. **Categorization is deterministic, no AI/ML.** Rules learned from user answers ("Rappi → Domicilios, always?").
6. **Category limits:** 3 by default, suggested from real history after 2–4 weeks (never asked for before there's data). The user can add more.
7. **"Te deben" (money lent) is a first-class ledger**: per person, with a running total, repayments that close it, and a clear signal when lending is getting too high ("¿deberías parar de prestar?"). When you pay for a group, only your share is *spending*; the rest goes to Te deben. Disponible still drops by the full amount and shows "+$X cuando te paguen".
8. **Trips:** a trip is a separate pot with its own amount and dates. Spending inside it doesn't lower the monthly Disponible. Friends' shares of trip expenses go to Te deben. Trips can be in other currencies.
9. **Bills:** recurring payments are auto-detected from history and confirmed by the user. Push reminder the day before. Card statement payments and instalments are bills.
10. **Weekly digest** (push + in-app): rule-based, one short verdict plus 2–3 lines.
11. Single user (no couples mode). Privacy is a selling point: data is encrypted, and notification text from non-chosen apps never leaves the phone.

## What we know from the current product's users
- 45 sign-ups, only 33% ever recorded a transaction, and one power user holds 75% of all data. **Activation is the problem, not features.**
- ~90% of real transactions arrived automatically (bank emails and PDFs); manual entry ~9%; OCR/voice/chat capture ≈ 0%.
- Categorizing is the most frequent action.
- Features nobody used: debt-payoff simulators, budget scenarios, wishlists, "can I afford it" calculators, complex dashboards with health scores and many widgets.
- The biggest complaints: too many concepts and screens, conflicting "am I on track?" answers across screens, setup (budgets, email forwarding) before seeing any value, numbers that were wrong (card payments counted as income or spending), and every list row behaving differently when tapped.

## Deliverable (Markdown, in Spanish UI copy but English explanations)
1. **Principles** (5–8) that drive every decision.
2. **Information architecture**: tabs and screens, what's on each, and what is deliberately *not* in the app.
3. **Onboarding, step by step** to the first "aha", with target time and drop-off risks. Show what the user sees at each step, with exact copy for key lines. Cover Android and iPhone paths and what happens with zero data vs after a PDF backfill.
4. **Day 1 / Week 1 / Week 4** journeys: what the app does proactively, what the user does, and how long it takes.
5. **Core screens** in detail (Home, transaction list and detail, review/training inbox, bills, Te deben, trips, category limits, settings), with low-fi ASCII wireframes for the 4 most important ones.
6. **The notification-training flow** in detail, including edge cases (a new bank format, the same bank changing its wording, a refund, a declined purchase, a transfer between my own accounts, a card payment, an instalment purchase, a foreign-currency charge).
7. **How Disponible is computed and explained** to the user: states (vas bien / cuidado / te pasaste), how it handles cuotas, card payments, Te deben, trips and irregular income, and what it shows when data is missing.
8. **Notifications and re-engagement**: every push the app sends, its trigger and copy, and frequency caps.
9. **Empty, error and trust states**: duplicate detection, wrong categorization, missing notifications, and how the user fixes a wrong number in ≤2 taps.
10. **Consistency rules**: one row grammar, one verdict language, one way to edit.
11. **MLP cut line**: what ships in v1 vs v1.1 vs never, with a one-line reason each.
12. **Success metrics** and the risks you'd test first.

Keep it tight: dense, no filler, around 4,000–7,000 words.
