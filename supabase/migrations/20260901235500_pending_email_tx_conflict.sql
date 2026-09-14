-- Auto import must not decide a possible duplicate on its own (issue #389).
-- When an incoming alert matches an existing transaction, the email is
-- queued with the candidate it collided with so the review surfaces can show
-- "Posible duplicado" and the user resolves it with the full prompt.
alter table pending_email_transactions
  add column if not exists conflict_transaction_id uuid
    references public.transactions_enc(id) on delete set null;
