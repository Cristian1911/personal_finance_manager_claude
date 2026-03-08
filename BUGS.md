# Zeta — Bug Reports

> Format: `- [ ] **[severity]** Description — context/steps to reproduce`

- [ ] **[high]** Uncommitted changes from last session — 12 modified/deleted + 2 new files (Nu + Lulo parsers, loan import flow). Risk of losing work
- [ ] **[medium]** Lulo Bank detection too broad — `__init__.py:37` checks for "LULO" in uppercase text. If Lulo issues savings statements, needs sub-type routing
- [ ] **[medium]** `installments_in_default` display — Uses inline rendering, not `MetricRow`, because `MetricRow` always formats with `formatCurrency()`. Need formatter prop if more non-currency metrics added
- [ ] **[low]** BC loan parser uses US number format while Lulo uses Colombian format — inconsistency risk for future loan parsers
- [ ] **[low]** Zod 4 `.uuid()` enforces RFC 9562 — seed category UUIDs (a0000001-...) fail validation. Using permissive regex workaround
