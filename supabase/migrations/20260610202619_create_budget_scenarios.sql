-- ============================================================================
-- Create budget_scenarios table ("Simular cambio" feature)
--
-- A budget scenario = an editable clone of the user's current budget, saved as
-- a named draft to revisit (e.g. "Mudanza": add Arriendo, raise Mercado, attach
-- one-time startup purchases) and later applied to the real budgets.
--
-- Design decisions:
--   * PLAIN table (no _enc envelope), following the `budgets` table precedent.
--     Scenario names like "Mudanza" are low-sensitivity. The draft JSONB holds
--     category UUIDs + amounts and wishlist_item ids / ad-hoc names — no PII
--     beyond what category/wishlist tables already expose. Keeping this plain
--     materially simplifies mobile sync (no view / INSTEAD OF triggers).
--   * user_id -> auth.users(id): `profiles` is now an encrypted view (cannot FK
--     to a view); recent tables (subscriptions, wishlist_items) all reference
--     auth.users(id). The draft references category/wishlist ids softly inside
--     JSONB (no hard FK), so a deleted category degrades gracefully in-app.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.budget_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.budget_scenarios IS
  'Editable budget-scenario drafts for the "Simular cambio" feature. Plain table — low-sensitivity names; draft JSONB softly references category/wishlist ids + amounts. applied_at marks when a scenario was applied to real budgets.';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
-- List queries are per-user, ordered by updated_at desc.
CREATE INDEX idx_budget_scenarios_user_updated
  ON public.budget_scenarios (user_id, updated_at DESC);

-- ----------------------------------------------------------------------------
-- updated_at maintenance (moddatetime, matching every other core table)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

DROP TRIGGER IF EXISTS set_updated_at ON public.budget_scenarios;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.budget_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ----------------------------------------------------------------------------
-- RLS (fast-path auth pattern; defense-in-depth .eq("user_id", ...) in app)
-- ----------------------------------------------------------------------------
ALTER TABLE public.budget_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_scenarios_select"
  ON public.budget_scenarios FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "budget_scenarios_insert"
  ON public.budget_scenarios FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "budget_scenarios_update"
  ON public.budget_scenarios FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "budget_scenarios_delete"
  ON public.budget_scenarios FOR DELETE
  USING ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_scenarios TO authenticated;
GRANT ALL ON public.budget_scenarios TO postgres, service_role;

COMMIT;
