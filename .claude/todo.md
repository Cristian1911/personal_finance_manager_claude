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

### Phase 1 Sprint 3
- Recurring transaction templates (`/recurrentes` page, form dialog, CRUD)
- Cascade delete: transactions auto-deleted when parent account is removed
- Category groups with combobox UI (command + popover components)
- Debt dashboard values fix (inverted amounts corrected)
- Password-protected PDF support:
  - Optional password input on upload step (lock icon, hint about cédula)
  - Password threaded through Next.js API route → FastAPI → pdfplumber
  - Non-encrypted PDFs unaffected (password defaults to None)

### Phase 2 Sprint 1
- Debt simulator `/deudas/simulador`:
  - Snowball vs Avalanche payoff strategy comparison
  - Extra monthly payment input, side-by-side strategy cards with "Recomendado" badge
  - AreaChart timeline showing balance reduction per strategy
  - Payoff order table (when each account reaches zero)
  - Pure client-side calculation engine (`debt-simulator.ts`)
- Bank parser scaffolds (NU Colombia, Lulo Bank, Banco de Bogotá):
  - Skeleton parsers with correct signatures and TODO placeholders
  - Shared parser utilities (`parsers/utils.py`)
  - Auto-detection keywords in `__init__.py` (specific banks before Bancolombia)
  - Awaiting sample PDFs to fill in regex parsing logic

## Pending

### Bank Parser Implementation
- Fill in parsing logic for NU, Lulo, Banco de Bogotá once sample PDFs are provided
- Each parser needs: regex patterns, number format, date format, transaction extraction

### SQLite Local-First Integration
- Want the app to work offline with local data
- Sync to Supabase when online for heavier operations
- Needs architectural research: PowerSync, ElectricSQL, or custom sync
- Major undertaking — affects auth, data layer, conflict resolution

### Future Ideas (Deferred)
- Balance-over-time charts from statement snapshots
- Payment reminders from payment_due_date
- Import reminder (nudge after ~30 days since last import)
- ML-based auto-categorization (Python service in `services/`)
