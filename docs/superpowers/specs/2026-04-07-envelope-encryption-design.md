# Envelope Encryption for Zeta

**Date:** 2026-04-07 (updated 2026-04-08)  
**Status:** Approved  

## Context

Zeta stores sensitive personal finance data (transaction descriptions, merchant names, account numbers, PDF passwords, user names) as plaintext in Supabase PostgreSQL. While RLS (53 policies) isolates users from each other, the data is fully readable to anyone with database access — including the developer. Users of a personal finance app need confidence that their financial identity data is cryptographically protected, and that even the app administrator cannot casually browse it.

## Goal

Encrypt all identity/PII fields at rest using per-user encryption keys, while keeping operational fields (amounts, dates, categories) readable for server-side features (budgets, charts, dashboards, auto-categorization). The encryption must be transparent to the application — zero app code changes via PostgreSQL views and triggers.

## Threat Model

| Threat | Protection |
|--------|-----------|
| Database dump/breach | All identity fields are ciphertext — useless without keys |
| Developer browsing data | Raw tables show ciphertext; decryption requires authenticated session |
| Compromising one user's key | Only that user's data exposed — per-user key isolation |
| SQL injection reading data | Reads hit encrypted columns; decryption requires valid auth context |
| Password reset | DEKs are independent of auth password — no data loss |

**Not in scope:** Full zero-knowledge (client-side encryption). The server holds the key hierarchy and could theoretically decrypt via service_role. Mitigation: restrict service_role usage to migrations only, audit access.

## Architecture

### Key Hierarchy (Envelope Encryption)

```
Supabase Vault (service_role only, not in public schema)
  └── zeta_master_key (KEK — Key Encryption Key)
        │
        ├── encrypts DEK_user_abc
        ├── encrypts DEK_user_xyz
        └── ...

user_encryption_keys table (RLS: auth.uid() = user_id)
  └── user_id UUID PK
  └── encrypted_dek BYTEA  ← DEK encrypted by KEK via pgp_sym_encrypt
  └── created_at TIMESTAMPTZ
```

- **KEK (Key Encryption Key):** Single master key stored in Supabase Vault. Never leaves Vault. Used only to encrypt/decrypt per-user DEKs.
- **DEK (Data Encryption Key):** One per user. Generated on signup via trigger. Stored encrypted by KEK in `user_encryption_keys`. Used to encrypt/decrypt that user's identity fields.

### Encryption Functions

Five `SECURITY DEFINER` functions (run as the function owner, not the caller — needed to access Vault):

```sql
-- Encrypts plaintext using the calling user's DEK (for normal app operations)
zeta_encrypt(plaintext TEXT) → BYTEA

-- Decrypts ciphertext using the calling user's DEK (for normal app operations)
zeta_decrypt(ciphertext BYTEA) → TEXT

-- Encrypts using a specific user's DEK (for backfill migration only, postgres role only)
zeta_encrypt_as(plaintext TEXT, target_user_id UUID) → BYTEA

-- Computes HMAC blind index using the calling user's DEK
zeta_hmac(plaintext TEXT) → TEXT
-- Returns hex-encoded HMAC-SHA256: encode(hmac(lower(plaintext), dek, 'sha256'), 'hex')

-- Computes HMAC using a specific user's DEK (for backfill migration only, postgres role only)
zeta_hmac_as(plaintext TEXT, target_user_id UUID) → TEXT
```

All functions return NULL when given NULL input (NULL-safe).

Internal flow:
1. Get master key from `vault.decrypted_secrets` (only accessible to function owner)
2. Get caller's encrypted DEK from `user_encryption_keys` WHERE `user_id = auth.uid()`
3. Decrypt DEK using master key: `pgp_sym_decrypt(encrypted_dek, master_key)`
4. Encrypt/decrypt the data using DEK: `pgp_sym_encrypt(plaintext, dek)` / `pgp_sym_decrypt(ciphertext, dek)`

### Transparent View Layer

For each table with encrypted columns:

1. **Rename** table → `<table>_enc` (e.g., `transactions` → `transactions_enc`)
2. **Create view** with original name (`transactions`) using `security_invoker = true`
   - View SELECTs all columns, calling `zeta_decrypt()` on encrypted columns
   - `security_invoker = true` ensures RLS on underlying `_enc` table is checked against the calling user
3. **Create INSTEAD OF triggers** on the view for INSERT, UPDATE, DELETE
   - INSERT/UPDATE triggers call `zeta_encrypt()` on identity columns before writing to `_enc` table
   - DELETE trigger proxies to `_enc` table directly

**Result:** Existing Supabase client queries hit the view and get plaintext — zero app code changes. The real table stores only ciphertext.

## Fields to Encrypt

### Encrypted (identity/PII) — 26 columns across 9 tables

**transactions** (5 columns):
- `raw_description` — original bank description
- `clean_description` — cleaned/normalized description
- `merchant_name` — who was paid
- `notes` — user's personal notes
- `capture_input_text` — raw capture input

**accounts** (6 columns):
- `name` — user's account nickname
- `institution_name` — bank name
- `mask` — last 4 digits of account
- `debit_card_mask` — last 4 digits of debit card
- `pdf_password` — PDF statement password
- `provider_account_id` — external account identifier

**profiles** (2 columns):
- `full_name` — user's name
- `email` — user's email address

**destinatarios** (2 columns):
- `name` — payee/merchant name
- `notes` — notes about payee

**statement_snapshots** (2 columns):
- `loan_number` — loan identifier
- `source_filename` — original PDF filename (contains bank/account info)

**capture_tokens** (2 columns):
- `token` — API bearer token
- `label` — user-given label for the token

**email_ingest_addresses** (2 columns):
- `allowed_sender` — email sender filter
- `gmail_verification_url` — OAuth verification URL
- ~~`address_key`~~ — stays **plaintext** (system-generated random string needed for unauthenticated email routing lookup)

**recurring_transaction_templates** (2 columns):
- `description` — recurring transaction description
- `merchant_name` — recurring payee name

**wishlist_items** (3 columns):
- `name` — wishlist item name
- `url` — product URL (reveals purchase intent)
- `why` — user's personal reasoning for wanting the item

### Plaintext (operational) — kept readable for server-side features

All numeric amounts, dates, category IDs, account types, directions, tags, balances, frequencies, priorities. These power budgets, charts, dashboards, and aggregations.

## Search on Encrypted Fields

Encrypted text columns cannot be searched with `ILIKE` or `%pattern%`. Two mitigation strategies:

### Blind Indexes (exact match)

For fields that need exact-match lookup (merchant matching, destinatario lookup, account mask matching):

- Add `<column>_hmac TEXT` column alongside the encrypted column
- On write, compute `hmac(lower(plaintext), user_dek, 'sha256')` and store the hex digest
- On search, compute the same HMAC for the search term and compare
- HMAC is one-way — cannot reverse to get plaintext

**Tables needing blind indexes:**
- `transactions.merchant_name_hmac` — for destinatario auto-matching
- `transactions.clean_description_hmac` — for dedup/idempotency checks
- `accounts.mask_hmac` — for statement-to-account matching during import
- `destinatarios.name_hmac` — for destinatario lookup

### Unaffected Search Paths

Most existing search/filter flows use operational (plaintext) fields:
- Transaction list: filter by date, amount, category, direction, account — all plaintext
- Budget tracking: aggregates by category + amount — all plaintext
- Dashboard: sums, averages, counts on amounts/dates — all plaintext
- Auto-categorization: runs during import wizard (client-side, pre-encryption)

## Migration Strategy

### Phase 1: Infrastructure

```sql
-- 1. Create master key in Vault
SELECT vault.create_secret(
  encode(gen_random_bytes(32), 'hex'),
  'zeta_master_key',
  'Master encryption key for Zeta envelope encryption'
);

-- 2. Create per-user key table
CREATE TABLE user_encryption_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_dek BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_key" ON user_encryption_keys
  FOR ALL USING ((SELECT auth.uid()) = user_id);

-- 3. Create encrypt/decrypt functions
-- (SECURITY DEFINER, owned by postgres, callable by authenticated)

-- 4. Create trigger on auth.users for new signups
-- → generates random DEK, encrypts with KEK, inserts into user_encryption_keys
```

### Phase 2: Generate DEKs for Existing Users

```sql
-- For each existing user, generate a random DEK and store encrypted
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

### Phase 3: Per-Table Migration (repeat for each of 9 tables)

Using `transactions` as example:

```sql
-- 1. Rename table
ALTER TABLE transactions RENAME TO transactions_enc;

-- 2. Add blind index columns (before encrypting, while data is still plaintext)
ALTER TABLE transactions_enc ADD COLUMN merchant_name_hmac TEXT;
ALTER TABLE transactions_enc ADD COLUMN clean_description_hmac TEXT;
-- Backfill HMACs while plaintext is still accessible:
UPDATE transactions_enc SET
  merchant_name_hmac = zeta_hmac_as(merchant_name, user_id),
  clean_description_hmac = zeta_hmac_as(clean_description, user_id)
WHERE merchant_name IS NOT NULL OR clean_description IS NOT NULL;

-- 3. Convert columns: change type TEXT → BYTEA and encrypt in one atomic pass
--    ALTER ... TYPE BYTEA USING zeta_encrypt_as(column, user_id)
--    This takes an ACCESS EXCLUSIVE lock per ALTER, but with ~10k rows
--    each completes in seconds. Acceptable for a single-user app.
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
-- Note: zeta_encrypt_as(plaintext, user_id) is a SECURITY DEFINER variant
--       that encrypts using a specific user's DEK (not auth.uid()).
--       Needed for backfill since the migration runs as postgres, not as each user.
--       Only callable by postgres role — not exposed to authenticated users.

-- 4. Create decrypted view
CREATE VIEW transactions WITH (security_invoker = true) AS
SELECT
  id, user_id, account_id, amount, date, direction, category_id,
  -- Decrypt identity columns
  zeta_decrypt(raw_description) AS raw_description,
  zeta_decrypt(clean_description) AS clean_description,
  zeta_decrypt(merchant_name) AS merchant_name,
  zeta_decrypt(notes) AS notes,
  zeta_decrypt(capture_input_text) AS capture_input_text,
  -- Pass through blind indexes
  merchant_name_hmac,
  clean_description_hmac,
  -- All other columns passed through as-is
  ...
FROM transactions_enc;

-- 5. Create INSTEAD OF triggers for INSERT/UPDATE/DELETE
CREATE FUNCTION transactions_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO transactions_enc VALUES (
    NEW.id, NEW.user_id, NEW.account_id, NEW.amount, NEW.date, NEW.direction,
    zeta_encrypt(NEW.raw_description),
    zeta_encrypt(NEW.clean_description),
    zeta_encrypt(NEW.merchant_name),
    zeta_encrypt(NEW.notes),
    zeta_encrypt(NEW.capture_input_text),
    zeta_hmac(NEW.merchant_name),
    zeta_hmac(NEW.clean_description),
    ...
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER transactions_view_insert_trigger
  INSTEAD OF INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_view_insert();
-- (similar for UPDATE, DELETE)
```

### Phase 4: Verification

```sql
-- Verify encrypted data is not plaintext
SELECT raw_description FROM transactions_enc LIMIT 5;
-- Should show bytea gibberish

-- Verify view decrypts correctly (as authenticated user)
SELECT raw_description FROM transactions LIMIT 5;
-- Should show readable text

-- Verify row counts match
SELECT count(*) FROM transactions_enc;
SELECT count(*) FROM transactions;
-- Must be equal

-- Verify blind indexes work
SELECT * FROM transactions 
WHERE merchant_name_hmac = zeta_hmac('some merchant');
```

## App Code Impact

### Zero changes needed for:
- All `SELECT` queries (read from views transparently)
- All `INSERT`/`UPDATE` queries (INSTEAD OF triggers handle encryption)
- Dashboard, budgets, charts (use plaintext operational fields)
- Authentication flow (unchanged)
- PDF import flow (unchanged — data flows through views)

### Minor changes needed for:
- **Destinatario matching** — search queries that use `merchant_name ILIKE '%...'` must switch to blind index exact match or match on plaintext category/amount fields
- **Account matching during import** — `mask` lookups need to use `mask_hmac` for exact match
- **Idempotency key computation** — currently uses raw description; needs to use the plaintext value (which it already has during import, before it hits the DB)

### No changes needed for:
- Auto-categorization (runs client-side during import wizard, before data is written)
- Budget calculations (use amounts + categories, both plaintext)
- Chart aggregations (use amounts + dates, both plaintext)

## Performance

- **pgcrypto AES encryption**: ~0.1-1ms per field per row
- **View overhead**: One decrypt call per encrypted column per row returned
- **Typical query** (50 transactions): ~5-25ms additional overhead (negligible vs network latency)
- **Backfill migration** (10k transactions, 5 columns): ~30-60 seconds one-time
- **Blind index lookup**: O(1) hash comparison — same as regular index

## Key Lifecycle

| Event | Action |
|-------|--------|
| User signs up | Trigger generates random DEK → encrypts with KEK → stores in `user_encryption_keys` |
| User logs in | No key action — DEK retrieved on-demand by decrypt functions |
| Password reset | No key action — DEK is independent of auth password |
| Key rotation (admin) | Generate new DEK → re-encrypt all user data → replace old DEK |
| User deletion | CASCADE deletes DEK → all encrypted data becomes permanently unreadable |
| Master key rotation | Re-encrypt all DEKs with new KEK (data stays encrypted with same DEKs) |

## Security Boundaries

| Actor | Can see |
|-------|---------|
| Authenticated user (via app) | Their own decrypted data (via views + RLS) |
| Other authenticated user | Nothing — RLS blocks access to other users' rows |
| Developer (Supabase dashboard) | Ciphertext in raw tables. Cannot decrypt without explicitly invoking service_role + vault |
| Database backup/dump | Ciphertext only — keys are in Vault, not in tables |
| Service role (migrations) | Could theoretically decrypt — mitigate by restricting usage to schema-only operations |

## Dependencies

- `pgcrypto` extension — already installed (v1.3)
- `supabase_vault` extension — already installed (v0.3.1)
- PostgreSQL 17 `security_invoker` — available on Supabase

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Master key loss | Vault is managed by Supabase infrastructure with backups |
| Performance regression on large datasets | Blind indexes avoid full-table decryption for lookups; views only decrypt returned rows |
| Migration failure mid-way | Run per-table in transactions; verify before dropping plaintext |
| Fuzzy search no longer works on encrypted fields | Users search by date, amount, category (all plaintext); merchant name search uses blind index exact match |
| INSTEAD OF trigger complexity | Thorough testing of INSERT/UPDATE/DELETE through views before cutover |

## Maintenance Rules

### Column Addition Convention

**When adding a column to any `_enc` table, you MUST also update the corresponding INSTEAD OF INSERT and UPDATE trigger functions on the view.** Otherwise the new column is silently dropped on writes through the view.

Checklist for adding a column to an encrypted table:
1. `ALTER TABLE <table>_enc ADD COLUMN ...` — add to the real table
2. If the column is PII: update the view SELECT to include `zeta_decrypt(new_col) AS new_col`
3. If the column is operational: update the view SELECT to pass through `new_col`
4. Update the INSTEAD OF INSERT trigger to include `NEW.new_col` (encrypted or plain)
5. Update the INSTEAD OF UPDATE trigger to include `NEW.new_col` (encrypted or plain)
6. If PII and needs search: add a `new_col_hmac TEXT` column + update triggers to compute HMAC

## Out of Scope

- Client-side (zero-knowledge) encryption — decided against due to impact on server-side features
- Encrypting operational fields (amounts, dates, categories) — needed for budgets/charts/aggregations
- Audit logging for data access — separate concern, can be added later
- Field-level access control (some users see some fields) — single-user app currently
