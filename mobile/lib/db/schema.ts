export type DbMigration = {
  version: number;
  statements: string[];
};

export const DB_MIGRATIONS: DbMigration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        institution_name TEXT,
        currency_code TEXT NOT NULL DEFAULT 'COP',
        current_balance REAL NOT NULL DEFAULT 0,
        available_balance REAL,
        credit_limit REAL,
        interest_rate REAL,
        is_active INTEGER NOT NULL DEFAULT 1,
        icon TEXT,
        color TEXT,
        monthly_payment REAL,
        payment_day INTEGER,
        cutoff_day INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        name_es TEXT,
        icon TEXT,
        color TEXT,
        expense_type TEXT,
        direction TEXT,
        parent_id TEXT,
        is_system INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        category_id TEXT,
        amount REAL NOT NULL,
        direction TEXT NOT NULL,
        description TEXT,
        merchant_name TEXT,
        raw_description TEXT,
        transaction_date TEXT NOT NULL,
        post_date TEXT,
        status TEXT NOT NULL DEFAULT 'POSTED',
        idempotency_key TEXT UNIQUE,
        is_excluded INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )`,
      `CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        email TEXT,
        full_name TEXT,
        app_purpose TEXT,
        estimated_monthly_income REAL,
        estimated_monthly_expenses REAL,
        preferred_currency TEXT DEFAULT 'COP',
        timezone TEXT,
        locale TEXT,
        onboarding_completed INTEGER NOT NULL DEFAULT 0,
        plan TEXT NOT NULL DEFAULT 'free',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        amount REAL NOT NULL,
        period TEXT NOT NULL DEFAULT 'monthly',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS statement_snapshots (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        period TEXT NOT NULL,
        statement_date TEXT,
        statement_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS sync_metadata (
        table_name TEXT PRIMARY KEY,
        last_synced_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key)`,
      `CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sync_queue_unsynced ON sync_queue(synced_at) WHERE synced_at IS NULL`,
    ],
  },
  {
    version: 2,
    statements: [
      `ALTER TABLE transactions ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'COP'`,
      `ALTER TABLE transactions ADD COLUMN provider TEXT NOT NULL DEFAULT 'MANUAL'`,
      `ALTER TABLE transactions ADD COLUMN capture_method TEXT NOT NULL DEFAULT 'MANUAL_FORM'`,
      `ALTER TABLE transactions ADD COLUMN capture_input_text TEXT`,
      `ALTER TABLE transactions ADD COLUMN reconciled_into_transaction_id TEXT`,
      `ALTER TABLE transactions ADD COLUMN reconciliation_score REAL`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_reconciled_visible ON transactions(reconciled_into_transaction_id, transaction_date)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_capture_method ON transactions(capture_method, transaction_date)`,
    ],
  },
  {
    version: 3,
    statements: [
      `ALTER TABLE accounts ADD COLUMN monthly_payment REAL`,
    ],
  },
  {
    version: 4,
    statements: [
      // ── Recurring transaction templates ───────────────────────────────
      `CREATE TABLE IF NOT EXISTS recurring_transaction_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        category_id TEXT,
        amount REAL NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'COP',
        direction TEXT NOT NULL,
        frequency TEXT NOT NULL,
        day_of_month INTEGER,
        day_of_week INTEGER,
        start_date TEXT NOT NULL,
        end_date TEXT,
        merchant_name TEXT,
        description TEXT,
        transfer_source_account_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )`,

      // ── Recurring occurrences ─────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS recurring_occurrences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        occurrence_date TEXT NOT NULL,
        expected_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        transaction_id TEXT,
        paid_at TEXT,
        skipped_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES recurring_transaction_templates(id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id)
      )`,

      // ── Destinatarios ─────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS destinatarios (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        name_hmac TEXT,
        default_category_id TEXT,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (default_category_id) REFERENCES categories(id)
      )`,

      // ── Destinatario rules ────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS destinatario_rules (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        destinatario_id TEXT NOT NULL,
        pattern TEXT NOT NULL,
        match_type TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        match_count INTEGER NOT NULL DEFAULT 0,
        last_matched_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (destinatario_id) REFERENCES destinatarios(id)
      )`,

      // ── Tag groups ────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS tag_groups (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        color TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,

      // ── Tags ──────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        color TEXT,
        group_id TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES tag_groups(id)
      )`,

      // ── Transaction tags (junction table) ─────────────────────────────
      `CREATE TABLE IF NOT EXISTS transaction_tags (
        transaction_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (transaction_id, tag_id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      )`,

      // ── Add destinatario_id to transactions ───────────────────────────
      `ALTER TABLE transactions ADD COLUMN destinatario_id TEXT`,

      // ── Indexes ───────────────────────────────────────────────────────
      `CREATE INDEX IF NOT EXISTS idx_recurring_templates_user ON recurring_transaction_templates(user_id, is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_template ON recurring_occurrences(template_id, occurrence_date)`,
      `CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_status ON recurring_occurrences(status, occurrence_date)`,
      `CREATE INDEX IF NOT EXISTS idx_destinatarios_user ON destinatarios(user_id, is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_destinatario_rules_dest ON destinatario_rules(destinatario_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tags_group ON tags(group_id)`,
      `CREATE INDEX IF NOT EXISTS idx_transaction_tags_tx ON transaction_tags(transaction_id)`,
      `CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag ON transaction_tags(tag_id)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_destinatario ON transactions(destinatario_id)`,
    ],
  },
  {
    version: 5,
    statements: [
      // ── Wishlist items (encrypted in Supabase, plaintext in SQLite) ────
      `CREATE TABLE IF NOT EXISTS wishlist_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'COP',
        status TEXT NOT NULL DEFAULT 'wishlist',
        desire_type TEXT,
        urgency TEXT,
        why TEXT,
        url TEXT,
        image_url TEXT,
        funding_type TEXT,
        installments INTEGER,
        account_id TEXT,
        category_id TEXT,
        transaction_id TEXT,
        last_score REAL,
        last_scored_at TEXT,
        last_verdict TEXT,
        last_nudge_dismissed_at TEXT,
        enriched INTEGER NOT NULL DEFAULT 0,
        enriched_at TEXT,
        ready_at TEXT,
        bought_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_wishlist_user_status ON wishlist_items(user_id, status)`,
    ],
  },
  {
    version: 6,
    statements: [
      // Add slug column to categories (webapp requires it)
      `ALTER TABLE categories ADD COLUMN slug TEXT`,
      // Add categorization_source to transactions (webapp sets it on category assignment)
      `ALTER TABLE transactions ADD COLUMN categorization_source TEXT`,
      // Fix wishlist status default to match Supabase CHECK constraint
      // Existing rows with 'WANT' status get corrected to 'wishlist'
      `UPDATE wishlist_items SET status = 'wishlist' WHERE status = 'WANT'`,
    ],
  },
  {
    version: 7,
    statements: [
      // ── accounts: new columns from webapp ─────────────────────────────
      `ALTER TABLE accounts ADD COLUMN show_in_dashboard INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE accounts ADD COLUMN card_brand TEXT`,
      `ALTER TABLE accounts ADD COLUMN debit_card_mask TEXT`,
      `ALTER TABLE accounts ADD COLUMN is_payroll_deducted INTEGER NOT NULL DEFAULT 0`,

      // ── transactions: installment & transfer tracking ─────────────────
      `ALTER TABLE transactions ADD COLUMN transfer_group_id TEXT`,
      `ALTER TABLE transactions ADD COLUMN original_amount REAL`,
      `ALTER TABLE transactions ADD COLUMN installment_current INTEGER`,
      `ALTER TABLE transactions ADD COLUMN installment_total INTEGER`,
      `ALTER TABLE transactions ADD COLUMN installment_group_id TEXT`,
      `ALTER TABLE transactions ADD COLUMN is_subscription INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE transactions ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0`,

      // ── recurring_occurrences: manual linkage flag ────────────────────
      `ALTER TABLE recurring_occurrences ADD COLUMN linked_manually INTEGER NOT NULL DEFAULT 0`,

      // ── transactions: indexes for new columns ─────────────────────────
      `CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group ON transactions(transfer_group_id) WHERE transfer_group_id IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_installment_group ON transactions(installment_group_id) WHERE installment_group_id IS NOT NULL`,
    ],
  },
  {
    version: 8,
    statements: [
      // ── accounts: close column drift vs Supabase view ─────────────────
      // `bank_key` was added in 20260418120000_add_bank_key_to_accounts.sql
      // but the SQLite schema never caught up — pull silently dropped it
      // every cycle. `pdf_password` is in the view but was also absent.
      `ALTER TABLE accounts ADD COLUMN bank_key TEXT`,
      `ALTER TABLE accounts ADD COLUMN pdf_password TEXT`,
    ],
  },
  {
    version: 9,
    statements: [
      // ── profiles: dashboard layout JSONB columns ──────────────────────
      // `dashboard_config` already exists on the Supabase view (webapp) but
      // was never mirrored locally — pull was dropping it on every cycle
      // (parity audit, slice-3). `mobile_dashboard_config` is new for the
      // mobile widget layout.
      `ALTER TABLE profiles ADD COLUMN dashboard_config TEXT`,
      `ALTER TABLE profiles ADD COLUMN mobile_dashboard_config TEXT`,
    ],
  },
  {
    version: 10,
    statements: [
      // ── recurring_transaction_templates: destinatario linkage ──────────
      // Webapp added this column in 20260417170859_add_destinatario_id_to_recurring_templates.sql.
      // Mobile needs it so the capture flow can link a new recurring template
      // to the destinatario created in the same save.
      `ALTER TABLE recurring_transaction_templates ADD COLUMN destinatario_id TEXT`,
    ],
  },
  {
    version: 11,
    statements: [
      // ── Cashflow planner (planning_*): /periodo screen now reads locally ──
      // Supabase schema in 20260407120000_create_cashflow_planner.sql +
      // 20260406200000_add_currency_to_planning_entries.sql. Mirror exactly
      // so sync pull/push can round-trip payloads.
      `CREATE TABLE IF NOT EXISTS planning_periods (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT,
        preset TEXT NOT NULL DEFAULT 'MONTHLY',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'COP',
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS planning_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        period_id TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        label TEXT NOT NULL,
        amount REAL NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'COP',
        expected_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PLANNED',
        completed_at TEXT,
        recurring_template_id TEXT,
        account_id TEXT,
        category_id TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (period_id) REFERENCES planning_periods(id)
      )`,
      `CREATE TABLE IF NOT EXISTS planning_assignments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        period_id TEXT NOT NULL,
        income_entry_id TEXT NOT NULL,
        expense_entry_id TEXT NOT NULL,
        assigned_amount REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (income_entry_id, expense_entry_id),
        FOREIGN KEY (period_id) REFERENCES planning_periods(id),
        FOREIGN KEY (income_entry_id) REFERENCES planning_entries(id),
        FOREIGN KEY (expense_entry_id) REFERENCES planning_entries(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_planning_periods_user_active ON planning_periods(user_id, is_active, start_date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_planning_entries_period ON planning_entries(period_id, entry_type, expected_date)`,
      `CREATE INDEX IF NOT EXISTS idx_planning_assignments_income ON planning_assignments(income_entry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_planning_assignments_expense ON planning_assignments(expense_entry_id)`,
    ],
  },
  {
    version: 12,
    statements: [
      // Close column drift surfaced by mobile-sync-doctor on the PaymentSheet
      // parity PR. PaymentSheet now stamps `recurrence_group_id` on linked
      // and system-created transactions (mirroring webapp); without the
      // mirror, getTableColumns() in pull.ts silently drops it every cycle.
      // (Note: `clean_description` is a separate pre-existing drift — the
      //  local column is named `description`, pulls drop the Supabase
      //  `clean_description` field. Out of scope for this PR.)
      `ALTER TABLE transactions ADD COLUMN recurrence_group_id TEXT`,
    ],
  },
  {
    version: 13,
    statements: [
      // ── Transaction time-of-day + linked location ─────────────────────
      `ALTER TABLE transactions ADD COLUMN transaction_time TEXT`,
      `ALTER TABLE transactions ADD COLUMN location_id TEXT`,

      // ── Opt-in flag on the local profile mirror ───────────────────────
      `ALTER TABLE profiles ADD COLUMN location_tracking_enabled INTEGER NOT NULL DEFAULT 0`,

      // ── transaction_locations: synced (decrypted view in Supabase) ────
      `CREATE TABLE IF NOT EXISTS transaction_locations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy_m REAL,
        place_name TEXT,
        place_locality TEXT,
        place_country TEXT,
        captured_at TEXT NOT NULL,
        linked_transaction_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tx_locations_user_captured ON transaction_locations(user_id, captured_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_tx_locations_linked_tx ON transaction_locations(linked_transaction_id)`,

      // ── location_pings: local-only buffer, never synced ───────────────
      // Background task writes here; linker.findNearestPing reads here.
      // Pings are pruned after they're consumed or after 14 days.
      `CREATE TABLE IF NOT EXISTS location_pings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy_m REAL,
        captured_at TEXT NOT NULL,
        consumed INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_location_pings_user_captured ON location_pings(user_id, captured_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_location_pings_consumed ON location_pings(consumed, captured_at)`,
    ],
  },
  {
    version: 14,
    statements: [
      // Categorization confidence (REAL 0..1) — populated by the import flow
      // when a destinatario rule supplies the category (mirrors webapp's
      // step-review.tsx, which stamps 0.8 for category+destinatario matches).
      // Pushed to Supabase via sync_queue so cross-platform rows agree.
      `ALTER TABLE transactions ADD COLUMN categorization_confidence REAL`,
    ],
  },
  {
    version: 15,
    statements: [
      // ── Subscriptions: read-only pull-only sync ───────────────────────────
      // Mirrors the plain (non-encrypted) `subscriptions` Supabase table.
      // Mobile has no UI for subscriptions yet — only synced for future reads.
      // Do NOT add to push.ts (mobile produces no subscription mutations).
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        destinatario_id TEXT NOT NULL,
        recurring_template_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        estimated_amount REAL,
        currency_code TEXT NOT NULL DEFAULT 'COP',
        trial_ends_on TEXT,
        cancel_url TEXT,
        detected_at TEXT,
        dismissed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (destinatario_id) REFERENCES destinatarios(id),
        FOREIGN KEY (recurring_template_id) REFERENCES recurring_transaction_templates(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_destinatario ON subscriptions(destinatario_id)`,
    ],
  },
  {
    version: 16,
    statements: [
      // ── Personal debts (lend/borrow tracker) — synced table ───────────────
      // Mirrors the plain (non-encrypted) `personal_debts` Supabase table/view.
      // Columns mirror the webapp's getPersonalDebtsCached select exactly — any
      // drift silently drops rows on every pull. Phase 1 is READ-ONLY (pull +
      // display), so it is NOT in push.ts — mirrors the subscriptions
      // precedent. Mobile write parity (create + repayment) ships in Phase 2.
      `CREATE TABLE IF NOT EXISTS personal_debts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        destinatario_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        principal_amount REAL NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'COP',
        outstanding_amount REAL NOT NULL,
        opened_on TEXT NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        origin_transaction_id TEXT,
        notes TEXT,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (destinatario_id) REFERENCES destinatarios(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_personal_debts_user_status ON personal_debts(user_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_personal_debts_destinatario ON personal_debts(destinatario_id)`,
      // New columns on existing tables (mirror the Supabase view columns).
      // destinatarios/transactions CREATE TABLE (v5) never included these, so a
      // plain ADD COLUMN on existing installs is safe (migrations run once).
      `ALTER TABLE destinatarios ADD COLUMN kind TEXT NOT NULL DEFAULT 'merchant'`,
      `ALTER TABLE transactions ADD COLUMN personal_debt_id TEXT`,
      `ALTER TABLE transactions ADD COLUMN pd_role TEXT`,
      // Index the repayment-sum lookup (getActivePersonalDebts subquery) so it
      // doesn't full-scan transactions per active debt on large histories.
      `CREATE INDEX IF NOT EXISTS idx_transactions_personal_debt ON transactions(personal_debt_id)`,
    ],
  },
  {
    version: 17,
    statements: [
      // ── accounts: multi-currency debt balances (ledger mutation layer) ────
      // Webapp persists per-currency debt detail in `currency_balances` (JSONB
      // on the Supabase accounts view). Each entry carries its own
      // total_payment_due / available_balance — there is NO top-level
      // total_payment_due column on accounts (that column belongs to
      // statement_snapshots). Mirror only the JSON column locally so the ledger
      // mutations (registerPayment, createTransfer, reconcileBalance,
      // recordRecurringOccurrencePayment) can write the shared debt payload and
      // pull/push round-trips don't drop it. Stored as TEXT (SQLite has no JSON).
      `ALTER TABLE accounts ADD COLUMN currency_balances TEXT`,
    ],
  },
  {
    version: 18,
    statements: [
      // Perf (2026-06-25 SQLite audit) — index coverage for the hot aggregation
      // and account-detail queries; drop two redundant indexes.
      //
      // idempotency_key is `TEXT UNIQUE` (already auto-indexed), so the explicit
      // index is redundant double b-tree maintenance on the import write path.
      `DROP INDEX IF EXISTS idx_transactions_idempotency`,
      // Covers getBudgetProgress' per-category JOIN, getTransactions({categoryId}),
      // and the `category_id IS NULL` uncategorized lookups (SQLite indexes NULLs).
      `CREATE INDEX IF NOT EXISTS idx_transactions_category_date ON transactions(category_id, transaction_date)`,
      // Composite for account-scoped history (getBalanceHistory LIMIT 5000,
      // getSpendingPulse, reconciliation) — avoids the account-scan + filesort.
      // Its (account_id) prefix subsumes the old single-column index → drop it.
      `CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, transaction_date)`,
      `DROP INDEX IF EXISTS idx_transactions_account`,
      // No new month-aggregation index: getMonthlyAggregates filters only on
      // transaction_date (+ reconciled_into IS NULL), already served by the
      // existing idx_transactions_date (v1); direction/is_excluded are reduced
      // in JS, so a wider composite would add write cost without a read gain.
    ],
  },
  {
    version: 19,
    statements: [
      // Category learning rules (mirror webapp `category_rules`). Written when a
      // user categorizes an uncategorized tx so the auto-categorizer improves and
      // the rule syncs to web / other devices. Same column set as the Supabase
      // table so pull/push round-trip cleanly. UNIQUE(user_id, pattern) is the
      // upsert key (auto-indexed).
      `CREATE TABLE IF NOT EXISTS category_rules (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        pattern TEXT NOT NULL,
        category_id TEXT NOT NULL,
        match_count INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, pattern),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )`,
    ],
  },
  {
    version: 20,
    statements: [
      // statement_snapshots: mirror the Supabase view columns so PDF-import
      // snapshots (credit limit, due date, statement balances) persist + sync,
      // and web-created snapshots pull down. The legacy local-only columns
      // (period NOT NULL, statement_date, statement_json) stay but are never
      // synced — the repo supplies `period` on INSERT and omits all three from
      // the sync payload. SQLite ADD COLUMN can't be NOT NULL without a default,
      // so every added column is nullable (the repo always populates them).
      `ALTER TABLE statement_snapshots ADD COLUMN period_from TEXT`,
      `ALTER TABLE statement_snapshots ADD COLUMN period_to TEXT`,
      `ALTER TABLE statement_snapshots ADD COLUMN currency_code TEXT`,
      `ALTER TABLE statement_snapshots ADD COLUMN previous_balance REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN total_credits REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN total_debits REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN final_balance REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN purchases_and_charges REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN interest_charged REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN credit_limit REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN available_credit REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN interest_rate REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN late_interest_rate REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN total_payment_due REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN minimum_payment REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN payment_due_date TEXT`,
      `ALTER TABLE statement_snapshots ADD COLUMN remaining_balance REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN initial_amount REAL`,
      `ALTER TABLE statement_snapshots ADD COLUMN installments_in_default INTEGER`,
      `ALTER TABLE statement_snapshots ADD COLUMN loan_number TEXT`,
      `ALTER TABLE statement_snapshots ADD COLUMN source_filename TEXT`,
      `ALTER TABLE statement_snapshots ADD COLUMN imported_count INTEGER`,
      `ALTER TABLE statement_snapshots ADD COLUMN transaction_count INTEGER`,
      `ALTER TABLE statement_snapshots ADD COLUMN skipped_count INTEGER`,
    ],
  },
  {
    version: 21,
    statements: [
      // expense_type (fixed/variable/null) drives the budget 50·30·20 split.
      // Synced automatically once the column exists (pull's upsertRow maps any
      // Supabase column present in the local table).
      `ALTER TABLE categories ADD COLUMN expense_type TEXT`,
    ],
  },
  {
    version: 22,
    statements: [
      // direction (INFLOW/OUTFLOW/null) — so mobile-created budget lines carry
      // their parent's side instead of landing NULL, which the webapp category
      // query (direction.eq.X,direction.is.null) would leak into BOTH pickers.
      // Synced automatically once the column exists (pull's upsertRow maps it).
      `ALTER TABLE categories ADD COLUMN direction TEXT`,
    ],
  },
];

export const LATEST_DB_VERSION =
  DB_MIGRATIONS[DB_MIGRATIONS.length - 1]?.version ?? 1;
