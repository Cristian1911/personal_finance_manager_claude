# Optional AI assist — where Jev (and a small LLM) earn their place (rev. 2026-09-26)

## What Jev is (from public write-ups; official docs were unreachable from this environment — verify)
- TypeSafe's first **System One model**, early access since 2026-09-15. It is **not an LLM**: it doesn't generate text.
- You send a **state** (text or JSON) plus typed **questions**, answered in parallel in one call:
  - **Choice**: pick one of an explicit list (≤255 options), returning the full probability distribution + confidence.
  - **Noul**: yes/no, returning a probability 0–1.
  - **Score**: a level on a scale, good for thresholds and ranking, not precise quantities.
- The output can't fall outside the schema (it can't invent an option), but it can pick the wrong one.
- **Can't** extract free-form values (amounts, names, spans) and is weak with raw numbers. The recommended pattern: get candidates with regex/code, let Jev pick.
- Reported **~$0.042 per million input tokens, output free**; **70–500 ms**. Spanish quality isn't documented.

## Rule (unchanged): AI proposes, deterministic code decides
- Probabilities feed thresholds in code: high confidence pre-selects a chip; anything else becomes a normal Revisar card. Nothing writes money data without a rule or the user.
- One interface in `@zeta/shared` (`DecisionModel` with `choice` / `noul` / `score`). Jev is one adapter; deterministic fallback when it's off, slow or down. Optional toggle in Ajustes; server-side kill switch per feature.
- Log every decision with `source = AI_SUGGESTION` + probability, and track acceptance per feature.

## Where Jev fits (ranked)

### 1. Near-duplicates and "is this the same thing?" — Jev's home turf
Idempotency keys stay deterministic. Jev judges only the **weak candidates** the scorer already produces, with a `Noul` "same real-world transaction?" on a JSON state of both records:
- notification ↔ email ↔ PDF row (different descriptors, dates ±days)
- transaction ↔ pending bill occurrence (tie-breaks when 2+ bills fit)
- incoming transfer ↔ open Te deben items (`Choice` among the person's open items + "ninguno")
- own-account transfer pairing
- **"¿Es del viaje?"** (`Noul`): the proposal gives every transaction during a trip a Revisar card; Jev can pre-answer most of them.

Earlier I said "only if measured". Given Jev's price and design, it moves to **v1.1**, after an offline eval.

### 2. Voice/text manual capture — now without a generative LLM
- Phone speech-to-text (already built, `expo-speech-recognition`) → text.
- **Code extracts** amount, date and slang ("45 lucas", "2 palos", "ayer") — numbers stay deterministic.
- **Jev picks** in one call: category (`Choice` from the user's ~100 categories), direction, account (`Choice`), "pagué por otros" (`Noul`), person (`Choice` from Te deben people + "otra"), trip (`Noul`).
- A small LLM remains only as a rare fallback for text the code can't segment at all.

### 3. Notification gatekeeper (from the bank apps the user chose)
A `Choice` over {gasto, ingreso, rechazada, código OTP, promoción, saldo, alerta de seguridad, otro}, sent with digits masked. It replaces keyword heuristics for *what kind* of message it is; templates still extract the fields. It also cuts useless training cards (promos that happen to contain "$").

### 4. Category suggestion for bank transactions — **tested: not Jev (see `07-category-eval-baselines.md`)**
Eval result: best Jev 55% exact but 39% on new merchants, weak top-3, confidence never reaches 95% precision. A small LLM did better (56–57%, 77% top-3, 95% precision on ~20% of rows). Use rules + ask-once for known merchants and a small LLM once per new merchant (cached). The original plan follows for reference.

The state is JSON: descriptor, canonical merchant if known, amount band, time, account type, and the user's categories for similar merchants. The output is a `Choice` of category with a probability.
- Only above a high threshold does it pre-select the Revisar chip. User rules and merchant defaults always win.
- Your point stands: raw descriptors are messy. So this goes **after** merchant resolution (#5), and it's measured on your 4,261 labeled transactions before shipping.

### 5. Merchant resolution (changed)
Jev can't invent a clean name. The new split:
- Code generates candidates (`cleanDescription` + token overlap against known destinatarios + a shared merchant dictionary).
- **Jev picks** (`Choice`: candidates + "comercio nuevo").
- Only a truly new merchant needs a name: code cleanup first, a small LLM for naming, then cached globally.

### 6. Template drafting for unknown formats (unchanged)
Labelling spans is generation-like, so it's not a Jev task. Keep a small LLM (or code heuristics) here. Volume is tiny: once per new format, plus the 95 unrecognized emails.

## Where it should NOT be used
Idempotency keys, Disponible, verdicts, balances, amounts or dates, the weekly digest. Never send names, full notification text or statement contents.

## Evaluate before building (free labeled data already exists)
- **Categories:** 4,261 transactions with user-confirmed categories + 266 rules. Measure top-1 accuracy and calibration (is 0.9 really right 90% of the time?) in Spanish.
- **Dedup:** 24 manual merges + 13 rejected matches + 10 auto-merges from reconciliation events.
- Go/no-go per feature: ≥95% precision at the pre-select threshold.

## Risks
- **Early access, 11 days old, single vendor.** Hence the `DecisionModel` interface and deterministic fallback. An open-source System One alternative (Laya, reportedly <1 GB RAM) was reported; it could be self-hosted, maybe on-device. Unverified.
- **Spanish quality unknown.** The eval above answers it.
- **Privacy:** the provider's data-retention terms need checking before sending any transaction state.
- The price is from third-party articles; confirm on the official page.

## MLP cut (revised)
- **v1:** #2 voice/text capture (code extracts, Jev picks) and #3 notification gatekeeper. Both are low-risk and directly reduce typing and false captures.
- **v1.1:** #1 near-duplicate/bill/repayment/trip judgments and #5 merchant resolution, each after passing its own eval. #4 category suggestions → small LLM per new merchant, not Jev (tested).
- **v1.1, LLM not Jev:** #6 template drafting.
