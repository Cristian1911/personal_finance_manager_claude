# Envelope Encryption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt all PII fields at rest using per-user envelope encryption, transparent to the application via PostgreSQL views and INSTEAD OF triggers.

**Architecture:** Envelope encryption with a master KEK in Supabase Vault encrypting per-user DEKs. Tables with PII are renamed to `_enc`, views with the original names decrypt transparently. INSTEAD OF triggers handle encrypt-on-write. Blind indexes (HMAC) enable exact-match lookups on encrypted fields.

**Tech Stack:** PostgreSQL 17, pgcrypto, Supabase Vault, PL/pgSQL SECURITY DEFINER functions

**Spec:** `docs/superpowers/specs/2026-04-07-envelope-encryption-design.md`

**Planning adjustments from spec:**
- `email_ingest_addresses.address_key` stays **plaintext** (system-generated lookup key needed for unauthenticated email routing — no PII value)
- `capture_tokens` gets a `token_hash` column (SHA-256) for unauthenticated Bearer token lookup
- Total encrypted columns: **26** across 9 tables (spec said 27 before address_key exclusion)
- Migration uses `ALTER COLUMN ... TYPE BYTEA USING zeta_encrypt_as(col, user_id)` — atomic type change + encryption in one pass
- `zeta_decrypt` and `zeta_hmac` marked `STABLE` for query optimizer column pruning (unused decrypt calls eliminated)
- Trigger functions are NOT `SECURITY DEFINER` — RLS enforced naturally through `security_invoker` views
- ILIKE search on encrypted fields works transparently through views (decrypted before WHERE evaluates) — only `capture_tokens.token` lookup needs app code change (unauthenticated context)

**Task dependency graph:**
```
Task 1 → [Tasks 2-10 in parallel] → [Tasks 11-12 in parallel] → Task 13
```

---

### Task 1: Infrastructure — key hierarchy, functions, signup trigger

**Files:**
- Create: `supabase/migrations/<timestamp>_envelope_encryption_infrastructure.sql`

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new envelope_encryption_infrastructure
```

Write the following SQL content:

```sql
-- ==================================================
-- Envelope Encryption Infrastructure
-- ==================================================

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 1. Create master key (KEK) in Vault
SELECT vault.create_secret(
  encode(gen_random_bytes(32), 'hex'),
  'zeta_master_key',
  'Master encryption key for Zeta envelope encryption'
);

-- 2. Create per-user encryption key table
CREATE TABLE user_encryption_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_dek BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_key" ON user_encryption_keys
  FOR ALL USING ((SELECT auth.uid()) = user_id);

-- 3. zeta_encrypt — encrypt plaintext using calling user's DEK
CREATE OR REPLACE FUNCTION zeta_encrypt(plaintext TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = (SELECT auth.uid());

  IF user_dek IS NULL THEN
    RAISE EXCEPTION 'No encryption key found for user %', (SELECT auth.uid());
  END IF;

  RETURN pgp_sym_encrypt(plaintext, user_dek);
END;
$$;

-- 4. zeta_decrypt — decrypt ciphertext using calling user's DEK
CREATE OR REPLACE FUNCTION zeta_decrypt(ciphertext BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = (SELECT auth.uid());

  IF user_dek IS NULL THEN RETURN NULL; END IF;

  RETURN pgp_sym_decrypt(ciphertext, user_dek);
END;
$$;

-- 5. zeta_encrypt_as — encrypt using specific user's DEK (migration only)
CREATE OR REPLACE FUNCTION zeta_encrypt_as(plaintext TEXT, target_user_id UUID)
RETURNS BYTEA
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = target_user_id;

  IF user_dek IS NULL THEN
    RAISE EXCEPTION 'No encryption key found for user %', target_user_id;
  END IF;

  RETURN pgp_sym_encrypt(plaintext, user_dek);
END;
$$;

-- 6. zeta_hmac — compute blind index using calling user's DEK
CREATE OR REPLACE FUNCTION zeta_hmac(plaintext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = (SELECT auth.uid());

  IF user_dek IS NULL THEN RETURN NULL; END IF;

  RETURN encode(hmac(lower(plaintext), user_dek, 'sha256'), 'hex');
END;
$$;

-- 7. zeta_hmac_as — compute HMAC using specific user's DEK (migration only)
CREATE OR REPLACE FUNCTION zeta_hmac_as(plaintext TEXT, target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = target_user_id;

  IF user_dek IS NULL THEN
    RAISE EXCEPTION 'No encryption key found for user %', target_user_id;
  END IF;

  RETURN encode(hmac(lower(plaintext), user_dek, 'sha256'), 'hex');
END;
$$;

-- 8. Restrict _as functions to postgres role only
REVOKE ALL ON FUNCTION zeta_encrypt_as(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION zeta_hmac_as(TEXT, UUID) FROM PUBLIC;

-- 9. Signup trigger — generate DEK for new users
CREATE OR REPLACE FUNCTION handle_new_user_encryption_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  master_key TEXT;
  new_dek TEXT;
BEGIN
  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  new_dek := encode(gen_random_bytes(32), 'hex');

  INSERT INTO user_encryption_keys (user_id, encrypted_dek)
  VALUES (NEW.id, pgp_sym_encrypt(new_dek, master_key));

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_encryption_key
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_encryption_key();

-- 10. Generate DEKs for existing users
INSERT INTO user_encryption_keys (user_id, encrypted_dek)
SELECT
  id,
  pgp_sym_encrypt(
    encode(gen_random_bytes(32), 'hex'),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'zeta_master_key')
  )
FROM auth.users
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

Verify via Supabase SQL Editor:
```sql
-- Check master key exists
SELECT name FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';
-- Should return 1 row

-- Check all users have DEKs
SELECT count(*) FROM user_encryption_keys;
SELECT count(*) FROM auth.users;
-- Counts must match

-- Test encrypt/decrypt round-trip (run as authenticated user via RPC or Supabase dashboard)
SELECT zeta_decrypt(zeta_encrypt('hello world'));
-- Should return 'hello world'
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*envelope_encryption_infrastructure*
git commit -m "feat: add envelope encryption infrastructure — vault key, DEK table, encrypt/decrypt functions"
```

---

### Task 2: Encrypt transactions table

**Files:**
- Create: `supabase/migrations/<timestamp>_encrypt_transactions.sql`

Transactions has 40 columns. 5 get encrypted (raw_description, clean_description, merchant_name, notes, capture_input_text). 2 HMAC columns added (merchant_name_hmac, clean_description_hmac).

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new encrypt_transactions
```

Write the following SQL:

```sql
-- ==================================================
-- Encrypt transactions table (5 encrypted, 2 HMAC)
-- ==================================================

-- 1. Rename table
ALTER TABLE transactions RENAME TO transactions_enc;

-- 2. Add HMAC columns and backfill while data is still plaintext
ALTER TABLE transactions_enc ADD COLUMN merchant_name_hmac TEXT;
ALTER TABLE transactions_enc ADD COLUMN clean_description_hmac TEXT;

UPDATE transactions_enc SET
  merchant_name_hmac = zeta_hmac_as(merchant_name, user_id)
WHERE merchant_name IS NOT NULL;

UPDATE transactions_enc SET
  clean_description_hmac = zeta_hmac_as(clean_description, user_id)
WHERE clean_description IS NOT NULL;

-- 3. Encrypt columns — atomic type change + encryption per column
ALTER TABLE transactions_enc
  ALTER COLUMN raw_description TYPE BYTEA USING zeta_encrypt_as(raw_description, user_id);
ALTER TABLE transactions_enc
  ALTER COLUMN clean_description TYPE BYTEA USING zeta_encrypt_as(clean_description, user_id);
ALTER TABLE transactions_enc
  ALTER COLUMN merchant_name TYPE BYTEA USING zeta_encrypt_as(merchant_name, user_id);
ALTER TABLE transactions_enc
  ALTER COLUMN notes TYPE BYTEA USING zeta_encrypt_as(notes, user_id);
ALTER TABLE transactions_enc
  ALTER COLUMN capture_input_text TYPE BYTEA USING zeta_encrypt_as(capture_input_text, user_id);

-- 4. Create decrypted view
CREATE VIEW transactions WITH (security_invoker = true) AS
SELECT
  account_id, amount, amount_in_base_currency,
  zeta_decrypt(capture_input_text) AS capture_input_text,
  capture_method, categorization_confidence, categorization_source,
  category_id,
  zeta_decrypt(clean_description) AS clean_description,
  clean_description_hmac, created_at, currency_code, destinatario_id,
  direction, exchange_rate, id, idempotency_key, installment_current,
  installment_group_id, installment_total, is_excluded, is_recurring,
  is_subscription, merchant_category_code, merchant_logo_url,
  zeta_decrypt(merchant_name) AS merchant_name,
  merchant_name_hmac,
  zeta_decrypt(notes) AS notes,
  original_amount, posting_date, provider, provider_transaction_id,
  zeta_decrypt(raw_description) AS raw_description,
  reconciled_into_transaction_id, reconciliation_score,
  recurrence_group_id, secondary_category_id, status, tags,
  transaction_date, updated_at, user_id
FROM transactions_enc;

-- 5. INSTEAD OF INSERT trigger
CREATE OR REPLACE FUNCTION transactions_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO transactions_enc (
    account_id, amount, amount_in_base_currency, capture_input_text,
    capture_method, categorization_confidence, categorization_source,
    category_id, clean_description, clean_description_hmac, created_at,
    currency_code, destinatario_id, direction, exchange_rate, id,
    idempotency_key, installment_current, installment_group_id,
    installment_total, is_excluded, is_recurring, is_subscription,
    merchant_category_code, merchant_logo_url, merchant_name,
    merchant_name_hmac, notes, original_amount, posting_date, provider,
    provider_transaction_id, raw_description,
    reconciled_into_transaction_id, reconciliation_score,
    recurrence_group_id, secondary_category_id, status, tags,
    transaction_date, updated_at, user_id
  ) VALUES (
    NEW.account_id, NEW.amount, NEW.amount_in_base_currency,
    zeta_encrypt(NEW.capture_input_text),
    NEW.capture_method, NEW.categorization_confidence,
    NEW.categorization_source, NEW.category_id,
    zeta_encrypt(NEW.clean_description),
    zeta_hmac(NEW.clean_description),
    NEW.created_at, NEW.currency_code, NEW.destinatario_id,
    NEW.direction, NEW.exchange_rate, NEW.id, NEW.idempotency_key,
    NEW.installment_current, NEW.installment_group_id,
    NEW.installment_total, NEW.is_excluded, NEW.is_recurring,
    NEW.is_subscription, NEW.merchant_category_code,
    NEW.merchant_logo_url,
    zeta_encrypt(NEW.merchant_name),
    zeta_hmac(NEW.merchant_name),
    zeta_encrypt(NEW.notes),
    NEW.original_amount, NEW.posting_date, NEW.provider,
    NEW.provider_transaction_id,
    zeta_encrypt(NEW.raw_description),
    NEW.reconciled_into_transaction_id, NEW.reconciliation_score,
    NEW.recurrence_group_id, NEW.secondary_category_id, NEW.status,
    NEW.tags, NEW.transaction_date, NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_view_insert_trg
  INSTEAD OF INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_view_insert();

-- 6. INSTEAD OF UPDATE trigger
CREATE OR REPLACE FUNCTION transactions_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE transactions_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    amount_in_base_currency = NEW.amount_in_base_currency,
    capture_input_text = zeta_encrypt(NEW.capture_input_text),
    capture_method = NEW.capture_method,
    categorization_confidence = NEW.categorization_confidence,
    categorization_source = NEW.categorization_source,
    category_id = NEW.category_id,
    clean_description = zeta_encrypt(NEW.clean_description),
    clean_description_hmac = zeta_hmac(NEW.clean_description),
    created_at = NEW.created_at,
    currency_code = NEW.currency_code,
    destinatario_id = NEW.destinatario_id,
    direction = NEW.direction,
    exchange_rate = NEW.exchange_rate,
    idempotency_key = NEW.idempotency_key,
    installment_current = NEW.installment_current,
    installment_group_id = NEW.installment_group_id,
    installment_total = NEW.installment_total,
    is_excluded = NEW.is_excluded,
    is_recurring = NEW.is_recurring,
    is_subscription = NEW.is_subscription,
    merchant_category_code = NEW.merchant_category_code,
    merchant_logo_url = NEW.merchant_logo_url,
    merchant_name = zeta_encrypt(NEW.merchant_name),
    merchant_name_hmac = zeta_hmac(NEW.merchant_name),
    notes = zeta_encrypt(NEW.notes),
    original_amount = NEW.original_amount,
    posting_date = NEW.posting_date,
    provider = NEW.provider,
    provider_transaction_id = NEW.provider_transaction_id,
    raw_description = zeta_encrypt(NEW.raw_description),
    reconciled_into_transaction_id = NEW.reconciled_into_transaction_id,
    reconciliation_score = NEW.reconciliation_score,
    recurrence_group_id = NEW.recurrence_group_id,
    secondary_category_id = NEW.secondary_category_id,
    status = NEW.status,
    tags = NEW.tags,
    transaction_date = NEW.transaction_date,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_view_update_trg
  INSTEAD OF UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_view_update();

-- 7. INSTEAD OF DELETE trigger
CREATE OR REPLACE FUNCTION transactions_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM transactions_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_view_delete_trg
  INSTEAD OF DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_view_delete();

-- 8. Grant permissions on view
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO authenticated;
GRANT ALL ON transactions TO postgres, service_role;
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

Verify via Supabase SQL Editor:
```sql
-- Raw table shows ciphertext
SELECT raw_description FROM transactions_enc LIMIT 3;

-- View shows plaintext (run as authenticated user)
SELECT raw_description, merchant_name FROM transactions LIMIT 3;

-- Row counts match
SELECT count(*) FROM transactions_enc;
SELECT count(*) FROM transactions;

-- HMAC populated
SELECT merchant_name_hmac FROM transactions_enc WHERE merchant_name IS NOT NULL LIMIT 3;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*encrypt_transactions*
git commit -m "feat: encrypt transactions table — 5 PII columns + 2 HMAC blind indexes"
```

---

### Task 3: Encrypt accounts table

**Files:**
- Create: `supabase/migrations/<timestamp>_encrypt_accounts.sql`

Accounts has 34 columns. 6 get encrypted (name, institution_name, mask, debit_card_mask, pdf_password, provider_account_id). 1 HMAC added (mask_hmac).

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new encrypt_accounts
```

Write the following SQL:

```sql
-- ==================================================
-- Encrypt accounts table (6 encrypted, 1 HMAC)
-- ==================================================

-- 1. Rename
ALTER TABLE accounts RENAME TO accounts_enc;

-- 2. Add HMAC and backfill
ALTER TABLE accounts_enc ADD COLUMN mask_hmac TEXT;
UPDATE accounts_enc SET mask_hmac = zeta_hmac_as(mask, user_id) WHERE mask IS NOT NULL;

-- 3. Encrypt columns
ALTER TABLE accounts_enc
  ALTER COLUMN name TYPE BYTEA USING zeta_encrypt_as(name, user_id);
ALTER TABLE accounts_enc
  ALTER COLUMN institution_name TYPE BYTEA USING zeta_encrypt_as(institution_name, user_id);
ALTER TABLE accounts_enc
  ALTER COLUMN mask TYPE BYTEA USING zeta_encrypt_as(mask, user_id);
ALTER TABLE accounts_enc
  ALTER COLUMN debit_card_mask TYPE BYTEA USING zeta_encrypt_as(debit_card_mask, user_id);
ALTER TABLE accounts_enc
  ALTER COLUMN pdf_password TYPE BYTEA USING zeta_encrypt_as(pdf_password, user_id);
ALTER TABLE accounts_enc
  ALTER COLUMN provider_account_id TYPE BYTEA USING zeta_encrypt_as(provider_account_id, user_id);

-- 4. Create decrypted view
CREATE VIEW accounts WITH (security_invoker = true) AS
SELECT
  account_type, available_balance, color, connection_status, created_at,
  credit_limit, currency_balances, currency_code, current_balance, cutoff_day,
  zeta_decrypt(debit_card_mask) AS debit_card_mask,
  display_order, expected_return_rate, icon, id, initial_investment,
  zeta_decrypt(institution_name) AS institution_name,
  interest_rate, is_active, last_synced_at, loan_amount, loan_end_date,
  loan_start_date,
  zeta_decrypt(mask) AS mask,
  mask_hmac, maturity_date, monthly_payment,
  zeta_decrypt(name) AS name,
  payment_day,
  zeta_decrypt(pdf_password) AS pdf_password,
  provider,
  zeta_decrypt(provider_account_id) AS provider_account_id,
  show_in_dashboard, updated_at, user_id
FROM accounts_enc;

-- 5. INSTEAD OF INSERT
CREATE OR REPLACE FUNCTION accounts_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO accounts_enc (
    account_type, available_balance, color, connection_status, created_at,
    credit_limit, currency_balances, currency_code, current_balance, cutoff_day,
    debit_card_mask, display_order, expected_return_rate, icon, id,
    initial_investment, institution_name, interest_rate, is_active,
    last_synced_at, loan_amount, loan_end_date, loan_start_date, mask,
    mask_hmac, maturity_date, monthly_payment, name, payment_day,
    pdf_password, provider, provider_account_id, show_in_dashboard,
    updated_at, user_id
  ) VALUES (
    NEW.account_type, NEW.available_balance, NEW.color, NEW.connection_status,
    NEW.created_at, NEW.credit_limit, NEW.currency_balances, NEW.currency_code,
    NEW.current_balance, NEW.cutoff_day,
    zeta_encrypt(NEW.debit_card_mask),
    NEW.display_order, NEW.expected_return_rate, NEW.icon, NEW.id,
    NEW.initial_investment,
    zeta_encrypt(NEW.institution_name),
    NEW.interest_rate, NEW.is_active, NEW.last_synced_at, NEW.loan_amount,
    NEW.loan_end_date, NEW.loan_start_date,
    zeta_encrypt(NEW.mask),
    zeta_hmac(NEW.mask),
    NEW.maturity_date, NEW.monthly_payment,
    zeta_encrypt(NEW.name),
    NEW.payment_day,
    zeta_encrypt(NEW.pdf_password),
    NEW.provider,
    zeta_encrypt(NEW.provider_account_id),
    NEW.show_in_dashboard, NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_view_insert_trg
  INSTEAD OF INSERT ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_view_insert();

-- 6. INSTEAD OF UPDATE
CREATE OR REPLACE FUNCTION accounts_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE accounts_enc SET
    account_type = NEW.account_type,
    available_balance = NEW.available_balance,
    color = NEW.color,
    connection_status = NEW.connection_status,
    created_at = NEW.created_at,
    credit_limit = NEW.credit_limit,
    currency_balances = NEW.currency_balances,
    currency_code = NEW.currency_code,
    current_balance = NEW.current_balance,
    cutoff_day = NEW.cutoff_day,
    debit_card_mask = zeta_encrypt(NEW.debit_card_mask),
    display_order = NEW.display_order,
    expected_return_rate = NEW.expected_return_rate,
    icon = NEW.icon,
    initial_investment = NEW.initial_investment,
    institution_name = zeta_encrypt(NEW.institution_name),
    interest_rate = NEW.interest_rate,
    is_active = NEW.is_active,
    last_synced_at = NEW.last_synced_at,
    loan_amount = NEW.loan_amount,
    loan_end_date = NEW.loan_end_date,
    loan_start_date = NEW.loan_start_date,
    mask = zeta_encrypt(NEW.mask),
    mask_hmac = zeta_hmac(NEW.mask),
    maturity_date = NEW.maturity_date,
    monthly_payment = NEW.monthly_payment,
    name = zeta_encrypt(NEW.name),
    payment_day = NEW.payment_day,
    pdf_password = zeta_encrypt(NEW.pdf_password),
    provider = NEW.provider,
    provider_account_id = zeta_encrypt(NEW.provider_account_id),
    show_in_dashboard = NEW.show_in_dashboard,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_view_update_trg
  INSTEAD OF UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_view_update();

-- 7. INSTEAD OF DELETE
CREATE OR REPLACE FUNCTION accounts_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM accounts_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_view_delete_trg
  INSTEAD OF DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_view_delete();

-- 8. Grant
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO authenticated;
GRANT ALL ON accounts TO postgres, service_role;
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

Verify: `SELECT name, mask FROM accounts LIMIT 3;` should show plaintext. `SELECT name FROM accounts_enc LIMIT 3;` should show bytea.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*encrypt_accounts*
git commit -m "feat: encrypt accounts table — 6 PII columns + mask HMAC blind index"
```

---

### Task 4: Encrypt profiles table

**Files:**
- Create: `supabase/migrations/<timestamp>_encrypt_profiles.sql`

Profiles has 16 columns. 2 encrypted (full_name, email). No HMAC. Note: PK is `id` which equals the user's UUID — use `id` instead of `user_id` in `zeta_encrypt_as`.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new encrypt_profiles
```

```sql
-- ==================================================
-- Encrypt profiles table (2 encrypted)
-- ==================================================

ALTER TABLE profiles RENAME TO profiles_enc;

ALTER TABLE profiles_enc
  ALTER COLUMN full_name TYPE BYTEA USING zeta_encrypt_as(full_name, id);
ALTER TABLE profiles_enc
  ALTER COLUMN email TYPE BYTEA USING zeta_encrypt_as(email, id);

CREATE VIEW profiles WITH (security_invoker = true) AS
SELECT
  app_purpose, avatar_url, budget_mode, created_at, dashboard_config,
  zeta_decrypt(email) AS email,
  estimated_monthly_expenses, estimated_monthly_income,
  zeta_decrypt(full_name) AS full_name,
  id, locale, monthly_salary, onboarding_completed, preferred_currency,
  timezone, updated_at
FROM profiles_enc;

CREATE OR REPLACE FUNCTION profiles_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles_enc (
    app_purpose, avatar_url, budget_mode, created_at, dashboard_config,
    email, estimated_monthly_expenses, estimated_monthly_income, full_name,
    id, locale, monthly_salary, onboarding_completed, preferred_currency,
    timezone, updated_at
  ) VALUES (
    NEW.app_purpose, NEW.avatar_url, NEW.budget_mode, NEW.created_at,
    NEW.dashboard_config,
    zeta_encrypt(NEW.email),
    NEW.estimated_monthly_expenses, NEW.estimated_monthly_income,
    zeta_encrypt(NEW.full_name),
    NEW.id, NEW.locale, NEW.monthly_salary, NEW.onboarding_completed,
    NEW.preferred_currency, NEW.timezone, NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_view_insert_trg
  INSTEAD OF INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_view_insert();

CREATE OR REPLACE FUNCTION profiles_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles_enc SET
    app_purpose = NEW.app_purpose,
    avatar_url = NEW.avatar_url,
    budget_mode = NEW.budget_mode,
    created_at = NEW.created_at,
    dashboard_config = NEW.dashboard_config,
    email = zeta_encrypt(NEW.email),
    estimated_monthly_expenses = NEW.estimated_monthly_expenses,
    estimated_monthly_income = NEW.estimated_monthly_income,
    full_name = zeta_encrypt(NEW.full_name),
    locale = NEW.locale,
    monthly_salary = NEW.monthly_salary,
    onboarding_completed = NEW.onboarding_completed,
    preferred_currency = NEW.preferred_currency,
    timezone = NEW.timezone,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_view_update_trg
  INSTEAD OF UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_view_update();

CREATE OR REPLACE FUNCTION profiles_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM profiles_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_view_delete_trg
  INSTEAD OF DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT ALL ON profiles TO postgres, service_role;
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*encrypt_profiles*
git commit -m "feat: encrypt profiles table — full_name + email"
```

---

### Task 5: Encrypt destinatarios table

**Files:**
- Create: `supabase/migrations/<timestamp>_encrypt_destinatarios.sql`

8 columns. 2 encrypted (name, notes). 1 HMAC (name_hmac).

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new encrypt_destinatarios
```

```sql
-- ==================================================
-- Encrypt destinatarios table (2 encrypted, 1 HMAC)
-- ==================================================

ALTER TABLE destinatarios RENAME TO destinatarios_enc;

ALTER TABLE destinatarios_enc ADD COLUMN name_hmac TEXT;
UPDATE destinatarios_enc SET name_hmac = zeta_hmac_as(name, user_id) WHERE name IS NOT NULL;

ALTER TABLE destinatarios_enc
  ALTER COLUMN name TYPE BYTEA USING zeta_encrypt_as(name, user_id);
ALTER TABLE destinatarios_enc
  ALTER COLUMN notes TYPE BYTEA USING zeta_encrypt_as(notes, user_id);

CREATE VIEW destinatarios WITH (security_invoker = true) AS
SELECT
  created_at, default_category_id, id, is_active,
  zeta_decrypt(name) AS name,
  name_hmac,
  zeta_decrypt(notes) AS notes,
  updated_at, user_id
FROM destinatarios_enc;

CREATE OR REPLACE FUNCTION destinatarios_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO destinatarios_enc (
    created_at, default_category_id, id, is_active, name, name_hmac,
    notes, updated_at, user_id
  ) VALUES (
    NEW.created_at, NEW.default_category_id, NEW.id, NEW.is_active,
    zeta_encrypt(NEW.name),
    zeta_hmac(NEW.name),
    zeta_encrypt(NEW.notes),
    NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER destinatarios_view_insert_trg
  INSTEAD OF INSERT ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_insert();

CREATE OR REPLACE FUNCTION destinatarios_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE destinatarios_enc SET
    created_at = NEW.created_at,
    default_category_id = NEW.default_category_id,
    is_active = NEW.is_active,
    name = zeta_encrypt(NEW.name),
    name_hmac = zeta_hmac(NEW.name),
    notes = zeta_encrypt(NEW.notes),
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER destinatarios_view_update_trg
  INSTEAD OF UPDATE ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_update();

CREATE OR REPLACE FUNCTION destinatarios_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM destinatarios_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER destinatarios_view_delete_trg
  INSTEAD OF DELETE ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON destinatarios TO authenticated;
GRANT ALL ON destinatarios TO postgres, service_role;
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*encrypt_destinatarios*
git commit -m "feat: encrypt destinatarios table — name + notes + HMAC blind index"
```

---

### Task 6: Encrypt statement_snapshots table

**Files:**
- Create: `supabase/migrations/<timestamp>_encrypt_statement_snapshots.sql`

29 columns. 2 encrypted (loan_number, source_filename). No HMAC.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new encrypt_statement_snapshots
```

```sql
-- ==================================================
-- Encrypt statement_snapshots table (2 encrypted)
-- ==================================================

ALTER TABLE statement_snapshots RENAME TO statement_snapshots_enc;

ALTER TABLE statement_snapshots_enc
  ALTER COLUMN loan_number TYPE BYTEA USING zeta_encrypt_as(loan_number, user_id);
ALTER TABLE statement_snapshots_enc
  ALTER COLUMN source_filename TYPE BYTEA USING zeta_encrypt_as(source_filename, user_id);

CREATE VIEW statement_snapshots WITH (security_invoker = true) AS
SELECT
  account_id, available_credit, created_at, credit_limit, currency_code,
  final_balance, id, imported_count, initial_amount, installments_in_default,
  interest_charged, interest_rate, late_interest_rate,
  zeta_decrypt(loan_number) AS loan_number,
  minimum_payment, payment_due_date, period_from, period_to, previous_balance,
  purchases_and_charges, remaining_balance, skipped_count,
  zeta_decrypt(source_filename) AS source_filename,
  total_credits, total_debits, total_payment_due, transaction_count,
  updated_at, user_id
FROM statement_snapshots_enc;

CREATE OR REPLACE FUNCTION statement_snapshots_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO statement_snapshots_enc (
    account_id, available_credit, created_at, credit_limit, currency_code,
    final_balance, id, imported_count, initial_amount, installments_in_default,
    interest_charged, interest_rate, late_interest_rate, loan_number,
    minimum_payment, payment_due_date, period_from, period_to, previous_balance,
    purchases_and_charges, remaining_balance, skipped_count, source_filename,
    total_credits, total_debits, total_payment_due, transaction_count,
    updated_at, user_id
  ) VALUES (
    NEW.account_id, NEW.available_credit, NEW.created_at, NEW.credit_limit,
    NEW.currency_code, NEW.final_balance, NEW.id, NEW.imported_count,
    NEW.initial_amount, NEW.installments_in_default, NEW.interest_charged,
    NEW.interest_rate, NEW.late_interest_rate,
    zeta_encrypt(NEW.loan_number),
    NEW.minimum_payment, NEW.payment_due_date, NEW.period_from, NEW.period_to,
    NEW.previous_balance, NEW.purchases_and_charges, NEW.remaining_balance,
    NEW.skipped_count,
    zeta_encrypt(NEW.source_filename),
    NEW.total_credits, NEW.total_debits, NEW.total_payment_due,
    NEW.transaction_count, NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER statement_snapshots_view_insert_trg
  INSTEAD OF INSERT ON statement_snapshots
  FOR EACH ROW EXECUTE FUNCTION statement_snapshots_view_insert();

CREATE OR REPLACE FUNCTION statement_snapshots_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE statement_snapshots_enc SET
    account_id = NEW.account_id,
    available_credit = NEW.available_credit,
    created_at = NEW.created_at,
    credit_limit = NEW.credit_limit,
    currency_code = NEW.currency_code,
    final_balance = NEW.final_balance,
    imported_count = NEW.imported_count,
    initial_amount = NEW.initial_amount,
    installments_in_default = NEW.installments_in_default,
    interest_charged = NEW.interest_charged,
    interest_rate = NEW.interest_rate,
    late_interest_rate = NEW.late_interest_rate,
    loan_number = zeta_encrypt(NEW.loan_number),
    minimum_payment = NEW.minimum_payment,
    payment_due_date = NEW.payment_due_date,
    period_from = NEW.period_from,
    period_to = NEW.period_to,
    previous_balance = NEW.previous_balance,
    purchases_and_charges = NEW.purchases_and_charges,
    remaining_balance = NEW.remaining_balance,
    skipped_count = NEW.skipped_count,
    source_filename = zeta_encrypt(NEW.source_filename),
    total_credits = NEW.total_credits,
    total_debits = NEW.total_debits,
    total_payment_due = NEW.total_payment_due,
    transaction_count = NEW.transaction_count,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER statement_snapshots_view_update_trg
  INSTEAD OF UPDATE ON statement_snapshots
  FOR EACH ROW EXECUTE FUNCTION statement_snapshots_view_update();

CREATE OR REPLACE FUNCTION statement_snapshots_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM statement_snapshots_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER statement_snapshots_view_delete_trg
  INSTEAD OF DELETE ON statement_snapshots
  FOR EACH ROW EXECUTE FUNCTION statement_snapshots_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON statement_snapshots TO authenticated;
GRANT ALL ON statement_snapshots TO postgres, service_role;
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*encrypt_statement_snapshots*
git commit -m "feat: encrypt statement_snapshots — loan_number + source_filename"
```

---

### Task 7: Encrypt capture_tokens table

**Files:**
- Create: `supabase/migrations/<timestamp>_encrypt_capture_tokens.sql`

8 columns. 2 encrypted (token, label). 1 hash column added (token_hash — SHA-256, not per-user HMAC, for unauthenticated Bearer token lookup).

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new encrypt_capture_tokens
```

```sql
-- ==================================================
-- Encrypt capture_tokens table (2 encrypted, 1 hash)
-- ==================================================

ALTER TABLE capture_tokens RENAME TO capture_tokens_enc;

-- token_hash: SHA-256 of plaintext token for unauthenticated lookup
-- NOT a per-user HMAC — system-wide hash for API auth flow
ALTER TABLE capture_tokens_enc ADD COLUMN token_hash TEXT;
UPDATE capture_tokens_enc SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token IS NOT NULL;

ALTER TABLE capture_tokens_enc
  ALTER COLUMN token TYPE BYTEA USING zeta_encrypt_as(token, user_id);
ALTER TABLE capture_tokens_enc
  ALTER COLUMN label TYPE BYTEA USING zeta_encrypt_as(label, user_id);

CREATE VIEW capture_tokens WITH (security_invoker = true) AS
SELECT
  created_at, default_account_id, id,
  zeta_decrypt(label) AS label,
  last_used_at, revoked_at,
  zeta_decrypt(token) AS token,
  token_hash, user_id
FROM capture_tokens_enc;

CREATE OR REPLACE FUNCTION capture_tokens_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO capture_tokens_enc (
    created_at, default_account_id, id, label, last_used_at, revoked_at,
    token, token_hash, user_id
  ) VALUES (
    NEW.created_at, NEW.default_account_id, NEW.id,
    zeta_encrypt(NEW.label),
    NEW.last_used_at, NEW.revoked_at,
    zeta_encrypt(NEW.token),
    encode(digest(NEW.token, 'sha256'), 'hex'),
    NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER capture_tokens_view_insert_trg
  INSTEAD OF INSERT ON capture_tokens
  FOR EACH ROW EXECUTE FUNCTION capture_tokens_view_insert();

CREATE OR REPLACE FUNCTION capture_tokens_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE capture_tokens_enc SET
    created_at = NEW.created_at,
    default_account_id = NEW.default_account_id,
    label = zeta_encrypt(NEW.label),
    last_used_at = NEW.last_used_at,
    revoked_at = NEW.revoked_at,
    token = zeta_encrypt(NEW.token),
    token_hash = encode(digest(NEW.token, 'sha256'), 'hex'),
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER capture_tokens_view_update_trg
  INSTEAD OF UPDATE ON capture_tokens
  FOR EACH ROW EXECUTE FUNCTION capture_tokens_view_update();

CREATE OR REPLACE FUNCTION capture_tokens_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM capture_tokens_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER capture_tokens_view_delete_trg
  INSTEAD OF DELETE ON capture_tokens
  FOR EACH ROW EXECUTE FUNCTION capture_tokens_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON capture_tokens TO authenticated;
GRANT ALL ON capture_tokens TO postgres, service_role;
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*encrypt_capture_tokens*
git commit -m "feat: encrypt capture_tokens — token + label + SHA-256 hash for lookup"
```

---

### Task 8: Encrypt email_ingest_addresses table

**Files:**
- Create: `supabase/migrations/<timestamp>_encrypt_email_ingest_addresses.sql`

11 columns. 2 encrypted (allowed_sender, gmail_verification_url). `address_key` stays plaintext — it's a system-generated random string needed for unauthenticated email routing.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new encrypt_email_ingest_addresses
```

```sql
-- ==================================================
-- Encrypt email_ingest_addresses table (2 encrypted)
-- address_key stays plaintext (routing lookup key)
-- ==================================================

ALTER TABLE email_ingest_addresses RENAME TO email_ingest_addresses_enc;

ALTER TABLE email_ingest_addresses_enc
  ALTER COLUMN allowed_sender TYPE BYTEA USING zeta_encrypt_as(allowed_sender, user_id);
ALTER TABLE email_ingest_addresses_enc
  ALTER COLUMN gmail_verification_url TYPE BYTEA USING zeta_encrypt_as(gmail_verification_url, user_id);

CREATE VIEW email_ingest_addresses WITH (security_invoker = true) AS
SELECT
  account_id, address_key,
  zeta_decrypt(allowed_sender) AS allowed_sender,
  auto_import, created_at, gmail_verification_at,
  zeta_decrypt(gmail_verification_url) AS gmail_verification_url,
  id, is_active, pdf_import_enabled, user_id
FROM email_ingest_addresses_enc;

CREATE OR REPLACE FUNCTION email_ingest_addresses_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO email_ingest_addresses_enc (
    account_id, address_key, allowed_sender, auto_import, created_at,
    gmail_verification_at, gmail_verification_url, id, is_active,
    pdf_import_enabled, user_id
  ) VALUES (
    NEW.account_id, NEW.address_key,
    zeta_encrypt(NEW.allowed_sender),
    NEW.auto_import, NEW.created_at, NEW.gmail_verification_at,
    zeta_encrypt(NEW.gmail_verification_url),
    NEW.id, NEW.is_active, NEW.pdf_import_enabled, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_ingest_addresses_view_insert_trg
  INSTEAD OF INSERT ON email_ingest_addresses
  FOR EACH ROW EXECUTE FUNCTION email_ingest_addresses_view_insert();

CREATE OR REPLACE FUNCTION email_ingest_addresses_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE email_ingest_addresses_enc SET
    account_id = NEW.account_id,
    address_key = NEW.address_key,
    allowed_sender = zeta_encrypt(NEW.allowed_sender),
    auto_import = NEW.auto_import,
    created_at = NEW.created_at,
    gmail_verification_at = NEW.gmail_verification_at,
    gmail_verification_url = zeta_encrypt(NEW.gmail_verification_url),
    is_active = NEW.is_active,
    pdf_import_enabled = NEW.pdf_import_enabled,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_ingest_addresses_view_update_trg
  INSTEAD OF UPDATE ON email_ingest_addresses
  FOR EACH ROW EXECUTE FUNCTION email_ingest_addresses_view_update();

CREATE OR REPLACE FUNCTION email_ingest_addresses_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM email_ingest_addresses_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_ingest_addresses_view_delete_trg
  INSTEAD OF DELETE ON email_ingest_addresses
  FOR EACH ROW EXECUTE FUNCTION email_ingest_addresses_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON email_ingest_addresses TO authenticated;
GRANT ALL ON email_ingest_addresses TO postgres, service_role;
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*encrypt_email_ingest*
git commit -m "feat: encrypt email_ingest_addresses — allowed_sender + gmail_verification_url"
```

---

### Task 9: Encrypt recurring_transaction_templates table

**Files:**
- Create: `supabase/migrations/<timestamp>_encrypt_recurring_templates.sql`

18 columns. 2 encrypted (description, merchant_name). No HMAC.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new encrypt_recurring_templates
```

```sql
-- ==================================================
-- Encrypt recurring_transaction_templates (2 encrypted)
-- ==================================================

ALTER TABLE recurring_transaction_templates RENAME TO recurring_transaction_templates_enc;

ALTER TABLE recurring_transaction_templates_enc
  ALTER COLUMN description TYPE BYTEA USING zeta_encrypt_as(description, user_id);
ALTER TABLE recurring_transaction_templates_enc
  ALTER COLUMN merchant_name TYPE BYTEA USING zeta_encrypt_as(merchant_name, user_id);

CREATE VIEW recurring_transaction_templates WITH (security_invoker = true) AS
SELECT
  account_id, amount, category_id, created_at, currency_code,
  day_of_month, day_of_week,
  zeta_decrypt(description) AS description,
  direction, end_date, frequency, id, is_active,
  zeta_decrypt(merchant_name) AS merchant_name,
  start_date, transfer_source_account_id, updated_at, user_id
FROM recurring_transaction_templates_enc;

CREATE OR REPLACE FUNCTION recurring_templates_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO recurring_transaction_templates_enc (
    account_id, amount, category_id, created_at, currency_code,
    day_of_month, day_of_week, description, direction, end_date,
    frequency, id, is_active, merchant_name, start_date,
    transfer_source_account_id, updated_at, user_id
  ) VALUES (
    NEW.account_id, NEW.amount, NEW.category_id, NEW.created_at,
    NEW.currency_code, NEW.day_of_month, NEW.day_of_week,
    zeta_encrypt(NEW.description),
    NEW.direction, NEW.end_date, NEW.frequency, NEW.id, NEW.is_active,
    zeta_encrypt(NEW.merchant_name),
    NEW.start_date, NEW.transfer_source_account_id, NEW.updated_at,
    NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_templates_view_insert_trg
  INSTEAD OF INSERT ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_insert();

CREATE OR REPLACE FUNCTION recurring_templates_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE recurring_transaction_templates_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    category_id = NEW.category_id,
    created_at = NEW.created_at,
    currency_code = NEW.currency_code,
    day_of_month = NEW.day_of_month,
    day_of_week = NEW.day_of_week,
    description = zeta_encrypt(NEW.description),
    direction = NEW.direction,
    end_date = NEW.end_date,
    frequency = NEW.frequency,
    is_active = NEW.is_active,
    merchant_name = zeta_encrypt(NEW.merchant_name),
    start_date = NEW.start_date,
    transfer_source_account_id = NEW.transfer_source_account_id,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_templates_view_update_trg
  INSTEAD OF UPDATE ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_update();

CREATE OR REPLACE FUNCTION recurring_templates_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM recurring_transaction_templates_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_templates_view_delete_trg
  INSTEAD OF DELETE ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_transaction_templates TO authenticated;
GRANT ALL ON recurring_transaction_templates TO postgres, service_role;
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*encrypt_recurring*
git commit -m "feat: encrypt recurring_transaction_templates — description + merchant_name"
```

---

### Task 10: Encrypt wishlist_items table

**Files:**
- Create: `supabase/migrations/<timestamp>_encrypt_wishlist_items.sql`

26 columns. 3 encrypted (name, url, why). No HMAC.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new encrypt_wishlist_items
```

```sql
-- ==================================================
-- Encrypt wishlist_items table (3 encrypted)
-- ==================================================

ALTER TABLE wishlist_items RENAME TO wishlist_items_enc;

ALTER TABLE wishlist_items_enc
  ALTER COLUMN name TYPE BYTEA USING zeta_encrypt_as(name, user_id);
ALTER TABLE wishlist_items_enc
  ALTER COLUMN url TYPE BYTEA USING zeta_encrypt_as(url, user_id);
ALTER TABLE wishlist_items_enc
  ALTER COLUMN why TYPE BYTEA USING zeta_encrypt_as(why, user_id);

CREATE VIEW wishlist_items WITH (security_invoker = true) AS
SELECT
  account_id, amount, bought_at, category_id, created_at, currency_code,
  desire_type, enriched, enriched_at, funding_type, id, image_url,
  installments, last_nudge_dismissed_at, last_score, last_scored_at,
  last_verdict,
  zeta_decrypt(name) AS name,
  ready_at, status, transaction_id, updated_at, urgency,
  zeta_decrypt(url) AS url,
  user_id,
  zeta_decrypt(why) AS why
FROM wishlist_items_enc;

CREATE OR REPLACE FUNCTION wishlist_items_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wishlist_items_enc (
    account_id, amount, bought_at, category_id, created_at, currency_code,
    desire_type, enriched, enriched_at, funding_type, id, image_url,
    installments, last_nudge_dismissed_at, last_score, last_scored_at,
    last_verdict, name, ready_at, status, transaction_id, updated_at,
    urgency, url, user_id, why
  ) VALUES (
    NEW.account_id, NEW.amount, NEW.bought_at, NEW.category_id,
    NEW.created_at, NEW.currency_code, NEW.desire_type, NEW.enriched,
    NEW.enriched_at, NEW.funding_type, NEW.id, NEW.image_url,
    NEW.installments, NEW.last_nudge_dismissed_at, NEW.last_score,
    NEW.last_scored_at, NEW.last_verdict,
    zeta_encrypt(NEW.name),
    NEW.ready_at, NEW.status, NEW.transaction_id, NEW.updated_at,
    NEW.urgency,
    zeta_encrypt(NEW.url),
    NEW.user_id,
    zeta_encrypt(NEW.why)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wishlist_items_view_insert_trg
  INSTEAD OF INSERT ON wishlist_items
  FOR EACH ROW EXECUTE FUNCTION wishlist_items_view_insert();

CREATE OR REPLACE FUNCTION wishlist_items_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE wishlist_items_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    bought_at = NEW.bought_at,
    category_id = NEW.category_id,
    created_at = NEW.created_at,
    currency_code = NEW.currency_code,
    desire_type = NEW.desire_type,
    enriched = NEW.enriched,
    enriched_at = NEW.enriched_at,
    funding_type = NEW.funding_type,
    image_url = NEW.image_url,
    installments = NEW.installments,
    last_nudge_dismissed_at = NEW.last_nudge_dismissed_at,
    last_score = NEW.last_score,
    last_scored_at = NEW.last_scored_at,
    last_verdict = NEW.last_verdict,
    name = zeta_encrypt(NEW.name),
    ready_at = NEW.ready_at,
    status = NEW.status,
    transaction_id = NEW.transaction_id,
    updated_at = NEW.updated_at,
    urgency = NEW.urgency,
    url = zeta_encrypt(NEW.url),
    user_id = NEW.user_id,
    why = zeta_encrypt(NEW.why)
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wishlist_items_view_update_trg
  INSTEAD OF UPDATE ON wishlist_items
  FOR EACH ROW EXECUTE FUNCTION wishlist_items_view_update();

CREATE OR REPLACE FUNCTION wishlist_items_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM wishlist_items_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wishlist_items_view_delete_trg
  INSTEAD OF DELETE ON wishlist_items
  FOR EACH ROW EXECUTE FUNCTION wishlist_items_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON wishlist_items TO authenticated;
GRANT ALL ON wishlist_items TO postgres, service_role;
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*encrypt_wishlist*
git commit -m "feat: encrypt wishlist_items — name + url + why"
```

---

### Task 11: Index cleanup + HMAC indexes

**Files:**
- Create: `supabase/migrations/<timestamp>_encryption_index_cleanup.sql`

Drop indexes that became useless after encryption (searching on BYTEA ciphertext is meaningless). Add indexes on HMAC/hash columns for efficient lookup.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new encryption_index_cleanup
```

```sql
-- ==================================================
-- Drop useless indexes on encrypted columns
-- ==================================================

DROP INDEX IF EXISTS idx_destinatarios_user_name;
DROP INDEX IF EXISTS idx_capture_tokens_token;

-- ==================================================
-- Add indexes on HMAC/hash columns for lookup
-- ==================================================

CREATE INDEX idx_transactions_merchant_hmac
  ON transactions_enc (user_id, merchant_name_hmac);

CREATE INDEX idx_transactions_description_hmac
  ON transactions_enc (user_id, clean_description_hmac);

CREATE INDEX idx_accounts_mask_hmac
  ON accounts_enc (user_id, mask_hmac);

CREATE INDEX idx_destinatarios_name_hmac
  ON destinatarios_enc (user_id, name_hmac);

CREATE UNIQUE INDEX idx_capture_tokens_hash
  ON capture_tokens_enc (token_hash);
```

- [ ] **Step 2: Push and verify**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*encryption_index*
git commit -m "feat: add HMAC/hash indexes, drop obsolete text indexes on encrypted columns"
```

---

### Task 12: App code changes — capture token lookup

**Files:**
- Modify: `webapp/src/app/api/_shared/auth.ts` (capture token lookup)

The transparent view layer handles all other searches (ILIKE on decrypted columns works through views). The **only** app code change needed is the capture token lookup, which runs in an unauthenticated context (Bearer token auth — `auth.uid()` is not set, so the view's `zeta_decrypt` returns NULL).

- [ ] **Step 1: Find the capture token lookup code**

```bash
cd webapp && grep -n "capture_tokens" src/app/api/_shared/auth.ts
```

The current code looks like:
```typescript
const { data } = await adminClient
  .from('capture_tokens')
  .select('*')
  .eq('token', bearerToken)
  .is('revoked_at', null)
  .single();
```

- [ ] **Step 2: Change to use token_hash on the _enc table**

Replace the lookup to query `capture_tokens_enc` directly (bypasses view, no decryption needed) using `token_hash`:

```typescript
import { createHash } from 'crypto';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// In the token lookup:
const { data } = await adminClient
  .from('capture_tokens_enc')
  .select('id, user_id, default_account_id, last_used_at, revoked_at')
  .eq('token_hash', hashToken(bearerToken))
  .is('revoked_at', null)
  .single();
```

Key changes:
- Query `capture_tokens_enc` instead of `capture_tokens`
- Match on `token_hash` instead of `token`
- Only SELECT plaintext columns (no encrypted columns that would need decryption)
- Uses Node.js `crypto.createHash` — no new dependencies

- [ ] **Step 3: Verify the build**

```bash
cd webapp && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/api/_shared/auth.ts
git commit -m "fix: use token_hash for capture token lookup (encrypted column not queryable without auth context)"
```

---

### Task 13: Regenerate types + build verification

**Files:**
- Modify: `webapp/src/types/database.ts`

- [ ] **Step 1: Push all migrations if not already pushed**

Ensure all migrations from Tasks 1-11 have been pushed:
```bash
npx supabase db push
```

- [ ] **Step 2: Regenerate TypeScript types**

```bash
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts
```

Verify the file starts with `export type Json =` (shell compdef warning can corrupt first line).

Expected changes in the types:
- Views appear with the same column types as before (TEXT → still `string` through view)
- New columns: `merchant_name_hmac`, `clean_description_hmac`, `mask_hmac`, `name_hmac`, `token_hash`
- `_enc` tables appear as new entries with BYTEA columns typed as `string`

- [ ] **Step 3: Install dependencies and build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm install && cd webapp && pnpm build
```

Build must pass clean. If type errors occur, they'll be from the new HMAC/hash columns appearing in types — existing code won't reference them so this should pass.

- [ ] **Step 4: End-to-end verification via Supabase SQL Editor**

Run as authenticated user:
```sql
-- Transactions: plaintext through view
SELECT id, merchant_name, raw_description, amount FROM transactions LIMIT 5;

-- Transactions: ciphertext in raw table
SELECT id, merchant_name, raw_description FROM transactions_enc LIMIT 5;

-- Accounts: plaintext through view
SELECT id, name, mask, institution_name FROM accounts LIMIT 5;

-- Profiles: plaintext through view
SELECT id, full_name, email FROM profiles LIMIT 1;

-- Insert test: write through view, verify stored encrypted
INSERT INTO transactions (
  user_id, account_id, amount, transaction_date, direction,
  currency_code, idempotency_key, merchant_name, raw_description
) VALUES (
  (SELECT auth.uid()), '<valid_account_id>', 100, '2026-04-08', 'OUTFLOW',
  'COP', 'test_encryption_' || gen_random_uuid(), 'Test Merchant', 'Test Description'
);

-- Verify the insert stored encrypted data
SELECT merchant_name FROM transactions_enc
WHERE idempotency_key LIKE 'test_encryption_%';
-- Should show BYTEA ciphertext

-- Verify the view returns plaintext
SELECT merchant_name FROM transactions
WHERE idempotency_key LIKE 'test_encryption_%';
-- Should show 'Test Merchant'

-- Clean up test row
DELETE FROM transactions WHERE idempotency_key LIKE 'test_encryption_%';

-- Verify HMAC blind index works
SELECT id FROM transactions
WHERE merchant_name_hmac = zeta_hmac('some known merchant name');
```

- [ ] **Step 5: Final commit**

```bash
git add webapp/src/types/database.ts
git commit -m "chore: regenerate types after envelope encryption migration"
```
