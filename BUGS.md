# Zeta — Bug Reports

> Format: `- [ ] **[severity]** Description — context/steps to reproduce`
> Audit date: 2026-03-30 (consistency audit across tags, destinatarios, budget, cross-cutting)

## Resolved

- [x] ~~**[high]** Uncommitted changes from last session~~ — Resolved: all changes committed and merged via PR #32 + #33
- [x] ~~**[high]** Missing user_id filters in server actions~~ — Fixed in PR #34: 18 queries across 10 files now have explicit user_id filtering

---

## HIGH — Data integrity / security

- [x] ~~**[high]** `getCategoriesWithBudgetDataCached` missing `user_id` on transaction queries~~ — Already had `.eq("user_id", userId)` on both queries (verified 2026-03-30)
- [x] ~~**[high]** `registerPayment()` ignores update errors~~ — Already had error checking on all 3 `.update()` calls (verified 2026-03-30)
- [x] ~~**[high]** `category_tags` RLS policy allows any user to mutate system category tags~~ — Fixed: migration `20260330181054` splits into read (own+system) and write (own only) policies
- [x] ~~**[high]** `addTagToEntity`/`removeTagFromEntity` no ownership check~~ — Fixed: added `verifyEntityOwnership()` pre-flight check in `tags.ts`
- [x] ~~**[high]** `updateTag` action missing~~ — Fixed: added `updateTag(id, formData)` action in `tags.ts`
- [x] ~~**[high]** `testDestinatarioPattern` matchCount capped at 5~~ — Fixed: added `{ count: "exact" }` to select, use `count ?? matches.length`

- [x] ~~**[high]** Recurring payments reappear after being marked as paid~~ — Fixed: added `getPaidOccurrenceKeys()` server action + DB hydration effect in `use-recurring-month.ts`. localStorage is now optimistic overlay, DB is source of truth. Shows loading state during hydration.
- [x] ~~**[high]** Quick payment dialog shows wrong account options~~ — Already fixed: uses `EXCLUDED_SOURCE_TYPES = Set(["LOAN", "INVESTMENT"])` (verified 2026-03-30)

## MEDIUM — Incorrect behavior / missing features

### Currency
- [ ] **[medium]** `getDestinatariosWithSpend` sums amounts across mixed currencies — `destinatarios.ts:327-353` sums `amount` without currency grouping. Multi-currency users see garbled avg spend. (2026-03-30 audit)
- [ ] **[medium]** Hardcoded `"COP"` in `destinatario-suggestions-tab.tsx:181` — sample transactions always formatted as COP. `currency_code` not included in suggestion result shape. (2026-03-30 audit)
- [ ] **[medium]** `DestinatarioList` `currency` prop never passed from page — `destinatarios/page.tsx:209` passes no currency, defaults to COP for all users. (2026-03-30 audit)
- [ ] **[medium]** `BudgetCategoryCard` calls `formatCurrency()` without currency throughout — `budget-category-card.tsx:137,139,154,155` and `budget-summary-bar.tsx:45,66,78,89`. No currency prop threaded. (2026-03-30 audit)
- [ ] **[medium]** Hardcoded `"COP"` in `budget-form-dialog.tsx:74` — budget amount always formatted as COP. (2026-03-30 audit)

### Auth / Validation
- [ ] **[medium]** `exchange-rate.ts:31` uses `createClient()` instead of `getAuthenticatedClient()` — bypasses request-scoped cache deduplication. (2026-03-30 audit)
- [x] ~~**[medium]** `z.string().uuid()` in `lib/validators/tags.ts:12`~~ — Already fixed: uses `uuidStr()` from shared validators (verified 2026-03-30)
- [ ] **[medium]** `onboarding.ts:32,55,76` throws errors instead of returning `ActionResult` — breaks the typed result contract, leaks raw error messages. (2026-03-30 audit)
- [x] ~~**[medium]** `getTagsForEntity` missing user_id defense-in-depth~~ — Already had ownership checks (verified 2026-03-30)

### Cache invalidation
- [ ] **[medium]** `updateEstimatedIncome` missing `revalidateTag` — `budget.ts:102-115` mutates `profiles.estimated_monthly_income` but never invalidates. Budget page shows stale income. (2026-03-30 audit)
- [ ] **[medium]** `setBudgetMode` incomplete invalidation — `budget.ts:38` only invalidates `"budgets"`, missing `"profile"` and `"dashboard:budgets"`. (2026-03-30 audit)

### Budget logic
- [ ] **[medium]** 50/30/20 allocation: "Ahorro e Inversión" bucketed into Wants — `allocation.ts:40-49` assigns anything without `expense_type = 'fixed'` to wants. Savings category (expense_type null) inflates Deseos. Savings is residual only. (2026-03-30 audit)
- [ ] **[medium]** Wizard `handleFinalize` doesn't check action results — `budget-wizard.tsx:98-113` `Promise.all` results ignored. On failure, wizard disappears but nothing was saved. (2026-03-30 audit)
- [ ] **[medium]** IncomeEditor stale state on re-open — `budget-page-client.tsx:149` `useState(String(currentIncome))` never re-syncs after save. Second edit shows old value. (2026-03-30 audit)

### Destinatarios
- [ ] **[medium]** `addDestinatarioRule` conflicts dropped — `destinatario-detail.tsx:279-294` `useActionState` typed as `ActionResult` instead of `AddRuleResult`. Server returns `conflicts?` field but UI never surfaces it. (2026-03-30 audit)
- [ ] **[medium]** `MergeDialog` no `router.refresh()` after merge — `merge-dialog.tsx:44-55`. Merged destinatarios stay visible until manual page refresh. (2026-03-30 audit)
- [ ] **[medium]** Edit form and create dialog inconsistent on parent category selectability — `destinatario-detail.tsx:200-213` disables parents; `CreateDestinatarioDialog` allows them. (2026-03-30 audit)

### Tags UX
- [ ] **[medium]** Transaction edit page omits `tags` prop — `transactions/[id]/page.tsx:79-83`. Tag selector invisible when editing from detail page. (2026-03-30 audit)
- [ ] **[medium]** `TagPicker` doesn't close dropdown after selection/creation — `tag-picker.tsx:65-71,84-102`. User must click outside to dismiss. (2026-03-30 audit)
- [ ] **[medium]** Dominio/Ritmo budget view toggle not implemented — spec Phase 2 feature entirely absent from `budget-page-client.tsx`. (2026-03-30 audit)

### Pre-existing
- [ ] **[medium]** Lulo Bank detection too broad — `__init__.py:37` checks for "LULO" in uppercase text. If Lulo issues savings statements, needs sub-type routing
- [ ] **[medium]** `installments_in_default` display — Uses inline rendering, not `MetricRow`, because `MetricRow` always formats with `formatCurrency()`. Need formatter prop if more non-currency metrics added
- [x] ~~**[medium]** `use-recurring-month.ts` localStorage race condition~~ — Fixed by DB hydration: `isHydrated` gate prevents flash of all-unpaid. Superseded by the high-severity fix above.
- [ ] **[medium]** Transaction filter debounce doesn't work — `onChange` handler returns cleanup function but React event handlers ignore it. Timeouts are never cleared, causing multiple rapid router pushes on fast typing.

## LOW — Polish / spec gaps

- [ ] **[low]** Tag filter shows plain text, not colored chips — `transaction-filters.tsx:129-146`. Spec says "colored chip". `getAllTags()` doesn't fetch group color data. (2026-03-30 audit)
- [ ] **[low]** `TagManager` missing: per-group transaction count, rename group/tag, reorder — spec lines 278-283. (2026-03-30 audit)
- [ ] **[low]** Tag management at `/etiquetas` not `/gestionar/etiquetas` per spec — navigation works but URL deviates. (2026-03-30 audit)
- [ ] **[low]** `tagGroups` prop accepted but never used in `DestinatarioList` — `destinatario-list.tsx:58-59,99` renamed to `_tagGroups`. Dead prop + wasted page fetch. (2026-03-30 audit)
- [ ] **[low]** `RulesSection` form not reset after successful rule add — `destinatario-detail.tsx:283-294`. (2026-03-30 audit)
- [ ] **[low]** `/presupuesto` nav discovery unclear — nested under "Mas" in nav, no dashboard CTA link. `presupuesto-section.tsx:57` says "Configura en ajustes" but links nowhere. (2026-03-30 audit)
- [ ] **[low]** Two parallel budget mutation paths — `budget-category-grid.tsx:61` uses `upsertBudget` from `budgets.ts`; other components use `upsertBudgetForCategory` from `budget.ts`. Confusing split. (2026-03-30 audit)
- [ ] **[low]** `rawDescription` says "Pago manual" for income — `accounts.ts:455-457`. Should say "Ingreso manual" for non-debt accounts. (2026-03-30 audit)
- [ ] **[low]** English fallback locale in `onboarding/page.tsx:131` — `"en-US"` fallback should be `"es-CO"`. (2026-03-30 audit)
- [ ] **[low]** `charts.ts` throws instead of `ActionResult` — lines 153, 212, 255, 300. Uncaught throws hit error boundary instead of typed results. (2026-03-30 audit)
- [ ] **[low]** BC loan parser uses US number format while Lulo uses Colombian format — inconsistency risk for future loan parsers
- [ ] **[low]** Zod 4 `.uuid()` enforces RFC 9562 — seed category UUIDs (a0000001-...) fail validation. Using permissive regex workaround
- [ ] **[low]** PDF `1152469757.pdf` (Nequi) is password-protected — password is the filename. Parser needs password param from user or auto-detection
