# Parity Remediation — Proposed BACKLOG Additions (2026-06-25)

One bullet per **non-already-tracked** finding, P0–P2 only. Format: gap → fix approach → side → effort (S/M/L).
Effort: S ≤ half day · M ~1–2 days · L > 2 days / cross-cutting.

> Cross-cutting note: most P0s share ONE root cause — mobile write paths bypass the webapp server actions and the sync push writes raw PostgREST rows with no trigger reproducing side-effects. The highest-leverage fix is **structural**: route mobile money-moving mutations through balance/occurrence-aware repo helpers inside the same `withTransactionAsync`, OR add server-side `AFTER INSERT/UPDATE/DELETE` triggers on `transactions` that recompute `accounts.current_balance` (+ occurrence link) so all platforms and the email/PDF/import paths get it for free. Decide this once before fixing individual paths. Spawn `mobile-webapp-parity` + `mobile-sync-doctor`.

---

## P0 — Data corruption / dropped side-effect

- **[capture-methods/tx-new] Manual capture drops account balance delta** → wrap mobile `createTransaction` to call `applyLocalBalanceDelta` inside its `withTransactionAsync` (helper already exists in `ledger-helpers.ts:297`), OR add the server-side trigger. Apply uniformly to capture/voice/OCR paths. → mobile → **L** (or M if trigger route chosen).
- **[tx-detail/tx-list] Edit/delete drop balance delta (amount/account/exclude/delete)** → on `updateTransaction`/`deleteTransaction`, reverse old delta + apply new (mobile has `reverseAccountBalanceDelta`); for account moves, move delta between both accounts. Same trigger covers it if server-side. → mobile → **M**.
- **[categorizar/tx-list] Categorize drops `category_rules` learning + destinatario default-category backfill** → in mobile `updateTransaction` category path, run `extractPattern` + upsert `category_rules` (synced table) and backfill `destinatarios.default_category_id` when null, mirroring `categorize.ts:253-282`. → mobile → **M**.
- **[tags] `saveTransactionTags` omits `user_id` → push fails NOT-NULL/RLS forever** → add `user_id` to the enqueued `transaction_tags` payload (copy the working recurring path `recurring.ts:964`); optionally make the push handler hard-fail loudly instead of `console.warn` so silent retries are caught. → mobile → **S** (high value, low effort — do first).
- **[import] Import never updates account balance (metadata + per-tx delta)** → after local insert, apply per-tx balance delta and set statement metadata (credit_limit/current/available/payment_day) from parsed summary, mirroring `import-transactions.ts:763-847,1219-1287`. Best solved by the same balance mechanism + a metadata-apply step. → mobile → **L**.
- **[import] No `statement_snapshots` upsert** → upsert a snapshot row per imported statement (table is already pull/push registered); port `import-transactions.ts:694-747` field mapping to the mobile import flow. → mobile → **M**.

## P1 — Missing core feature (non-tracked subset)

- **[periodo] Cannot pay a standalone (non-recurring, non-debt) expense** → add the third branch to `PaymentSheet.handleCreatePayment`: insert MANUAL_FORM OUTFLOW + balance delta + mark entry COMPLETED, mirroring `cashflow-planner.ts:1278-1340`. → mobile → **M**.
- **[deudas] No 'Abonar' extra-payment mutation** → port `applyExtraDebtPayment` to a mobile repo (transfer pair, dual idempotency keys, source+debt balance deltas, payoff-template deactivation) and add the Abonar CTA. Reuse ledger-helpers. → mobile → **L**.
- **[tags] /etiquetas + /categories unreachable (nav-orphan)** → add HubEntry rows in `menu.tsx` (or a settings 'Organización' section) routing to both; categories CRUD is already built. → mobile → **S**.
- **[capture-methods] Capture does not link to pending recurring occurrences** → after capture insert, run `findMatchingOccurrence` → `markOccurrencePaid` (helpers exist in mobile `recurring.ts`). Bundle with the balance-delta capture fix. → mobile → **M**.
- **[import] Skips credit-card/loan recurring-template sync** → port `syncCreditCardRecurringTemplate`/`syncLoanRecurringTemplate` + `ensureCurrentOccurrences` into the mobile import flow. → mobile → **M**.
- **[import] Does not link imported tx to recurring occurrences** → call occurrence-link per imported tx (`skipDebtCompanionLeg:true`), same helper as the capture fix. → mobile → **S** (once capture-link lands).
- **[import] Idempotency key omits `original_amount` + `installment_current`** → add `original_amount` + `installment_current` to mobile `ParsedTransaction`, parse them, and pass `amount = original_amount ?? amount` + `installmentCurrent` to `computeIdempotencyKey` (matches `import-transactions.ts:991-997`). Prevents cross-platform installment duplicates. → mobile → **S** (P0-adjacent — prioritize).

## P2 — Functional divergence (non-tracked subset)

- **[tx-list] Inline categorize skips category_rules learning** → covered by the P0 categorize fix above. → mobile → (folded).
- **[tx-list] Row lacks Excluir/Incluir + Vincular-a-deuda-personal** → add inline exclude toggle (routes to the balance-aware update) + personal-debt link action to the expanded row. → mobile → **M**.
- **[tx-list] Filter drawer missing tag/date-range/amount-range** → add the three filter axes to `MovimientosUtilidades` FilterDrawerBody; query support exists. → mobile → **M**.
- **[tx-detail] Cannot reassign the transaction's account** → add same-currency account picker → `updateTransactionAccount` (must move balance delta between accounts). → mobile → **M**.
- **[account-detail] 'Más' lacks 'Archivar (pagada)' for debt accounts** → add `archiveDebtObligation` mobile repo (zero balance, is_active=false, deactivate templates) + menu item; prevents destructive delete. → mobile → **M**.
- **[account-detail] Recent tx fixed 10, no 'Ver todas'/load-more** → add load-more + 'Ver todas' link to filtered movimientos + empty-state CTA. → mobile → **S**.
- **[accounts] Two account-list screens; `(tabs)/accounts.tsx` orphaned** → delete the dead duplicate; keep `accounts-list.tsx`. → mobile → **S**.
- **[accounts] Create/edit form drops account fields** → add loan_amount/monthly_payment/card_brand/investment/maturity/show_in_dashboard/is_payroll_deducted to `CreateAccountParams` + form. → mobile → **M**.
- **[account-detail] (note) BACKLOG:1086-1088 Pagar/Transferir/Ajustar stubs are stale** → mark resolved. → bookkeeping → **S**.
- **[destinatarios] Create omits 'kind' from payload** → add `kind` to insert + sync payload. → mobile → **S**.
- **[destinatarios] Create does not retro-link/categorize/rename matching tx** → port the link_matching_transactions scan or add an apply/bulk-link action on the detail screen. → mobile → **M**.
- **[deudas] Flat scroll vs 3-lens segmented control** → add Carga/Plan/Cuentas segmented control to DeudasRoot. → mobile → **M**.
- **[deudas] Missing trend / debt-free countdown / insights** → extend mobile `getDebtOverview` to return trend/countdown/insights + render cards. → mobile → **M**.
- **[debt-planner] 'Contexto salarial' card is dead code** → in `PlanificadorRoot`, read `estimated_monthly_income` from local profiles (like DeudasRoot) and pass `income` into `DetailStep`. Correct stale BACKLOG:1189. → mobile → **S** (trivial, do early).
- **[personas] Only loads `status='active'` debts** → relax the read filter + render a 'Saldadas y canceladas' section with status badges. → mobile → **S**.
- **[plan-hub] Periodo chip hardcoded false** → wire `getActivePeriodWithEntries` into PlanRoot, compute percentAssigned, pass real `periodHasActive`/`periodPercentAssigned`. → mobile → **S**.
- **[presupuesto] Budget 'spent' double-counts reconciled tx** → add `AND reconciled_into_transaction_id IS NULL` to `getBudgetProgress` SQL. → mobile → **S** (SQL-only).
- **[presupuesto] Budget 'spent' misses parent-category rollup** → include budgeted subcategories' `parent_id` in the spend join. → mobile → **S**.
- **[presupuesto] No 'Armar presupuesto' / 'Simular cambio'** → port batch composer + scenario sandbox. → mobile → **L**.
- **[periodo] No PLANNED/COMPLETED/SKIPPED status toggle** → make StatusBadge interactive → `toggleEntryStatus`. → mobile → **S**.
- **[periodo] Lacks Auto-asignar** → port `autoAssignExpenses` to mobile planning repo + button. → mobile → **M**.
- **[periodo] Lacks balance-envelope seeding** → port `upsertBalanceEnvelopes` + 'Saldo' action. → mobile → **M**.
- **[periodo] No multicurrency conversion** → fetch exchange rates and compute converted_amount for envelope/assignment math. → mobile → **M**.
- **[periodo] Entry status not reconciled vs `recurring_occurrences`** → override recurring entry status from occurrence paid/skipped on read (mirror `cashflow-planner.ts:96-157`); also prevents double-pay. → mobile → **M**.
- **[recurrentes] Capture-path template create skips occurrence/subscription generation** → resolved if mobile gains local occurrence generation or routes through a server action on sync. → mobile → **M**.
- **[settings] Profile editor (name/currency/salary) missing** → add an editable profile form (or settings/perfil screen) writing full_name/primary currency/estimated salary. → mobile → **M**.
- **[import] No manual-adjustment auto-exclusion** → scan 'Ajuste manual de saldo%' in range and set is_excluded. → mobile → **S**.
- **[import] No loan-only confirm flow** → branch loan statements to a lean loan review/results flow + apply loan metadata (needs the metadata fix). → mobile → **M**.
- **[import] PDF-only; no OCR/EMAIL_PDF capture stamping** → wire screenshot/OCR + email-PDF into the import pipeline with correct capture_method tiers. → mobile → **L**.
- **[puedo-pagar] Committed-payments source drift (debt paymentDay vs recurring templates)** → make mobile `getFinancialSnapshot` read recurring templates for `upcomingCommittedPayments`/`daysToNearestPayment`, mirroring `purchase-decision.ts:171-184`. → mobile → **M**.
- **[puedo-pagar] No 'Comprar ahora' / 'Descartar' decision panel** → add the decision panel: 'Comprar ahora' → capture/expense, in-result 'Descartar'. → mobile → **S**.
- **[reportar-bug] Orphan storage object on insert failure** → on insert error, `storage.remove([attachmentPath])` (mirror route.ts:145-148). → mobile → **S**.
- **[capture-methods] Voice/OCR capture skip autoCategorize** → call `autoCategorize` on parsed/OCR description in voice + screenshot paths. → mobile → **S**.

---

## Already in BACKLOG (report-and-flag only, no new item)

P0/P1/P2 findings already tracked — verify the line is current, don't duplicate:

- Personal debts mobile write parity / recordRepayment chain — BACKLOG:106-110
- Income exclusion of personal-debt origin inflows — BACKLOG:100-104
- Subscriptions mobile write-path prep / orphan RN screen — BACKLOG:1208-1209,1318
- /plan tab consolidation, no-deseos-link, resumen sections, periodHasActive — BACKLOG:48,912,1134-1144
- Periodo read-only CRUD, sync-recurrentes, period create, first-time assign — BACKLOG:1141,1144,1305-1308
- Recurring template editor / list edit-delete-pause — BACKLOG:338
- Destinatario assign category backfill + rule upsert — BACKLOG:645
- Destinatarios mobile edit/rule CRUD missing — BACKLOG:1230-1231
- Categorizar auto-review tab + bulk-categorize — BACKLOG:1215-1225
- StatementSnapshotsCard on account detail — BACKLOG:1089
- Budget 50/30/20 chip + treemap; yearly budgets — BACKLOG:1149,1151,127-130
- Deseos reflections + insights + orphaned nav + nudge variants — BACKLOG (Deseos section)
- Etiquetas stub + tag_count chip + category form fields — BACKLOG:1247,644
- Hub AttentionHub + sparse Más menu + icon drift + two-hub split — BACKLOG:46,1250,1294
- Import destinatario auto-tag + screenshot mode + recurring-pay tx shape — BACKLOG:367,1221,476
- puedo-pagar budgetRemaining — BACKLOG:1042
- Settings integraciones/email/pdf-passwords/analytics + IA monolith — BACKLOG:466,1269,1270
- Onboarding dashboard_config + skip + analytics + debtCount + CurrencyCode — BACKLOG:744-757,1277-1279
- Capture repo-vs-action + discoverability + quick-capture stub + annotate-not-capture — BACKLOG:1127,1129,1260,875,898
- Mobile Tendencias screen — BACKLOG:21,466
- Tx-detail promote/vincular RESOLVED — strike stale BACKLOG:1110-1111

## Bookkeeping corrections found during audit

- BACKLOG:109 "mobile lets the server balance delta flow back on next pull" is **false** for mobile-originated inserts — correct the note.
- BACKLOG:1189 marks debt-planner income context DONE — it is **broken** on mobile (dead card).
- BACKLOG:1086-1088 Pagar/Transferir/Ajustar P0 stubs — **resolved**, close them.
- BACKLOG:1110-1111 tx-detail promote/vincular P0s — **resolved**, strike.
- BACKLOG:755 onboarding locale 'en-US' default — **stale**, now `navigator.language || 'es-CO'`.
- BACKLOG:1119-1123 tx-new 'Formulario en construcción' stub — **stale**, route now redirects to working /capture.
