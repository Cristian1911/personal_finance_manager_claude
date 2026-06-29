# Mobile ↔ Webapp Parity Redesign Roadmap — 2026-06-29

Webapp is the design source of truth; mobile (Expo RN) mirrors it. This consolidates a 3-cluster
parity audit (planning/analytics, daily/transactions, management/config) into one prioritized roadmap.

**Cross-cutting root cause:** mobile consistently ships the **read/consume** half of a surface (view,
confirm/skip, browse) but omits the **author/manage** half (create, edit, rules, lifecycle, merge).
Two surfaces are entirely absent (**Tendencias**, **Recurrentes authoring**), and two carry
**correctness bugs** (Accounts net-worth COP-hardcoded; Suscripciones on an older data model).

> Scope note: the webapp create-form "hero/CLASIFICACIÓN" redesign is **not live on `main`** (it was an
> unmerged branch) — do NOT scope mobile `capture.tsx` toward that mockup. Also do not regress the RN
> dashboard widgets (`NextBill`/`NextIncome`/`Accounts`) that are ahead of the webapp mobile catalog.

## Priority matrix

| Surface | Priority | Effort | Headline gap |
|---|---|---|---|
| **Budget** (presupuesto) | **P0** | L | Legacy flat inline-edit list — needs verdict hero (EN CONTROL / 50·30·20 / Restante) + "Armar presupuesto" builder (lines, grouping, derive-from-tx, Simular) |
| **Tendencias** | **P0** | L | **Missing entirely** — net-new screen (verdict header, period control, category-trend list w/ drill-down, top-recipients, movers). `@zeta/shared/analytics` engine is portable |
| **Recurrentes** authoring | **P0** | L | Create + edit forms **missing entirely** — can only confirm/skip existing occurrences, not author/modify obligations |
| Pendientes | P1 | S | Due-occurrence notification deep-links to a "Próximamente" placeholder — re-route to `/recurrentes` (+ delete stub) |
| Accounts | P1 | M | No section grouping + per-section subtotals; **net-worth COP-hardcoded (bug)**; debt "Archivar (pagada)" action missing |
| Capture (add tx) | P1 | M | No destinatario picker — can only mint a *new* destinatario, can't select an existing one |
| Categorizar | P1 | M | No "auto-categorizadas" review tab; no "similar transactions" bulk-apply; no "Confirmar todas" |
| Dashboard/Inicio | P1 | M | No `PrimerosPasos` guided block; attention widget is counts-only (no itemized timeline / import strip) |
| Import | P1 | L | No loan-statement import; no image/OCR; no multi-statement single-pass; no email-PDF queue |
| Settings | P1 | M | Perfil edit, Integraciones (Telegram/AI token), Email config, PDF-passwords mgmt all missing; Etiquetas orphaned |
| Destinatarios | P1 | L | Detail read-only — no edit, create, rule mgmt, merge, or Sugerencias |
| Suscripciones | P1 | L | On older `recurring_templates` model; ignores the `subscriptions` table; no detection/cancel lifecycle |
| Etiquetas mgmt | P1 | M | Management screen is a "Próximamente" stub (assignment works; management doesn't) |
| Plan (resumen) | P1 | M–L | Reduced to a net-hero launcher; lost the strategic `PlanHero` verdict + inline budget/debt/recurring/scenario zone |
| Transactions list | P2 | M | Filters lack tag/date-range/amount-range; no inline exclude toggle |
| Transaction detail | P2 | M | No account reassignment in edit; monolithic form vs per-field inline edits (otherwise redesigned/close) |
| Deudas | P2 | S–M | Missing AccountImpactTimeline, ExtraPayment sheet, ExchangeRateNudge; Personas read-only (no create/settle) |
| Deseos | P2 | M | No reflexiones-pendientes loop; no insights panel; only first nudge shown |
| Categories | P2 | M | No icon picker, is_essential flag, direction (Gasto/Ingreso), or visibility toggle |
| Puedo-pagar | P3 | S | Near 1:1 — verify "caminos más seguros" alternatives + verdict copy |

## Suggested phasing

**Phase 0 — correctness + cheap wins** (fast, unblocks/fixes bugs)
- Pendientes deep-link re-route → `/recurrentes` (S).
- Accounts multi-currency net worth (COP-hardcoded bug) (S–M).
- Capture destinatario picker — select existing (reuse `DestinatarioPicker`) (M).
- Etiquetas: link the existing screen / or confirm-stub decision (S).

**Phase 1 — P0 redesigns** (the big rocks)
- Budget: verdict hero + 50·30·20 + "Armar presupuesto" builder (lines, grouping, derive-from-tx, Restante, Simular).
- Tendencias: net-new mobile analytics screen (engine already shared).
- Recurrentes: create + edit forms (+ template lifecycle: pause/delete; occurrence link-existing-tx).

**Phase 2 — P1 authoring + data correctness**
- Destinatarios authoring (edit/create/rules/merge/Sugerencias).
- Settings subpages (perfil edit, integraciones, email, pdf-passwords).
- Suscripciones → migrate onto the `subscriptions` table (correctness; parity gate).
- Import (loan import, OCR/image, multi-statement).
- Categorizar auto-review tab + bulk-apply. Dashboard PrimerosPasos + attention timeline.

**Phase 3 — P2/P3 polish**
- Plan resumen zone; Deudas secondary widgets + Personas writes; Categories manager; Deseos
  reflexiones/insights; transaction filters + detail account-reassignment; Puedo-pagar copy.

Each phase = its own PR(s); run `mobile-webapp-parity` + `mobile-sync-doctor` on anything touching
Supabase (Suscripciones model migration especially), and `zetas-front-guy` + `mobile-perf-doctor` on UI.
