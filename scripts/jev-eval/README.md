# Jev category eval

Compares category suggestions on your own labelled transactions:

| Method | How it's produced |
|---|---|
| Built-in rules (cold) | `autoCategorize()` from `@zeta/shared`, no user rules |
| Nearest neighbour (learned) | Deterministic match on merchant words against your earlier transactions |
| LLM cold / LLM + examples | A zero-context Claude agent reading the same masked input (predictions file) |
| Jev cold / Jev + examples | TypeSafe Jev `Choice` over your categories (needs `jev-client.ts`) |

Test set = everything first seen on or after `JEV_EVAL_SPLIT` (default `2026-08-01`); earlier rows are "what the app already learned" and feed the examples.

## Run it on your computer

1. **Export the data** (it contains decrypted bank text, so keep it outside the repo):
   - In the Supabase SQL editor, run `extract.sql` with `:user_id` replaced by your user id. Download the result as TSV with the header `descr label dir acct n first src`, saved as `~/jev-eval/data.tsv`.
   - Run the commented `cats.json` query at the end of `extract.sql` and save the JSON object as `~/jev-eval/cats.json`.
2. **Implement `jev-client.ts`** against TypeSafe's API reference (one `Choice` question: `state` = the JSON object, `options` = labels; return the choice, its confidence and the probability map), then set `IMPLEMENTED = true`. Claude Code on your machine can do this with the docs open.
3. **Run:**
   ```bash
   export TYPESAFE_API_KEY=...      # your temporary key
   JEV_EVAL_DIR=~/jev-eval npx -y tsx scripts/jev-eval/eval.ts
   ```
   ~170 calls (86 test rows × cold / with examples).

## What leaves your machine
Only `jevState()`: the bank description with amounts, dates, times, card/account numbers, payment keys and people's names masked (`mask()`), money in/out, account type, and — for the "+ examples" variant — up to 5 of your earlier masked descriptions with the category you gave them. Check `JEV_EVAL_EXPORT=1` output (`items-*.json`) to see exactly what would be sent.

## Other modes
- `JEV_EVAL_EXPORT=1` writes `items-cold.json` / `items-examples.json` (the exact masked inputs).
- `JEV_EVAL_PREDS=name=file.json,...` scores predictions made elsewhere: `[{ "id", "label", "confidence", "top": [..] }]`, `id` = test index.
