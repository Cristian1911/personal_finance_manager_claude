-- ==========================================================================
-- Fix INSTEAD OF INSERT trigger on encrypted statement_snapshots view
-- --------------------------------------------------------------------------
-- The previous statement_snapshots_view_insert() (defined in
-- 20260417193237_has_auth_guard_encrypted_triggers.sql) regressed: it inserted
-- into non-existent columns `opening_balance` / `closing_balance` and omitted
-- ~11 real columns. Imports of loan statements failed with:
--   column "opening_balance" of relation "statement_snapshots_enc" does not exist
--
-- This restores the COMPLETE, CORRECT column list (matching the view SELECT in
-- 20260408143005 and the sibling UPDATE trigger), using the real balance
-- columns `previous_balance` / `final_balance`. It preserves the has_auth guard
-- and COALESCE defaults introduced by the has_auth refactor.
--
-- CREATE OR REPLACE only — the existing trigger
-- statement_snapshots_view_insert_trg binds by function name and picks up the
-- new body automatically. No view, trigger, index, type, or RLS changes.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.statement_snapshots_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.transaction_count := COALESCE(NEW.transaction_count, 0);
  NEW.imported_count := COALESCE(NEW.imported_count, 0);
  NEW.skipped_count := COALESCE(NEW.skipped_count, 0);
  NEW.currency_code := COALESCE(NEW.currency_code, 'COP'::text);

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
    CASE WHEN has_auth THEN zeta_encrypt(NEW.loan_number) ELSE zeta_encrypt_as(NEW.loan_number, NEW.user_id) END,
    NEW.minimum_payment, NEW.payment_due_date, NEW.period_from, NEW.period_to,
    NEW.previous_balance, NEW.purchases_and_charges, NEW.remaining_balance,
    NEW.skipped_count,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.source_filename) ELSE zeta_encrypt_as(NEW.source_filename, NEW.user_id) END,
    NEW.total_credits, NEW.total_debits, NEW.total_payment_due,
    NEW.transaction_count, NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$function$;
