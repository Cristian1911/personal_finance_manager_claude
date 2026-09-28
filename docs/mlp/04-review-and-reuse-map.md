# Review of the experience proposal + reuse map (2026-09-25)

Reviews `03-experience-proposal.md` (written with zero Zeta context) against the locked decisions in `01` and against today's code.

## 1. Verdict
The proposal is strong and adoptable as the target. It fixes what the audits kept finding: one number, one verdict function, one row grammar, one edit surface, value before setup. It also names a real Android plan (template pack, training inbox, source health, OEM battery fixes).

## 2. Where it departs from our decisions (needs a call)
| # | Proposal | Our decision | Recommendation |
|---|---|---|---|
| 1 | Trips in **v1.1** | Trips in the MLP | Accept v1.1 *if* launch is before Nov; foreign charges still work as "≈" rows. Otherwise keep in v1. |
| 2 | Onboarding asks "¿Cuánto tienes hoy?" (balance anchor) | Not discussed | Accept. It's the fastest aha. |
| 3 | Ignores "saldo disponible" notifications | — | **Change:** use balance notifications to auto-"cuadrar" silently instead of discarding them. Most Colombian banks include the balance. That makes the Disponible self-correcting without the user typing. |
| 4 | Card purchase ≥ $300k counts as 1 cuota until answered | — | Accept, but show "¿A cuántas cuotas?" inline on the row, not only in Revisar. |
| 5 | Gmail "unverified" warning = conversion killer; launch blocker for iOS | ≤100 beta users unverified OK | Beta with the warning; start Google verification in parallel. |
| 6 | Limits: any number, "+" is low-key | 3 default, add more | Matches. |
| 7 | Te deben signal: >20% of cycle income, item >45 days, or 3+ open items per person | "¿Debería parar?" | Accept thresholds as v1 defaults. |

## 3. Gaps in the proposal
- **No accounts/balances view.** Users check balances daily. Add a compact "Mis cuentas" line inside "¿Cómo se calcula?" (not a tab).
- **"¿En qué se me fue?"** only lives in the weekly digest. Add a category breakdown under "Ya salió" (a list, not a chart).
- **Two-cycles-per-month math** (15/30) plus a monthly credit-card cut date: the card bill spans two pay cycles. Needs a worked example before build.
- **Email capture on Android** isn't mentioned. Existing email-ingest users (you) need it to keep working.

## 4. Reuse map — Zeta today → MLP

### Reuse as-is (engine)
| Piece | Where | Use in MLP |
|---|---|---|
| PDF parsers (9 banks) | `services/pdf_parser/` | Backfill + reconciliation |
| Bancolombia email parser + ingest webhook | `webapp/src/lib/parsers/bancolombia-email.ts`, `api/webhooks/email-ingest` | Gmail path (swap Resend inbound for Gmail API pull); formats also seed the notification templates |
| Idempotency + reconciliation + capture hierarchy | `@zeta/shared` `idempotency`, `reconciliation`, `capture-hierarchy` | Dedup across notification/email/PDF/manual. Add `NOTIFICATION` as a tier-2 capture method. |
| Deterministic categorization + user rules | `auto-categorize.ts`, `category_rules` (266 rules) | "¿Siempre para Rappi?" |
| Recurring detection + occurrences | `recurring-candidates.ts`, `recurring_occurrences` | Pagos del ciclo |
| Cuota estimation | `installment-share.ts` | Cuota amounts + interest |
| Personal debts | `personal-debt.ts`, `personal_debts` | Te deben ledger (semantics change, below) |
| Trips | `modos`, `modo-candidates.ts` | Viaje (v1 or v1.1) |
| Weekly digest | `weekly-digest.ts` | Sunday digest |
| Pace/verdict | `ritmo.ts` | Starting point for the single verdict function |
| Local payment reminders | `mobile/lib/services/notifications/` | Bill push |
| FX cache | `webapp/src/lib/fx/` | "≈" foreign charges |
| Supabase schema, RLS, encryption, auth | `supabase/` | Keep; freeze schema except MLP additions |

### Destinatarios and recurring — keep the engine, hide the words
- **Destinatarios stay as the merchant/person identity layer**, surfaced only as the row title ("Rappi", "Juan"). Rules (`destinatario_rules`, 85) + `cleanDescription` normalize raw bank text across notification/email/PDF. That's what makes dedup, "¿Siempre para Rappi?", bill matching and repayment detection work. Today 30% of transactions carry one (1,260 / 4,261).
- **Merge the two rule systems.** Today `category_rules` (pattern → category, 266) and `destinatario_rules` (pattern → merchant → default category) overlap. MLP: one path, text → merchant (rule) → category (merchant default). "¿Siempre para Rappi?" writes the merchant's default category. Migrate `category_rules` into merchants.
- **Persons are destinatarios with `kind = person`**; they're the people in Te deben, and incoming transfers matched to them become repayment cards.
- **UI removed:** destinatarios list, merge dialog, suggestions tab, rule editor. "Renombrar comercio" lives in Detalle; rules show read-only in Ajustes › Reglas.
- **Recurring stays exactly as the source of truth:** `recurring_transaction_templates` → `recurring_occurrences` (pending → paid / skipped), `findMatchingOccurrence` / anchored matching, `detectRecurringCandidates`, `ensureCurrentOccurrences`. Surfaced as **Pagos del ciclo**; candidates become Revisar cards ("¿Pagas Netflix cada mes?"); subscriptions are just bills; "Pendiente" occurrences feed "Por pagar" in Disponible.
- **Recurring UI removed:** template editor forms, Periodo/envelopes, the separate subscriptions screen, localStorage paid overlay.

### Change semantics
- **Splits:** today spending = `amount − split_repaid_amount` (your spending shrinks as friends repay). MLP: your share is spending from day one; the rest is a Te deben receivable. Disponible drops by the full amount. This needs a new "prestado" amount on the transaction (or a personal_debt origin leg), and the aggregates must move to it.
- **Budgets:** `budgets` rows reused as limits, but no 50/30/20, no wizard, no Plan/Periodo.

### Build new
- **Disponible engine** (pure function in `@zeta/shared`): cycles from paydays, bills, cuotas, card-payment neutralization, Te deben, trips, carryover, verdict with hysteresis.
- **Android notification capture:** an Expo native module (NotificationListenerService), app picker, on-device template engine, training inbox, signed template pack served from the backend, source health/heartbeat.
- **Gmail read-only ingestion:** OAuth, bank-sender query, 60-day backfill, reuses the email parsers.
- **Mobile UI:** 3 tabs (Inicio, Movimientos, Revisar), one Detalle sheet, Pagos, Te deben, Límites, Viaje, Ajustes, onboarding.
- **"Cuadrar con mi saldo"** (Zeta already has balance adjustments; reuse the model, new UI).

### Retire from the product (code/data kept, unreachable)
Web dashboard and ~25 web screens, 50/30/20, Plan/Periodo, debt planner/scenarios, deseos, ¿Comprarlo?, tendencias, tags UI, destinatarios UI (keep as internal merchant normalization), Telegram, voice, OCR, location, MCP, widget catalog, nav_focus, coach-marks.

## 5. Rebuild or improve?
**New mobile app shell on the existing engine.** The value that's hard to rebuild (parsers, email ingest, dedup, categorization rules, recurring, cuotas, schema, encryption) is all engine, and it's reusable. What's broken is the experience layer, which the MLP replaces entirely: ~30 screens become ~8. Patching today's mobile UI would drag in its vocabulary, 5 tabs, 3 row grammars and parity debt.

Open question: keep the mobile **offline SQLite sync engine** or go online-first with a local capture queue. Notification capture needs a durable on-device queue either way.
