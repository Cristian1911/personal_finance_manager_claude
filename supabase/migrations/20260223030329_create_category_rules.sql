-- ============================================================
-- Create category_rules table for user-learned auto-categorization
-- and add USER_LEARNED to categorization_source enum
-- ============================================================

-- 0. Ensure moddatetime extension is available
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- 1. Add USER_LEARNED to the categorization_source enum
ALTER TYPE categorization_source ADD VALUE IF NOT EXISTS 'USER_LEARNED';

-- 2. Create the category_rules table
CREATE TABLE IF NOT EXISTS category_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  match_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, pattern)
);

-- 3. Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_category_rules_user_id ON category_rules(user_id);

-- 4. Enable RLS
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rules"
  ON category_rules FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own rules"
  ON category_rules FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own rules"
  ON category_rules FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own rules"
  ON category_rules FOR DELETE
  USING ((select auth.uid()) = user_id);

-- 5. Updated_at trigger
DROP TRIGGER IF EXISTS set_category_rules_updated_at ON category_rules;
CREATE TRIGGER set_category_rules_updated_at
  BEFORE UPDATE ON category_rules
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
