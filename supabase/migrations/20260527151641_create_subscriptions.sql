-- ============================================================================
-- Create subscriptions table (Subscriptions feature — Task 1)
--
-- A subscription = one LIVE row per destinatario (Spotify / streaming / SaaS),
-- tracked separately from essential recurring obligations. Recognition reuses
-- the destinatario engine; billing optionally rides the recurring template /
-- occurrence lifecycle via recurring_template_id.
--
-- Design decisions (see docs/superpowers/specs/2026-05-27-subscriptions-design.md):
--   * PLAIN table (no _enc envelope). The most identifying field is
--     destinatario_id, which already points at the encrypted destinatarios_enc
--     table — the merchant identity is protected there. cancel_url adds no
--     incremental sensitivity beyond what the FK already exposes, and keeping
--     this table plain materially simplifies mobile sync (no view / INSTEAD OF
--     triggers / zeta_decrypt_as ceremony). The public name `subscriptions` is
--     the queryable table itself, so mobile reads the view-aligned name as-is.
--   * FKs to encrypted base tables: destinatario_id -> destinatarios_enc(id),
--     recurring_template_id -> recurring_transaction_templates_enc(id), matching
--     the existing recurring -> destinatarios_enc FK in
--     20260417170859_add_destinatario_id_to_recurring_templates.sql.
--   * user_id -> auth.users(id): `profiles` is now an encrypted view (cannot FK
--     to a view); recent tables (transaction_locations_enc, wishlist_items) all
--     reference auth.users(id).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Enum: subscription lifecycle
-- ----------------------------------------------------------------------------
CREATE TYPE subscription_status AS ENUM (
  'suggested',
  'active',
  'trial',
  'marked_for_cancellation',
  'cancelled',
  'dismissed'
);

-- ----------------------------------------------------------------------------
-- Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL
    REFERENCES public.destinatarios_enc(id) ON DELETE CASCADE,
  recurring_template_id uuid
    REFERENCES public.recurring_transaction_templates_enc(id) ON DELETE SET NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  estimated_amount numeric,
  currency_code text NOT NULL DEFAULT 'COP',
  trial_ends_on date,
  cancel_url text,
  detected_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscriptions IS
  'One LIVE subscription per destinatario (cancelled/dismissed kept as history). Plain table — destinatario_id (the identifying field) is protected via the encrypted destinatarios_enc FK. Synced to mobile via this name directly (no _enc/view).';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
-- One LIVE subscription per destinatario; cancelled/dismissed kept as history,
-- so resubscribing after a cancel creates a NEW active row (old row preserved).
CREATE UNIQUE INDEX subscriptions_one_live_per_destinatario
  ON public.subscriptions (user_id, destinatario_id)
  WHERE status NOT IN ('cancelled', 'dismissed');

CREATE INDEX idx_subscriptions_user_id
  ON public.subscriptions (user_id);
CREATE INDEX idx_subscriptions_destinatario_id
  ON public.subscriptions (destinatario_id);
CREATE INDEX idx_subscriptions_recurring_template_id
  ON public.subscriptions (recurring_template_id)
  WHERE recurring_template_id IS NOT NULL;
CREATE INDEX idx_subscriptions_status
  ON public.subscriptions (status);

-- ----------------------------------------------------------------------------
-- updated_at maintenance (moddatetime, matching every other core table)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

DROP TRIGGER IF EXISTS set_updated_at ON public.subscriptions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ----------------------------------------------------------------------------
-- RLS (fast-path auth pattern; defense-in-depth .eq("user_id", ...) in app)
-- ----------------------------------------------------------------------------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select"
  ON public.subscriptions FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "subscriptions_insert"
  ON public.subscriptions FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "subscriptions_update"
  ON public.subscriptions FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "subscriptions_delete"
  ON public.subscriptions FOR DELETE
  USING ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO postgres, service_role;

-- ----------------------------------------------------------------------------
-- Cancel-drift guard
--
-- Keeps subscriptions.status in sync when a linked recurring template is
-- (de)activated through ANY entry point (recurring form, mobile, direct edit).
-- The trigger lives on recurring_transaction_templates_enc (the real base
-- table) as AFTER UPDATE: the view's INSTEAD OF UPDATE trigger writes to _enc,
-- which then fires this AFTER UPDATE row trigger — and direct _enc writes
-- (mobile sync / future cron) are covered too. is_active is a plaintext column
-- on _enc, so no decryption is involved.
--
-- SECURITY DEFINER (running as function owner) intentionally bypasses RLS on
-- subscriptions: the sync must apply regardless of which session triggered the
-- template change.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_subscription_on_template_active_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active = false THEN
      UPDATE public.subscriptions
        SET status = 'cancelled', updated_at = now()
        WHERE recurring_template_id = NEW.id
          AND status NOT IN ('cancelled', 'dismissed');
    ELSE
      UPDATE public.subscriptions
        SET status = 'active', updated_at = now()
        WHERE recurring_template_id = NEW.id
          AND status = 'cancelled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_subscription_on_template_active
  ON public.recurring_transaction_templates_enc;
CREATE TRIGGER trg_sync_subscription_on_template_active
  AFTER UPDATE ON public.recurring_transaction_templates_enc
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_subscription_on_template_active_change();

-- ----------------------------------------------------------------------------
-- Backfill (one-shot)
--
-- Seed status='active' rows for existing recurring templates that are
-- categorized as "Suscripciones" (c0000001-0012-...-000000000004) and already
-- carry a destinatario_id. Read directly from the _enc base table: the
-- migration runs with no JWT, and every column needed is plaintext on _enc
-- (user_id, destinatario_id, id, category_id, is_active, currency_code), so
-- reading the decrypting view is both unnecessary and would risk NULLs. The
-- currency_code enum is cast to text to match the subscriptions.currency_code
-- column type.
--
-- ON CONFLICT targets the partial unique index explicitly so re-running the
-- migration (or overlap with later detection) is a no-op rather than an error.
-- ----------------------------------------------------------------------------
INSERT INTO public.subscriptions (
  user_id, destinatario_id, recurring_template_id, status, currency_code
)
SELECT
  t.user_id,
  t.destinatario_id,
  t.id,
  'active',
  t.currency_code::text
FROM public.recurring_transaction_templates_enc t
WHERE t.category_id = 'c0000001-0012-4000-8000-000000000004'
  AND t.destinatario_id IS NOT NULL
  AND t.is_active = true
ON CONFLICT (user_id, destinatario_id)
  WHERE status NOT IN ('cancelled', 'dismissed')
  DO NOTHING;

COMMIT;
