# 14 — Voice batch capture + "Cuadrar con mi saldo" (plan)

Status: **decided 2026-10-03** (decision log S9-1…S9-5). Not yet in `10-build-plan.md`. Only slice A1 touches v1; the rest is v1.1.

## What already exists in the spec (don't re-plan it)

| Piece | Where | State |
|---|---|---|
| Single voice/text expense ("almuerzo 45 mil"), deterministic parser, offline | C5, S4-4, `06` §2 | v1, M6 |
| Claude Haiku only for text the parser can't segment, online only | S4-4 | v1, M6 |
| "¿Algo no cuadra?" → **Cuadrar con mi saldo** (type real balance → "Ajuste de saldo" row, undoable) | D14, `03` §9, command `adjustBalance` | v1, **not built yet** (engine has `anchor-statement-balance`, `balance_as_of`, no `adjustBalance`) |
| Balance notices check, never auto-adjust | S4-5 | v1 |
| Plus gating (per-use cost features), billing in v1.1 | S6-1/2/6 | v1.1 |

So the owner's ask is two **extensions**: (A) the adjustment becomes a *placeholder that the statement later explains*; (B) voice becomes *multi-item, mostly amount-less, with a review flow*.

---

## A. Cuadrar con mi saldo → "ajuste por identificar" → explicado por el extracto

### Flow
1. Disponible → ¿Algo no cuadra? → Cuadrar con mi saldo → user types the real balance of an account.
2. App shows the gap ("Te faltan $170.000 por registrar") and offers three choices: **Dejarlo así** (default) · **Ponerle categoría ahora** · **Dejarlo por identificar**. The first two just set/skip a category; all three create the same row.
3. Row = a normal movement (visible in Movimientos, undoable) labelled "Ajuste de saldo", **counts in Ya salió** (money really left, so the per-day number drops) and shows in metrics under a system category, default **"Desfase"** (renameable), until the user names it (S9-3).
4. Later a **tier-1 statement (PDF)** for that account lands. The engine recomputes the adjustment: rows the statement brings that we never saw, dated inside the adjustment's window, *consume* it.
   - `remaining = gap − Σ(new unmatched statement rows in window)`
   - remaining > 0 → adjustment shrinks to `remaining` (usually fees, interest, small cash).
   - remaining ≤ 0 → adjustment is deleted; any overshoot is just real data (statement wins by tier).
5. Result card in Revisar / push "Extracto listo": **"Estos fueron los gastos que te desfasaron"** — list of the new rows that explained the gap, plus "quedan $X sin explicar" if any.

### Rules (consistent with decision log)
- Statement is bank fact → higher tier wins; the user's category on the adjustment survives if it remains partially open (latest edit per field).
- The recompute is **derived and idempotent** (like S1-3 summaries): re-importing the same PDF gives the same result; flag "actualizado con el extracto".
- Never auto-created: S4-5 stays (balance notices only *offer* it).
- Trust metric from `03` §9 applies: > 20% of users per cycle using Cuadrar = the math is wrong.

### Schema (additive only)
Side table, not an enum value, so v1 web keeps working and no `_enc` column:

`balance_adjustments(id, user_id, account_id, transaction_id, declared_balance, gap_amount, window_start, window_end, status open|partial|explained|accepted, explained_amount)` → table #16 (frozen list S2-4 gets one more). Confirm with `supabase-migrator` + phone schema migration. Window start = account's previous `balance_as_of`; end = the moment the adjustment was made.

### Engine
- `adjustBalance` (already in the plan, §3 list): extend payload with `{ accountId, realBalance, categoryId?, pending }`; computes gap vs engine balance, inserts the movement + side row, sets `balance_as_of`. Contract tests on both adapters.
- `explainAdjustmentsFromStatement` — called from `record-statement` after rows are inserted; pure function over (adjustment, new rows). Runs on phone and server with the same code.

### Plan tier
**Free** (S9-3). It's the Disponible trust repair (the promise is free, S6-1). The explanation step rides on statement import, which already has its own free limit (3 PDFs/month).

### Slices
1. v1 (M-whatever owns Disponible): `adjustBalance` + the 3-choice sheet + side table with `open` only. (This is already owed.)
2. v1.1: `explainAdjustmentsFromStatement` + result card + push copy.

---

## B. Voz en lote ("café, desayuno, snacks, almuerzo de todos")

### The hard part: the example has **no amounts**
"Me compré un café, desayuné, compré cosas en la máquina, pagué el almuerzo de todos" gives items and a hint of sharing, not money. So the deliverable is a **draft list the user finishes**, not an auto-save.

### Flow
1. "+" → mic (existing on-device speech-to-text) → transcript, editable.
2. **Segment** into draft items: `{label, amount?, categoryId, shared?, timeHint?, accountHint?}` (S9-1: code splits, Jev labels).
   - **Code, always, offline:** splitter (commas, "y", "luego", "después") + amount/slang extraction ("45 lucas") + merchant/keyword → category. Items without amount stay empty.
   - **Jev, when on:** per item, one `choice` call for category (from the user's categories), `noul` for shared, `choice` for account. Online or on-device per Jev's runtime; if off/slow/down, the keyword mapping above stands in. Jev never produces amounts.
   - New Jev schema to define: `voice-item` (label → category / shared / account). One schema per use, trained on the phrase corpus below.
3. **Review list**: one row per draft item, amount empty = highlighted. Remove / merge / edit label.
4. **Detalle por gasto**: stepper (Siguiente) through each item — amount, category, account, shared, trip. An amount-less movement can't exist, so before leaving the screen each unfilled item is either given an amount **or** sent to **Cuadrar con mi saldo** (S9-4): the user types the real balance, and one adjustment row is created whose notes list the forgotten items (labels only, no amounts). The statement later explains it (section A). No drafts survive the screen.
5. **Shared item** ("pagué el almuerzo de todos"): asks who/how many, creates the split using existing Te deben mechanics (don't build new debt logic).
6. **Commit**: one `captureTransaction` command per item (`source: voice`, tier 3, `MANUAL`-class authority), queued together. No `batch_id` column; undo after commit is per-row via Detalle.

### Dedup against what's already captured (high value, small)
Many "forgotten" items were already captured by a bank notification (card coffee) and just lack a category. Before committing, match each draft against today's tier-1/2 rows in Revisar (same day, amount if given, category/merchant hint). Offer "Ya está registrado: $4.500 — ponerle categoría" instead of a duplicate. Reuses the reconciliation scoring in `@zeta/shared`; weak matches go to Revisar per the existing conflict rule.

### Privacy / AI constraints (S4-3, S9-1)
- If Jev runs server-side, only the **transcript text + the user's category names** leave the phone — no balances, account numbers, or people names (shared-split people are picked on-device).
- Counted in Ajustes › Privacidad (K6); same off switch as raw notice text.
- Endpoint (if server-side) `/api/v2/voice-batch`: bearer auth, Zod-validated output, hard cap on items (e.g. 12) and input length, per-user daily cap.
- Offline always works with the deterministic path — AI is never required.

### Plan tier
**Jev labelling: free at launch with a daily cap (trial), 100% Plus once billing ships (S9-2).** The deterministic splitter and the review flow stay free, so the "forgot to register" scenario is always solvable. The cap value and the Plus switch-over live behind one server flag so no app release is needed.

### Slices
1. **Review flow + deterministic splitter** (free, offline, no server): fits right after M6's single-voice parser. Sheet/stepper UI needs a Claude Design screen first.
2. **Dedup against Revisar**.
3. **Jev `voice-item` labelling** (v1.1): free with daily cap, flipped to Plus with billing.
4. Shared-item split wiring (depends on Te deben commands).

### Eval before shipping the AI path
Same discipline as `07-category-eval-baselines.md`: ~40 real Spanish/Colombian transcripts (slang, "lucas", "palos", chained items) → measure item recall and category accuracy; the deterministic path sets the baseline Jev has to beat, and the same corpus trains the `voice-item` schema.

---

## Decisions taken (2026-10-03)
1. AI = Jev-style System One models, deterministic first (S9-1); voice labelling free with daily cap at launch, Plus-only after (S9-2).
2. Adjustment counts in Ya salió, system category "Desfase" in metrics (S9-3).
3. Amountless voice items: fill the amount, or send them to Cuadrar con mi saldo as notes (S9-4).
4. Scope: A1 in v1, everything else v1.1 (S9-5).

## Still open
- Final name of the default adjustment category ("Desfase" vs "Sin identificar").
- Daily cap value for the free trial.
- Whether Jev runs on-device or server-side for `voice-item` (decides the privacy copy).

## Gates when this is built
`zeta-v2-reviewer` on UI + engine; `supabase-migrator` for table #16; contract tests on sql.js + PGlite for `adjustBalance` and `explainAdjustmentsFromStatement`; widget rules (`13`) for any new Inicio card; a `voice-item` schema + eval corpus for Jev.
