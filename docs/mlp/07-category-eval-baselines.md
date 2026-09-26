# Category suggestion eval — rules vs LLM vs Jev (2026-09-26)

Harness: `scripts/jev-eval/` (no data in the repo). One user's human-confirmed categories: 216 description+category pairs from 999 transactions, 98 category options. Split by first-seen date: before 2026-08-01 = "already learned" (130), from 2026-08-01 = **test (86)**.
All model methods get the same **masked** input: bank text with amounts, dates, times, card/account numbers, payment keys and people's names hidden, plus in/out and account type. "+ examples" adds up to 5 earlier masked transactions with the category the user gave them.
The LLM runs were done by zero-context Claude agents that saw only that input (no labels, no repo).

## Results (test, n = 86)

| Method | Answers | Exact | Right parent | Right in top 3 | Pre-select rule that holds ≥95% |
|---|---|---|---|---|---|
| Built-in rules (`autoCategorize`, cold) | 23% | 12% | 17% | 12% | none |
| Learned history (merchant-word match) | 52% | 26% | 33% | 34% | none (88% at 19% coverage) |
| LLM cold | 100% | **56%** | 64% | 74% | none (89% at 43% coverage, ≥0.5) |
| LLM + 5 examples | 100% | **57%** | **72%** | **77%** | **conf ≥ 0.7 → 23% of rows at 95%; ≥ 0.8 → 19% at 100%** |
| Jev cold (option names only) | 100% | 27% | 33% | 35% | none (≤75% at any threshold) |
| Jev + 5 examples | 100% | 50% | 53% | 53% | none (86–88% at 30–50% coverage) |
| Jev cold + category descriptions | 100% | 31% | 35% | 40% | none |
| **Jev + examples + descriptions** (best Jev) | 100% | **55%** | 57% | 60% | none: ≥0.9 → 36% of rows at 90%; ≥0.95 → 31% at 89% |

Subsets (exact accuracy):
- **Merchants never seen before (41):** rules 7%, learned history 0%, LLM cold 56%, LLM + examples 51%, best Jev 39%.
- **Rows the user had to correct by hand (59):** rules 7%, learned history 3%, LLM cold 53%, LLM + examples 51%, best Jev 41%.

Jev run details: `jev-latest` (jev-1.13), 344 calls, p50 140 ms / p95 183 ms, ~2,000 input tokens per call with 98 described options. At the official $0.042 per million input tokens (output free) that's about **$0.00008 per transaction**; the whole eval cost about $0.04. Category descriptions were written generically (no merchant names) to avoid tuning on the test answers. Re-running gave the same numbers within ±1–2 points.

## What it means
1. **A model is roughly 4–5× better than the rules engine** on exact category, and it gets the right answer into the top 3 about **75%** of the time. That fits the Revisar card design (3 suggested chips, one tap).
2. **Auto-applying is only safe for a small slice.** Even the best method reaches ≥95% precision on only ~20% of rows. So: suggest always, pre-select only above a high threshold, never write silently.
3. **User examples mostly improve confidence, not accuracy.** They make the model's confidence trustworthy (the only method with a usable ≥95% threshold), which is what the pre-select rule needs.
4. **The ceiling is the data, not the model.** The same descriptor carries different categories on different days (e.g. `COMPRA EN RAPPI COLO` → Delivery / Mascotas / Medications / Subscriptions), and transfers to accounts say nothing about their purpose. Asking once per ambiguous merchant ("¿Rappi siempre es Domicilios?") matters more than a better model.

## Bar for Jev (set before the run)
To be worth adopting over a small LLM, Jev must, on this same test set:
- match **~56% exact / ~75% top-3**, and
- give a threshold with **≥95% precision on ≥20% of rows**,
while being cheaper and faster. If it only matches accuracy but its probabilities are better calibrated, it still wins for the pre-select rule.

## Jev verdict for categories
- **Accuracy:** the best Jev setup (55%) matches the LLM on exact category only when it has the user's examples, and it's clearly weaker on first-time merchants (39% vs 51–56%). It knows less about Colombian merchant names on its own.
- **Top 3:** Jev puts nearly all probability on one option, so its top 3 adds little (60% vs 77%). That's worse for the three-chip Revisar card.
- **Confidence:** it never reaches 95% precision; its high-confidence answers plateau around 85–90%. The errors are confident ones, mostly where the user's past examples point one way and this time was different. **It misses the bar.**
- **Speed and cost:** excellent. ~140 ms and a fraction of a cent per 10,000 transactions.

**Decision:** don't use Jev for category suggestions now. Use deterministic rules + "¿Siempre para X?" for known merchants, and a small LLM once per *new* merchant (cached), which is low volume. Keep Jev for decisions with few options and a clear yes/no or small set (notification type, "same transaction?", "¿es del viaje?"). Each needs its own eval; the dedup data already exists. Untried idea that could still help Jev here: ask the parent category first (≈15 options), then the child.

## Caveats
One user, 86 test rows, noisy labels; the LLM agents ran on this session's default model, which isn't necessarily the small model production would use. Treat the numbers as direction, not precision.

---

## Round 2 — compact list of 25 categories + descriptions tuned for Jev (2026-09-26)

**Why:** fewer, clearer categories should help any classifier, and make budgets and limits more meaningful. The user's 98 categories were mapped to 25 (one bare "Lifestyle" label spanning several groups was dropped as ambiguous; no test rows affected). Jev got descriptions written the way TypeSafe recommends (what each option includes and what belongs elsewhere), naming only merchants from the pre-August training period or universally known brands.

**How much is really predictable:** 93% of this user's transactions carry their merchant's usual category (95% with 25 categories). The rest are deliberate exceptions, like a delivery app used for pet food or medicine. On the test period, 81% (98 categories) / **87% (25 categories)** match the merchant's usual category, which is the ceiling for any engine that doesn't ask.

| Method (25 categories, test n = 86) | Exact | Right group | Top 3 | New merchants (41) | ≥95% precision rule |
|---|---|---|---|---|---|
| Built-in rules | 17% | 22% | 17% | 10% | none |
| Learned history | 28% | 31% | 34% | 0% | none |
| Jev cold, names only | 29% | 35% | 45% | 22% | none |
| Jev cold + tuned descriptions | 45% | 51% | 57% | 32% | none (≥0.9 → 40% at 85%) |
| Jev + examples + tuned descriptions | 51% | 59% | 60% | 32% | none (≥0.9 → 40% at 91%) |
| LLM cold (names only) | 66% | 76% | 81% | 66% | none (≥0.8 → 15% at 92%) |
| **LLM + 5 examples (names only)** | **69%** | **81%** | **84%** | **68%** | **≥0.8 → 24% of rows at 95%** |

Jev: 344 calls, ~1,200 input tokens per call, p50 162 ms.

**Findings**
- **Fewer categories clearly helps the LLM:** 57% → 69% exact, 77% → 84% top 3. That's close to the 87% ceiling, with no descriptions at all.
- **Jev improves with descriptions (29% → 45% cold) but not past the LLM.** Its typical misses are a catch-all option attracting uncertain cases ("Otros") and literal readings (a restaurant becomes "Mercado" because both are food).
- **Tuning stopped here on purpose.** Looking at Jev's test errors and rewriting descriptions to fix them would be tuning on the answers. Doing it properly needs a separate validation set (more labelled data, or other users' data with consent).

**Decision (unchanged, now stronger):** categories = deterministic rules and "¿Siempre para X?" for known merchants, plus a small LLM once per new merchant (cached). **Adopt the compact list for the MLP:** 25 categories are enough for limits and spending views, and they make any engine better.

### Proposed compact category list (MLP)
- **Comida:** Mercado · Restaurantes y café · Domicilios
- **Transporte:** Apps y taxis · Transporte público · Carro y moto
- **Hogar:** Vivienda · Servicios · Casa y mantenimiento
- **Salud** · **Mascotas** · **Suscripciones** · **Compras**
- **Ocio:** Entretenimiento y hobbies · Viajes
- **Personas:** Regalos · **Personal:** Cuidado personal y deporte · **Educación**
- **Finanzas:** Pago de tarjeta o crédito · Intereses, comisiones e impuestos · Préstamos entre personas · Ahorro e inversión
- **Ingresos:** Salario · Otros ingresos
- **Otros:** Efectivo y otros

In the MLP, *Pago de tarjeta o crédito* and own-account transfers are flow types (neutral to Disponible), not spending categories, and *Préstamos entre personas* is the Te deben ledger. Users can still add their own categories; these are the defaults.
