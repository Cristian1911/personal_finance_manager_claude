-- v2 M1 settings (build plan §4, §6; decisions S3-0, S3-7): when the user is
-- paid and what counts for Disponible. Additive only: new side tables, no
-- column on any _enc table. Amounts are plain like the rest of the schema
-- (identifiers are what gets encrypted).
-- Writes come from engine commands (/api/v2/commands and the phone), always
-- as the signed-in user, so RLS + user_id on every key as in the commands table.

-- ── When I get paid (A2, A3, A4, I1) ─────────────────────────────────────
-- One row per user. Columns are NULL until the user answers that question.
CREATE TABLE public.user_cycle_settings (
  user_id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_kind          text CHECK (schedule_kind IN ('semimonthly', 'monthly', 'biweekly', 'irregular')),
  payday_1               smallint CHECK (payday_1 BETWEEN 1 AND 31),
  payday_2               smallint CHECK (payday_2 BETWEEN 1 AND 31),
  biweekly_anchor        date,
  income_per_cycle       numeric(15,2) CHECK (income_per_cycle >= 0),
  savings_per_cycle      numeric(15,2) NOT NULL DEFAULT 0 CHECK (savings_per_cycle >= 0),
  -- First cycle (A4): "¿Cuánto tienes hoy?" and when it was said.
  balance_anchor         numeric(15,2),
  balance_anchor_at      timestamptz,
  -- S3-2: card purchases at or above this enter the bill in full until cuotas are known.
  big_purchase_threshold numeric(15,2) NOT NULL DEFAULT 300000 CHECK (big_purchase_threshold > 0),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_cycle_settings_schedule_shape CHECK (
    schedule_kind IS NULL
    OR (schedule_kind = 'semimonthly' AND payday_1 IS NOT NULL AND payday_2 IS NOT NULL AND payday_1 < payday_2 AND biweekly_anchor IS NULL)
    OR (schedule_kind = 'monthly' AND payday_1 IS NOT NULL AND payday_2 IS NULL AND biweekly_anchor IS NULL)
    OR (schedule_kind = 'biweekly' AND payday_1 IS NULL AND payday_2 IS NULL AND biweekly_anchor IS NOT NULL)
    OR (schedule_kind = 'irregular' AND payday_1 IS NULL AND payday_2 IS NULL AND biweekly_anchor IS NULL)
  ),
  CONSTRAINT user_cycle_settings_anchor_pair CHECK ((balance_anchor IS NULL) = (balance_anchor_at IS NULL))
);
ALTER TABLE public.user_cycle_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_cycle_settings_select_own ON public.user_cycle_settings
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_cycle_settings_insert_own ON public.user_cycle_settings
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY user_cycle_settings_update_own ON public.user_cycle_settings
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
-- Default privileges grant ALL (incl. TRUNCATE, which ignores RLS): reset first.
REVOKE ALL ON public.user_cycle_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_cycle_settings TO authenticated;

-- ── Which accounts count for Disponible (A13, S3-0) ──────────────────────
-- No row = the default for the account type (checking, savings, cash count;
-- investments and others don't). Cards and loans never count.
CREATE TABLE public.account_settings (
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id           uuid NOT NULL REFERENCES public.accounts_enc(id) ON DELETE CASCADE,
  counts_in_disponible boolean NOT NULL,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);
CREATE INDEX account_settings_account_idx ON public.account_settings (account_id);
ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_settings_select_own ON public.account_settings
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
-- The account must be the user's own too (a settings row can't point at someone else's account).
CREATE POLICY account_settings_insert_own ON public.account_settings
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.accounts_enc a WHERE a.id = account_id AND a.user_id = (SELECT auth.uid()))
  );
CREATE POLICY account_settings_update_own ON public.account_settings
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.accounts_enc a WHERE a.id = account_id AND a.user_id = (SELECT auth.uid()))
  );
REVOKE ALL ON public.account_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.account_settings TO authenticated;

-- ── Apartar for a big bill ahead (S3-7) ──────────────────────────────────
-- Subtracted each cycle like Ahorro from starts_on until released_at (set
-- when the bill is paid). Ids are client-generated (engine commands), so
-- user_id leads the key like commands.
CREATE TABLE public.bill_reservations (
  id                    uuid NOT NULL,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_template_id uuid REFERENCES public.recurring_transaction_templates_enc(id) ON DELETE CASCADE,
  occurrence_id         uuid REFERENCES public.recurring_occurrences(id) ON DELETE CASCADE,
  amount_per_cycle      numeric(15,2) NOT NULL CHECK (amount_per_cycle > 0),
  starts_on             date NOT NULL,
  released_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  CONSTRAINT bill_reservations_target CHECK (recurring_template_id IS NOT NULL OR occurrence_id IS NOT NULL)
);
CREATE INDEX bill_reservations_active_idx ON public.bill_reservations (user_id) WHERE released_at IS NULL;
CREATE INDEX bill_reservations_template_idx ON public.bill_reservations (recurring_template_id);
CREATE INDEX bill_reservations_occurrence_idx ON public.bill_reservations (occurrence_id);
ALTER TABLE public.bill_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY bill_reservations_select_own ON public.bill_reservations
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
-- The bill must be the user's own (a reservation can't point at someone else's template or occurrence).
CREATE POLICY bill_reservations_insert_own ON public.bill_reservations
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (recurring_template_id IS NULL OR EXISTS (
      SELECT 1 FROM public.recurring_transaction_templates_enc t
      WHERE t.id = recurring_template_id AND t.user_id = (SELECT auth.uid())))
    AND (occurrence_id IS NULL OR EXISTS (
      SELECT 1 FROM public.recurring_occurrences o
      WHERE o.id = occurrence_id AND o.user_id = (SELECT auth.uid())))
  );
CREATE POLICY bill_reservations_update_own ON public.bill_reservations
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (recurring_template_id IS NULL OR EXISTS (
      SELECT 1 FROM public.recurring_transaction_templates_enc t
      WHERE t.id = recurring_template_id AND t.user_id = (SELECT auth.uid())))
    AND (occurrence_id IS NULL OR EXISTS (
      SELECT 1 FROM public.recurring_occurrences o
      WHERE o.id = occurrence_id AND o.user_id = (SELECT auth.uid())))
  );
REVOKE ALL ON public.bill_reservations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bill_reservations TO authenticated;
