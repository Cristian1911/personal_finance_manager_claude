-- ============================================================
-- Junction table: recurring_template_tags
--
-- Lets users tag recurring templates ("Hipoteca" → "fijos",
-- "bono anual" → "no-mensuales", etc.). Tags flow from template
-- to the transactions created when an occurrence is marked paid
-- (see recordRecurringOccurrencePayment in recurring-templates.ts).
--
-- NOT encrypted — no PII. Follows the same shape as
-- category_tags / destinatario_tags / transaction_tags, but with
-- a denormalized user_id for direct RLS (no EXISTS subquery).
-- The FK points to recurring_transaction_templates_enc (the real
-- table) because recurring_transaction_templates is a view.
-- ============================================================

BEGIN;

CREATE TABLE public.recurring_template_tags (
  recurring_template_id UUID        NOT NULL REFERENCES public.recurring_transaction_templates_enc(id) ON DELETE CASCADE,
  tag_id                UUID        NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (recurring_template_id, tag_id)
);

ALTER TABLE public.recurring_template_tags ENABLE ROW LEVEL SECURITY;

-- Fast-path RLS: direct user_id comparison, no EXISTS subquery.
-- Defense-in-depth still required at the application layer.
CREATE POLICY "Users can view own recurring template tags"
  ON public.recurring_template_tags FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own recurring template tags"
  ON public.recurring_template_tags FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own recurring template tags"
  ON public.recurring_template_tags FOR DELETE
  USING (user_id = (SELECT auth.uid()));

CREATE INDEX idx_recurring_template_tags_tag_id
  ON public.recurring_template_tags(tag_id);

CREATE INDEX idx_recurring_template_tags_user_id
  ON public.recurring_template_tags(user_id);

COMMIT;
