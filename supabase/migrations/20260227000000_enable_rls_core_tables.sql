-- Enable RLS on core banking tables that were missing it.
-- Applied directly to the remote project on 2026-02-27; this migration
-- records it in version control so the schema stays reproducible.

-- profiles ─────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile"
  ON profiles FOR ALL
  USING  ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- accounts ─────────────────────────────────────────────────────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own accounts"
  ON accounts FOR ALL
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- transactions ──────────────────────────────────────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own transactions"
  ON transactions FOR ALL
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
