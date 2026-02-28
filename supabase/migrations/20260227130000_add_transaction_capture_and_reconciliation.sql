DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'transaction_capture_method'
  ) THEN
    CREATE TYPE transaction_capture_method AS ENUM (
      'MANUAL_FORM',
      'TEXT_QUICK_CAPTURE',
      'PDF_IMPORT',
      'OCR_BATCH',
      'OCR_SINGLE'
    );
  END IF;
END $$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS capture_method transaction_capture_method NOT NULL DEFAULT 'MANUAL_FORM',
  ADD COLUMN IF NOT EXISTS capture_input_text text,
  ADD COLUMN IF NOT EXISTS reconciled_into_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_score numeric;

CREATE INDEX IF NOT EXISTS idx_transactions_reconciled_into
  ON public.transactions (user_id, reconciled_into_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_capture_method
  ON public.transactions (user_id, capture_method, transaction_date);
