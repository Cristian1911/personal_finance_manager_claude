export const MIGRATIONS = [
  // v1: Core tables
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
  // Sync infrastructure
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
  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_unsynced ON sync_queue(synced_at) WHERE synced_at IS NULL`,
];
