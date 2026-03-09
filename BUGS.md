# Zeta — Bug Reports

> Format: `- [ ] **[severity]** Description — context/steps to reproduce`

- [x] ~~**[high]** Uncommitted changes from last session~~ — Resolved: all changes committed and merged via PR #32 + #33
- [x] ~~**[high]** Missing user_id filters in server actions~~ — Fixed in PR #34: 18 queries across 10 files now have explicit user_id filtering
- [ ] **[medium]** Lulo Bank detection too broad — `__init__.py:37` checks for "LULO" in uppercase text. If Lulo issues savings statements, needs sub-type routing
- [ ] **[medium]** `installments_in_default` display — Uses inline rendering, not `MetricRow`, because `MetricRow` always formats with `formatCurrency()`. Need formatter prop if more non-currency metrics added
- [ ] **[low]** BC loan parser uses US number format while Lulo uses Colombian format — inconsistency risk for future loan parsers
- [ ] **[low]** Zod 4 `.uuid()` enforces RFC 9562 — seed category UUIDs (a0000001-...) fail validation. Using permissive regex workaround
- [ ] **[low]** PDF `1152469757.pdf` (Nequi) is password-protected — password is the filename. Parser needs password param from user or auto-detection
- [ ] **[medium]** `use-recurring-month.ts` localStorage race condition — second `useEffect` writes empty `{}` to storage before first effect hydrates from storage, potentially clearing persisted checklist. Add `hasHydrated` ref guard.
- [ ] **[medium]** Transaction filter debounce doesn't work — `onChange` handler returns cleanup function but React event handlers ignore it. Timeouts are never cleared, causing multiple rapid router pushes on fast typing.
