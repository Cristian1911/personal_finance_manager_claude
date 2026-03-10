-- ============================================================
-- Create destinatarios + destinatario_rules tables
-- and add destinatario_id FK to transactions
-- ============================================================

-- 0. Ensure moddatetime extension is available
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- ============================================================
-- 1. destinatarios table
-- ============================================================
CREATE TABLE IF NOT EXISTS destinatarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one name per user (case-insensitive)
CREATE UNIQUE INDEX idx_destinatarios_user_name
  ON destinatarios (user_id, lower(name));

-- Fast lookups by user
CREATE INDEX idx_destinatarios_user_id
  ON destinatarios (user_id);

-- RLS
ALTER TABLE destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own destinatarios"
  ON destinatarios FOR ALL
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_destinatarios_updated_at ON destinatarios;
CREATE TRIGGER set_destinatarios_updated_at
  BEFORE UPDATE ON destinatarios
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ============================================================
-- 2. destinatario_rules table
-- ============================================================
CREATE TABLE IF NOT EXISTS destinatario_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  destinatario_id UUID NOT NULL REFERENCES destinatarios(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL DEFAULT 'contains'
    CHECK (match_type IN ('contains', 'exact')),
  pattern TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one pattern per user (case-insensitive)
CREATE UNIQUE INDEX idx_destinatario_rules_user_pattern
  ON destinatario_rules (user_id, lower(pattern));

-- Fast lookups by destinatario
CREATE INDEX idx_destinatario_rules_destinatario
  ON destinatario_rules (destinatario_id);

-- RLS
ALTER TABLE destinatario_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own destinatario_rules"
  ON destinatario_rules FOR ALL
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- 3. Add destinatario_id to transactions
-- ============================================================
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS destinatario_id UUID
  REFERENCES destinatarios(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_destinatario
  ON transactions (destinatario_id)
  WHERE destinatario_id IS NOT NULL;
