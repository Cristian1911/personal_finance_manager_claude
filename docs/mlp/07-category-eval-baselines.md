# Category suggestion eval — baselines (2026-09-26)

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
| Jev cold / + examples | — | pending (run locally, see `scripts/jev-eval/README.md`) | | | |

Subsets:
- **Merchants never seen before (41):** rules 7%, learned history 0%, LLM cold 56%, LLM + examples 51% (irrelevant examples slightly mislead).
- **Rows the user had to correct by hand (59):** rules 7%, learned history 3%, LLM cold 53%, LLM + examples 51%.

## What it means
1. **A model is roughly 4–5× better than the rules engine** on exact category, and it gets the right answer into the top 3 about **75%** of the time. That fits the Revisar card design (3 suggested chips, one tap).
2. **Auto-applying is only safe for a small slice.** Even the best method reaches ≥95% precision on only ~20% of rows. So: suggest always, pre-select only above a high threshold, never write silently.
3. **User examples mostly improve confidence, not accuracy.** They make the model's confidence trustworthy (the only method with a usable ≥95% threshold), which is what the pre-select rule needs.
4. **The ceiling is the data, not the model.** The same descriptor carries different categories on different days (e.g. `COMPRA EN RAPPI COLO` → Delivery / Mascotas / Medications / Subscriptions), and transfers to accounts say nothing about their purpose. Asking once per ambiguous merchant ("¿Rappi siempre es Domicilios?") matters more than a better model.

## Bar for Jev
To be worth adopting over a small LLM, Jev must, on this same test set:
- match **~56% exact / ~75% top-3**, and
- give a threshold with **≥95% precision on ≥20% of rows**,
while being cheaper and faster. If it only matches accuracy but its probabilities are better calibrated, it still wins for the pre-select rule.

## Caveats
One user, 86 test rows, noisy labels; the LLM agents ran on this session's default model, which isn't necessarily the small model production would use. Treat the numbers as direction, not precision.
