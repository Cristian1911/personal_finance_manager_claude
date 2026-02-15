# Project Roadmap

## Completed

### Phase 0: Core Foundation
- User auth (signup, login, forgot/reset password)
- Account CRUD (all types: checking, savings, credit card, cash, investment, loan)
- Category system (17 flat seed categories, hierarchical support)
- Transaction CRUD with manual entry
- Dashboard with basic stats

### Phase 1 Sprint 1
- PDF import (upload → parse → review → bulk import)
- Bancolombia savings + credit card parsers
- Auto-categorization on import (keyword-based)
- Transaction `is_excluded` toggle (filtered from charts/dashboard)
- Debt dashboard `/deudas` (hero, utilization gauge, interest cost, per-account cards, insights)
- Category RLS fix (allows reading system categories with user_id IS NULL)

### Phase 1 Sprint 2
- Edit account form prefill bug fixed (specialized fields now populate from account data)
- Monthly PDF reload for credit cards:
  - `statement_snapshots` table stores metadata from each imported statement
  - Import now updates account metadata (balance, credit limit, interest rate, etc.)
  - Results page shows per-account diffs (old → new values)
  - Account detail page shows statement history timeline
  - Re-uploading same period upserts snapshot (no duplicates)

## Pending

### Password-protected PDFs
- Some Bancolombia PDFs are password-protected (password = document ID number)
- Add password input to the upload step
- Pass password to Python parser to unlock before parsing
- Could store password hint per institution in user settings

### SQLite Local-First Integration
- Want the app to work offline with local data
- Sync to Supabase when online for heavier operations
- Needs architectural research: PowerSync, ElectricSQL, or custom sync
- Major undertaking — affects auth, data layer, conflict resolution

### Future Ideas (Deferred)
- Debt simulator (Snowball vs Avalanche payoff strategies)
- Balance-over-time charts from statement snapshots
- Payment reminders from payment_due_date
- Import reminder (nudge after ~30 days since last import)
- More bank parsers (Davivienda, BBVA, Nequi)
- ML-based auto-categorization (Python service in `services/`)
