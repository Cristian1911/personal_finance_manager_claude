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
