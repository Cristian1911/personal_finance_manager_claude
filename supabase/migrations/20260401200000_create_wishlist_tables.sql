-- Wishlist items: persistent purchase desires with scoring
CREATE TABLE wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(15,2) NOT NULL,
  currency_code text NOT NULL DEFAULT 'COP',
  url text,
  image_url text,
  status text NOT NULL DEFAULT 'wishlist'
    CHECK (status IN ('wishlist', 'bought', 'reflected', 'archived')),

  -- Context (enrichment) fields — all nullable for quick capture
  why text,
  urgency text CHECK (urgency IN ('NECESSARY', 'USEFUL', 'IMPULSE')),
  desire_type text CHECK (desire_type IN ('long_held', 'recent', 'spontaneous')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  funding_type text CHECK (funding_type IN ('ONE_TIME', 'INSTALLMENTS')),
  installments integer CHECK (installments IS NULL OR (installments >= 2 AND installments <= 36)),
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,

  -- Tracking
  enriched boolean NOT NULL DEFAULT false,
  enriched_at timestamptz,
  ready_at timestamptz,
  bought_at timestamptz,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  last_scored_at timestamptz,
  last_score integer CHECK (last_score IS NULL OR (last_score >= 0 AND last_score <= 100)),
  last_verdict text CHECK (last_verdict IN ('BUY', 'BUY_WITH_CAUTION', 'WAIT', 'NOT_RECOMMENDED')),
  last_nudge_dismissed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wishlist items"
  ON wishlist_items FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX idx_wishlist_items_user_status
  ON wishlist_items (user_id, status, last_score DESC NULLS LAST);

CREATE INDEX idx_wishlist_items_user_active
  ON wishlist_items (user_id, created_at DESC)
  WHERE status = 'wishlist';

-- No moddatetime trigger — updated_at is set explicitly in server actions
-- (consistent with financial_reminders pattern, avoids extension schema issues)

-- Wishlist reflections: post-purchase feedback
CREATE TABLE wishlist_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_item_id uuid NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worth_it boolean NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  note text,
  reflection_stage text NOT NULL CHECK (reflection_stage IN ('14_day', '60_day')),
  days_since_purchase integer NOT NULL,
  reflected_at timestamptz NOT NULL DEFAULT now(),

  -- Idempotency: one reflection per stage per item
  UNIQUE (wishlist_item_id, reflection_stage)
);

ALTER TABLE wishlist_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reflections"
  ON wishlist_reflections FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX idx_wishlist_reflections_item
  ON wishlist_reflections (wishlist_item_id);
