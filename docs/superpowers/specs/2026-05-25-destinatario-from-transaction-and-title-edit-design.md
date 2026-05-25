# Destinatario-from-Transaction Wizard + Editable Transaction Title

**Date:** 2026-05-25
**Status:** Approved (design), pending implementation plan

## Overview

Two related transaction-management improvements:

- **Feature A** — Replace the bare "inline create destinatario" (name + one free-text pattern) with a proper **seeded creation form** that turns details of a transaction into detection patterns. Available from three entry points.
- **Feature B** — Let the user **edit a transaction's title** (currently derived from the imported/email description) while keeping the original description immutable.

A third item — evolving the tag system — is explicitly **out of scope** (see below).

## Current State (verified)

- **Title display:** `transaction-detail-client.tsx:368-370` renders `tx.merchant_name || tx.clean_description || "Transacción"`. No edit affordance.
- **Original description:** `raw_description` shown read-only as a "Ver descripción original" disclosure (`transaction-detail-client.tsx:638-658`).
- **Bare inline create (detail/picker):** `destinatario-zone-picker.tsx:242-294` — name + one optional "Patrón de texto" field.
- **Bare inline create (import):** `InlineCreateDestinatarioDialog` in `transactions/destinatario-picker.tsx:228-436` — dumps the whole `raw_description` into one comma-separated `patterns` field, with a "Probar" button.
- **Backend already in place (reused, minimal new code):**
  - `createDestinatario(prevState, FormData)` — inserts destinatario, splits `patterns` by comma into `destinatario_rules`, **retroactively links matching unassigned transactions**, and applies `default_category_id`. Returns `{ ...destinatario, linked_count }`.
  - `addDestinatarioRule(destinatarioId, prevState, FormData)` — `{ pattern, match_type, priority }`.
  - `testDestinatarioPattern(pattern, matchType)` → `{ matchCount, samples[] }` against unassigned transactions.
  - `assignDestinatario(transactionId, destinatarioId)` (`categorize.ts`) — sets `destinatario_id` + **`merchant_name: dest.name`** (clobbers title), applies default category if uncategorized, upserts a rule from `raw_description`.
  - `applyDestinatarioRules(destinatarioId)` (`destinatarios.ts:1351-1356`) — bulk sets `destinatario_id` + **`merchant_name: dest.name`**.
- **Encryption:** `transactions` is an encrypted view (`20260408143001_encrypt_transactions.sql`; has `merchant_name_hmac`, `clean_description_hmac`). Adding a column = 6-step migration via `supabase-migrator`.

## Feature A — Destinatario Creation Form

### Entry points (all three)

1. **Transaction list row** (primary — most-used). A quick action on each row in `transaction-table.tsx`.
2. **Transaction detail.** The destinatario picker's "Crear nuevo" path opens this form instead of the bare inline create.
3. **Import wizard — Destinatarios step.** Upgrade `InlineCreateDestinatarioDialog` to use the same form.

### Form

Single-screen rich form (responsive: Dialog on desktop, Drawer on mobile — **not** a literal multi-step wizard; speed is a priority). Seeded from the originating transaction.

Fields:
- **Nombre** — defaulted from the cleanest merchant token (falls back to `merchant_name`, then a token of `clean_description`).
- **Categoría por defecto** — `CategoryZonePicker`.
- **Constructor de patrones (token chips):**
  - `raw_description` is tokenized into tappable word-chips. Plus a `merchant_name` chip and an `amount` chip when available.
  - Tapping a chip toggles its token in/out of an editable **pattern text field** below the chips (selection-order, space-joined).
  - The pattern field still supports **comma → multiple rules** (consistent with `createDestinatario` splitting). Power users can type freely.
  - **No live preview.** A **"Probar"** button runs `testDestinatarioPattern` on demand and shows match count + up to 5 samples (reuses the existing aggregation logic from `InlineCreateDestinatarioDialog`).
- **Notas** — optional.

### Behavior on save

1. `createDestinatario` (name, default category, comma-split patterns, notes) → creates destinatario + rules + retroactively links matches + applies default category. Returns the new id.
2. Assign the new destinatario to the **originating transaction** (`assignDestinatario`) — except in the import-wizard context, where assignment is already handled by the wizard's own mapping step.

### Components / files

- **New:** `webapp/src/components/destinatarios/destinatario-create-form.tsx` — the shared seeded form (props: `rawDescription`, `merchantName`, `amount`, `currencyCode`, `categories`, `onCreated`, render-surface variant). Owns the token-chip + test logic.
- **New:** a small `webapp/src/lib/utils/tokenize-description.ts` (or colocated helper) to split a raw description into meaningful chips (reuse/extend the cleaning logic in `@zeta/shared` `destinatario-matcher` `cleanDescription` where possible — do **not** duplicate token rules).
- **Modify:** `destinatario-zone-picker.tsx` — replace the bare inline create with the new form (detail entry point).
- **Modify:** `transactions/destinatario-picker.tsx` — `InlineCreateDestinatarioDialog` delegates to the new form (import + any legacy usage).
- **Modify:** `transaction-table.tsx` — add the row-level "Crear destinatario" quick action that opens the new form.

## Feature B — Editable Transaction Title

### Data model

- Store the edited title in the existing **`merchant_name`** column (single display field used across list, detail, recurring, link-picker — no new display logic needed).
- Add a new boolean **`title_locked`** (default `false`) on `transactions`, set `true` when the user edits the title manually.
- `raw_description` remains immutable — original email/import text, still shown as "Ver descripción original".

**Migration:** add `title_locked boolean not null default false` to the encrypted `transactions` view + `_enc` table + INSTEAD OF triggers — **6-step process via `supabase-migrator`**. Non-PII, so no encryption of the column itself; the trigger/view plumbing still must include it. Regenerate `database.ts` after.

### Edit UX

- Inline-editable hero title on the tx detail screen, mirroring the existing **Notas** pattern (tap to edit → input → autosave on blur), with a pencil affordance.
- New server action **`updateTransactionTitle(transactionId, title)`** in `actions/transactions.ts` — sets `merchant_name = title.trim()` (or `null` → falls back to `clean_description`) **and `title_locked = true`**, defense-in-depth `.eq("user_id", …)`, then `revalidateFinancialViews()` / `updateTag` for affected views. Reviewed by `server-action-reviewer`.
- Title edit lives on **tx detail only** for this round (no inline rename from the list row).

### Clobber protection (the "ask me before replacing" requirement)

- **Bulk / automatic paths** — import auto-match and `applyDestinatarioRules` **silently skip** overwriting `merchant_name` when `title_locked = true`. No prompts during bulk ops.
- **Manual single assign** — `assignDestinatario` invoked from a picker: if `title_locked` and `dest.name !== current merchant_name`, the **client** shows a confirm *"¿Actualizar el título a «{dest.name}»?"* (default: keep). Implementation: `assignDestinatario` gains an explicit `overwriteTitle?: boolean` and, by default, **does not** overwrite a locked title; the picker decides whether to pass `overwriteTitle: true` based on the user's confirm answer.
  - The pattern-rule upsert from `raw_description` inside `assignDestinatario` is unaffected — only the `merchant_name` write is gated.

### Components / files

- **Modify:** `transaction-detail-client.tsx` — editable hero title (Notas-style), confirm dialog wiring for the locked-title assign case.
- **Modify:** `actions/transactions.ts` — add `updateTransactionTitle`.
- **Modify:** `actions/categorize.ts` — `assignDestinatario` respects `title_locked` / `overwriteTitle`.
- **Modify:** `actions/destinatarios.ts` — `applyDestinatarioRules` skips locked titles. Verify the import auto-match path (`matchTransactionToDestinatario` / import insert) does not overwrite locked titles (new transactions are never locked, so import inserts are safe; the guard matters for re-runs / retroactive linking).
- **Migration + `database.ts` regen.**

## Out of Scope

- **Tag system evolution.** The current inline tag create (`createTag`, name + group only) stays as-is. When tags are later evolved, the **Feature A form is the template** — a seeded, pattern-aware creation surface. One-line pointer only; no work this round.

## Testing

- **Unit (`@zeta/shared` / utils):** description tokenizer — noisy bank line → expected chips; comma-pattern composition.
- **Server actions:** `updateTransactionTitle` sets `title_locked`; `assignDestinatario` does not clobber a locked title unless `overwriteTitle`; `applyDestinatarioRules` skips locked titles. `createDestinatario` retroactive-link behavior already covered.
- **Manual UI verification (golden path):**
  - Create destinatario from a list row → token chips → Probar → save → row shows new destinatario, matches linked retroactively.
  - Edit a title on detail → reload persists → assign a destinatario → confirm prompt appears → "keep" preserves the edited title; "replace" updates it.
  - Import wizard Destinatarios step uses the new form.
- **Review gates:** `server-action-reviewer` (new/changed actions), `supabase-migrator` (migration), `zetas-front-guy` (new form + detail edit UI), `import-flow-doctor` (import-wizard entry point), `perf-auditor` (no uncached queries; test runs on-demand only).

## Decisions Locked

- Single-screen form, not multi-step.
- Title stored in `merchant_name` + `title_locked` flag (not a separate `display_title` column).
- Chips compose into the existing comma-pattern format (no new multi-rule data model).
- Title edit on tx detail only this round.
- No live match preview — on-demand "Probar" only.
