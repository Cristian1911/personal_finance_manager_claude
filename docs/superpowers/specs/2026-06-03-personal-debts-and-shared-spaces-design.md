# Personal Debts (lend/borrow tracker) + Shared Spaces — Design

- **Date:** 2026-06-03
- **Status:** Approved (brainstorming) → ready for implementation plan
- **Author:** Cristian + Claude
- **Scope of this round:** Feature 1 (Personal Debts) ships first. Sharing (2a trip-tags, 2b shared ledger) is sequenced after and recorded here at design level; 2b gets its own detailed sub-spec before implementation.

---

## 1. Problem

Two distinct needs:

1. **Lending tracker.** The user borrows money from a person (e.g. a sister) or lends money to a person (girlfriend, friend). A borrowed amount lands as an inflow but is **not real income** — it's a liability that must be paid back. The app must answer **"who do I owe, and who owes me?"** at a glance, and track repayment without inflating income metrics.

2. **Shared spaces (Splitwise-like).** Two app users (e.g. the user + girlfriend) split shared expenses on a trip and want to track "who owes whom" together.

These are **fully independent** features — no shared tables, no ordering dependency beyond engineering bandwidth.

---

## 2. Locked decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Shared-spaces data model | **Split ledger** (members share an explicit split ledger, *not* each other's raw bank transactions). True cross-user transaction visibility is a non-goal. |
| D2 | Build order | **F1 (personal debts) → 2a (trip-tags) → 2b (shared ledger).** F1 + 2a are parallelizable. |
| D3 | F1 model | **New `personal_debts` table**, destinatario-anchored (subscriptions pattern). Not LOAN accounts. |
| D4 | Person identity | **Reuse `destinatarios`** as the person anchor + add a non-PII `kind('merchant'\|'person')` discriminator. No parallel "people" entity. |
| D5 | F1 repayment | **Ad-hoc linking**, one unified "Personas" registry (Debo / Me deben). No mandatory installment schedules in v1. |
| D6 | F1 income exclusion | **Column on `transactions`** (`personal_debt_id` + `pd_role`), not a JOIN on the hot path. |
| D7 | Existing-transaction mapping | **Expand the "Vincular" action** so a transaction can be linked to a personal debt (origin or repayment), retroactively. |
| D8 | Mobile (sharing) | Shared spaces is **web-first**; mobile parity out of scope for sharing v1. (F1 *does* get mobile parity.) |

### Conceptual frame (why D3/D4 don't complicate destinatario)

**Identity vs. obligation.** A `destinatario` is the *who* — "an entity I transact with" — which already covers a person. A `personal_debt` is the *what* — the obligation/balance between me and that identity. The person stays a destinatario (identity layer, unchanged); the debt is a new sibling table that merely *references* it — exactly how `subscriptions` already reference destinatarios. Destinatario gains **no new behavior**, only a `kind` flag so the UI can separate Personas from Comercios and the import matcher can skip people.

---

## 3. Feature 1 — Personal Debts

### 3.1 Data model

**New table `personal_debts`** — plain (non-encrypted); `destinatario_id` FK already protects identity. Mirrors `supabase/migrations/20260527151641_create_subscriptions.sql`.

```
personal_debts
  id                    UUID PK
  user_id               UUID  → auth.users    RLS: (select auth.uid()) = user_id  (defense-in-depth too)
  destinatario_id       UUID  → destinatarios (the person)   ON DELETE RESTRICT
  direction             ENUM  borrowed | lent
  principal_amount      NUMERIC
  currency_code         currency_code
  outstanding_amount    NUMERIC   -- maintained = principal − Σ(linked repayments)
  opened_on             DATE
  due_date              DATE NULL
  status                ENUM  active | settled | cancelled
  origin_transaction_id UUID NULL → transactions   -- the inflow/outflow that created the debt (≤1)
  notes                 TEXT NULL
  is_demo               BOOLEAN DEFAULT false
  created_at, updated_at            (moddatetime trigger)
```

**`transactions` — add one column + one role enum** (plaintext):

```
transactions
  + personal_debt_id  UUID NULL → personal_debts
  + pd_role           ENUM('origin','repayment') NULL
```

One column, three jobs: (1) income exclusion, (2) repayment linkage / `outstanding_amount` recompute, (3) audit trail. Dedup inherited from the existing `idempotency_key` UNIQUE constraint.

**`destinatarios` — add `kind`:**

```
destinatarios
  + kind  ENUM('merchant','person') DEFAULT 'merchant'
```

Non-PII, but `destinatarios` is an `_enc` table (real `destinatarios_enc` + view + INSTEAD OF triggers) → **6-step migration via `supabase-migrator`** (view + triggers must pass `kind` through). Default `merchant` → every existing row unchanged.

### 3.2 Behavior

**Income / spend exclusion.** Add a predicate at the *same* two cached call sites that already exclude debt-account inflows:
- `getMonthlyCashflowCached()` — `webapp/src/actions/charts.ts:~190`
- `getEstimatedIncomeCached()` — `webapp/src/actions/income.ts:~90`

Rule: exclude a transaction from income/spend metrics when `personal_debt_id IS NOT NULL AND pd_role = 'origin'`. **Repayments (`pd_role='repayment'`) count normally** — paying back IS real cashflow. Single-column predicate keeps the hot path join-free.

**Repayment = a normal transaction, linked.** No separate repayments table.
- Pay down a `borrowed` debt → log an OUTFLOW, link it (`pd_role='repayment'`).
- Receive on a `lent` debt → log an INFLOW, link it (`pd_role='repayment'`).
- `outstanding_amount = principal − Σ(linked repayments)`, recomputed on every link/unlink.

**Lifecycle.** `active` → `settled` (outstanding = 0, auto or manual) or `cancelled` (written off / mistake). Reversible (re-open) since a repayment can be deleted.

**Multi-currency (v1).** Principal stays in its original currency; repayments tracked in their own currency; **no FX conversion**. Outstanding tracked in principal currency. FX normalization deferred.

**Overdue (v1).** `due_date` past + `status='active'` → flagged **on the Personas page only**. Not pushed to dashboard Attention Items in v1.

### 3.3 Existing-transaction mapping (unified "Vincular")

Two entry points, one mechanism (`personal_debt_id` + `pd_role`):

- Expand the existing **"Vincular"** action (today: tx → recurring occurrence) with a sibling **"Vincular a persona"** (tx → personal debt).
- The create-flow's "link origin transaction" and this Vincular path both call one helper: `linkTransactionToPersonalDebt(txId, debtId)` / `unlinkTransactionFromPersonalDebt(txId)`.
- **Role auto-inferred** from the two directions — no extra question:

  | debt direction | tx direction | inferred role | metric effect |
  |---|---|---|---|
  | Debo (borrowed) | INFLOW | `origin` (loan received) | excluded from income |
  | Debo (borrowed) | OUTFLOW | `repayment` | counts normally, outstanding↓ |
  | Me deben (lent) | OUTFLOW | `origin` (money I gave) | excluded from spend |
  | Me deben (lent) | INFLOW | `repayment` | counts normally, outstanding↓ |

- **Constraint:** ≤1 `origin` per debt (sets `origin_transaction_id`); everything else is a repayment.
- **Retroactive correctness:** linking/unlinking an `origin` changes whether it counts as income → the action calls `updateTag()` on the financial views so the dashboard corrects immediately (read-your-own-writes).

### 3.4 Surface — the Personas page

**New route `/personas`** — its own nav entry, separate from `/deudas` (which stays bank/credit-only). Mobile gets a matching stack route.

One registry, two sections, reusing the `DebtAccountCard` visual layout (`webapp/src/components/debt/`):

```
PERSONAS
  Resumen:  Debo 340k  ·  Me deben 180k  ·  Neto −160k

  DEBO (borrowed)                ME DEBEN (lent)
   🧑 Hermana   140k  vence ⚠     🧑 Novia    60k
   🧑 Andrés    200k              🧑 Carlos  120k
```

- **Per-person card** → expand: principal, outstanding, opened/due dates, linked repayment transactions, actions: **Registrar abono**, **Saldar**, **Editar**, **Cancelar**.
- **Create flow** (`+ Nueva cuenta con persona`):
  1. Pick person via `DestinatarioPicker` filtered to `kind='person'`, with inline "crear persona" (creates a destinatario with `kind='person'`).
  2. Direction (Debo / Me deben), principal + currency, opened date, optional due date, notes.
  3. Optionally link the origin transaction → sets `origin_transaction_id` + stamps that tx `pd_role='origin'`. If skipped, the debt is recorded without a cash movement (e.g. cash loan).
- **Empty state** answers "¿quién me debe y a quién le debo?" — the "Am I on track?" framing.

### 3.5 Plumbing

**Server actions** — new `webapp/src/actions/personal-debts.ts` (shape copied from `subscriptions.ts`):
- `createPersonalDebt`, `updatePersonalDebt`, `cancelPersonalDebt`, `settlePersonalDebt`
- `recordRepayment` (creates the linked tx + stamps `pd_role`, recomputes `outstanding_amount`)
- `linkTransactionToPersonalDebt` / `unlinkTransactionFromPersonalDebt`
- `getPersonalDebtsOverview()` → `{ iOwe:{total,byPerson[]}, owedToMe:{total,byPerson[]}, overdue[] }`
- All: `getAuthenticatedClient()`, defense-in-depth `.eq("user_id", user.id)`, `ActionResult<T>` returns, FK join to destinatarios via `!fk` hint.

**Cache.** Mutations call `revalidateFinancialViews()` + a new `personal-debts` tag via `updateTag()`. Income-exclusion edits mean a new/linked personal-debt correctly refreshes dashboard hero/cashflow.

**Destinatario `kind`.** `useDestinatarios()` gains `kind`; `DestinatarioPicker` takes a `kind` filter; the Destinatarios management page segregates Personas vs Comercios; the import destinatario-matcher skips `kind='person'` so people never auto-match merchant strings.

**Mobile parity.** New synced table → SQLite schema mirrors the view columns, plus `transactions.personal_debt_id`/`pd_role` and `destinatarios.kind`. Repository mirrors the **full** action chain (repayment tx + outstanding recompute + linking), not just the primary write.

### 3.6 Review gates (before "done")

- `supabase-migrator` — the `kind` 6-step + new table/columns
- `server-action-reviewer` — new action file + the two income-exclusion edits
- `mobile-webapp-parity` + `mobile-sync-doctor` — new synced table + push mutations
- `zetas-front-guy` — Personas page TSX
- `perf-auditor` — the page + hot-path predicate change

### 3.7 Reuse map

| Need | Reuse |
|---|---|
| Table/action template | `subscriptions.sql` (20260527151641), `webapp/src/actions/subscriptions.ts` |
| Person anchor | `destinatarios` view, `webapp/src/actions/destinatarios.ts`, `useDestinatarios()`, `DestinatarioPicker` |
| Income exclusion sites | `charts.ts:~190`, `income.ts:~90` (beside `isDebtAccountType`) |
| Repayment scheduling (optional, fast-follow) | `webapp/src/actions/occurrences.ts` (`ensureCurrentOccurrences`, `findMatchingOccurrence`) + `recurring_transaction_templates` |
| Idempotency | existing `transactions.idempotency_key` UNIQUE via `computeIdempotencyKey()` |
| Page skeleton | `webapp/src/components/debt/debt-account-card.tsx`, `deudas/page.tsx` layout |
| Cache | `revalidateFinancialViews()` (`webapp/src/lib/cache/revalidation.ts`) |

---

## 4. Sharing roadmap (after F1)

### 4.1 Why not "true shared transactions"

`zeta_encrypt()`/`zeta_decrypt()` resolve the DEK via `auth.uid()` against `user_encryption_keys` — **one key per user**, decrypted in the reader's session (`security_invoker = true`). So even with RLS granting cross-user SELECT, encrypted columns (`merchant_name`, `notes`, descriptions) return NULL/garbage for the partner. True visibility would require shared-key crypto + ~57 RLS policies rewritten across 19 tables + auditing 429 `.eq("user_id")` call sites + idempotency salting + mobile key distribution. **Non-goal** (= "2c", revisit only if 2b proves insufficient).

### 4.2 2a — Trip grouping via tags (single-user, ~zero schema)

A trip = a tag (e.g. `Viaje Cartagena 2026`) on the existing `tags`/`transaction_tags` system + a per-tag spend rollup. Ships ~60% of the felt value with no new tables. Parallelizable with F1. Reuse `webapp/src/actions/tags.ts`, `useAllTags()`/`useTagGroups()`.

### 4.3 2b — Shared split ledger (multi-user, web-first)

Three new **plain** tables — **zero touch** to encrypted tables / existing RLS / the 429 call sites:

```
shared_spaces        (id, name, owner_user_id, created_at)
space_members        (space_id, user_id, role, joined_at)   RLS: space_id IN (my memberships)
space_ledger_entries (space_id, payer_user_id, beneficiary_user_id?,
                      amount, currency, label, occurred_on,
                      source_transaction_id NULL)            -- plaintext, user-authored
```

- "Who owes whom" = aggregation over `space_ledger_entries`.
- **"Push my transaction into the space" (the user's caveat):** reads *your own* tx (you can decrypt it), copies **amount + date + a label you confirm** into a ledger entry, stamps `source_transaction_id` for your private back-reference. The partner sees only the ledger entry's plaintext label — never your raw bank fields. **Exactly which fields cross is pinned in the 2b sub-spec.**
- v1: even split (÷N), existing Zeta users only, web-only. Custom splits / email invites / mobile = fast-follow.
- **Requires its own detailed sub-spec before implementation** (invite flow, settlement math, currency handling, the field-set decision above).

---

## 5. Sequencing

1. **F1 — Personal Debts** (this round). Self-contained: one migration (`personal_debts` + `transactions` columns + `destinatarios.kind`), one action file, one page, two income-exclusion edits, the Vincular expansion, mobile parity follow-up. Low risk, high clarity.
2. **2a — Trip-tags** — pure tag-layer UI; can run in parallel with F1.
3. **2b — Shared ledger** — after its own sub-spec.
4. **2c — true shared visibility** — non-goal.

---

## 6. Open items (deferred, not blocking F1)

- F1 installment repayment plans (recurring templates + occurrences) — fast-follow after ad-hoc v1.
- F1 overdue → dashboard Attention Items — deferred (page-only v1).
- F1 multi-currency FX normalization — deferred (literal amounts v1).
- 2b field-set decision (what crosses when pushing a tx into a space) — owned by the 2b sub-spec.
- 2b custom splits, email/non-Zeta invites, mobile parity — fast-follow.
