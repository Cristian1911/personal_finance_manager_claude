-- ===========================================================================
-- Add sub_payments JSONB to recurring_transaction_templates
--
-- Stores per-currency breakdown for multi-currency debt accounts:
--   [{currency_code: "COP", amount: 50000}, {currency_code: "USD", amount: 25}]
--
-- The template's `amount` is the total in the account's primary currency.
-- sub_payments is informational — not PII, so stored as plain JSONB (no encryption).
-- ===========================================================================

-- Step 1: Add column to the _enc table (real table)
ALTER TABLE recurring_transaction_templates_enc
  ADD COLUMN sub_payments JSONB DEFAULT NULL;

-- Step 2: Recreate the decrypting view to include the new column
CREATE OR REPLACE VIEW recurring_transaction_templates WITH (security_invoker = true) AS
SELECT
  account_id, amount, category_id, created_at, currency_code,
  day_of_month, day_of_week,
  zeta_decrypt(description) AS description,
  direction, end_date, frequency, id, is_active,
  zeta_decrypt(merchant_name) AS merchant_name,
  start_date, sub_payments, transfer_source_account_id, updated_at, user_id
FROM recurring_transaction_templates_enc;

-- Step 3: Update INSERT trigger to include sub_payments
CREATE OR REPLACE FUNCTION recurring_templates_view_insert() RETURNS TRIGGER AS $$
BEGIN
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.currency_code := COALESCE(NEW.currency_code, 'COP'::currency_code);
  NEW.is_active := COALESCE(NEW.is_active, true);

  INSERT INTO recurring_transaction_templates_enc (
    id, user_id, account_id, amount, currency_code, direction,
    frequency, day_of_month, day_of_week, merchant_name, description,
    category_id, is_active, start_date, end_date,
    created_at, updated_at, transfer_source_account_id, sub_payments
  ) VALUES (
    NEW.id, NEW.user_id, NEW.account_id, NEW.amount, NEW.currency_code,
    NEW.direction, NEW.frequency, NEW.day_of_month, NEW.day_of_week,
    zeta_encrypt(NEW.merchant_name), zeta_encrypt(NEW.description),
    NEW.category_id, NEW.is_active, NEW.start_date, NEW.end_date,
    NEW.created_at, NEW.updated_at, NEW.transfer_source_account_id,
    NEW.sub_payments
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Update UPDATE trigger to include sub_payments
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
    user_id = NEW.user_id,
    sub_payments = NEW.sub_payments
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Merge existing duplicate templates (same account, INFLOW, MONTHLY, no category)
-- For each account with multiple currency templates, keep the primary currency one
-- and merge the secondary into it as sub_payments.
WITH duplicates AS (
  SELECT
    t.account_id,
    t.user_id,
    a.currency_code AS primary_currency,
    jsonb_agg(
      jsonb_build_object(
        'currency_code', t.currency_code::text,
        'amount', t.amount
      )
      ORDER BY CASE WHEN t.currency_code = a.currency_code THEN 0 ELSE 1 END
    ) AS sub_payments_json,
    -- Keep the template matching the primary currency (or the first active one)
    (array_agg(t.id ORDER BY CASE WHEN t.currency_code = a.currency_code THEN 0 ELSE 1 END, t.is_active DESC, t.updated_at DESC))[1] AS keep_id,
    array_agg(t.id ORDER BY CASE WHEN t.currency_code = a.currency_code THEN 0 ELSE 1 END, t.is_active DESC, t.updated_at DESC) AS all_ids,
    sum(t.amount) AS total_amount
  FROM recurring_transaction_templates_enc t
  JOIN accounts ON accounts.id = t.account_id
  -- Unencrypted join: accounts is not encrypted, and we filter on non-encrypted columns
  CROSS JOIN LATERAL (
    SELECT accounts.currency_code
  ) a(currency_code)
  WHERE t.direction = 'INFLOW'
    AND t.frequency = 'MONTHLY'
    AND t.category_id IS NULL
  GROUP BY t.account_id, t.user_id, a.currency_code
  HAVING count(*) > 1
)
-- Update the kept template with sub_payments and summed amount
UPDATE recurring_transaction_templates_enc enc
SET
  sub_payments = d.sub_payments_json,
  amount = d.total_amount,
  currency_code = d.primary_currency
FROM duplicates d
WHERE enc.id = d.keep_id;

-- Delete the secondary templates (the ones NOT kept)
WITH duplicates AS (
  SELECT
    t.account_id,
    a.currency_code AS primary_currency,
    (array_agg(t.id ORDER BY CASE WHEN t.currency_code = a.currency_code THEN 0 ELSE 1 END, t.is_active DESC, t.updated_at DESC))[1] AS keep_id,
    array_agg(t.id) AS all_ids
  FROM recurring_transaction_templates_enc t
  JOIN accounts ON accounts.id = t.account_id
  CROSS JOIN LATERAL (
    SELECT accounts.currency_code
  ) a(currency_code)
  WHERE t.direction = 'INFLOW'
    AND t.frequency = 'MONTHLY'
    AND t.category_id IS NULL
    AND t.sub_payments IS NULL  -- Only not-yet-merged ones (skip if already processed above)
  GROUP BY t.account_id, a.currency_code
  HAVING count(*) > 1
),
to_delete AS (
  SELECT unnest(all_ids) AS id, keep_id FROM duplicates
)
-- Reassign occurrences from deleted templates to the kept one
UPDATE recurring_occurrences occ
SET template_id = td.keep_id
FROM to_delete td
WHERE occ.template_id = td.id AND td.id != td.keep_id;

-- Now delete the secondary templates
WITH duplicates AS (
  SELECT
    t.account_id,
    a.currency_code AS primary_currency,
    (array_agg(t.id ORDER BY CASE WHEN t.currency_code = a.currency_code THEN 0 ELSE 1 END, t.is_active DESC, t.updated_at DESC))[1] AS keep_id,
    array_agg(t.id) AS all_ids
  FROM recurring_transaction_templates_enc t
  JOIN accounts ON accounts.id = t.account_id
  CROSS JOIN LATERAL (
    SELECT accounts.currency_code
  ) a(currency_code)
  WHERE t.direction = 'INFLOW'
    AND t.frequency = 'MONTHLY'
    AND t.category_id IS NULL
    -- sub_payments IS NOT NULL means it was the winner from the UPDATE above
    -- We want to delete the ones that were NOT updated (losers)
  GROUP BY t.account_id, a.currency_code
  HAVING count(*) > 1
),
to_delete AS (
  SELECT unnest(all_ids) AS id, keep_id FROM duplicates
)
DELETE FROM recurring_transaction_templates_enc
WHERE id IN (SELECT id FROM to_delete WHERE id != keep_id);
