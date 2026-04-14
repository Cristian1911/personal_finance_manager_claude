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
];

export const LATEST_DB_VERSION =
  DB_MIGRATIONS[DB_MIGRATIONS.length - 1]?.version ?? 1;
