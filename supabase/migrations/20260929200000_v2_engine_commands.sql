-- v2 engine: command log (S1-1, S2-2) and per-field edit versions (S1-2).
-- Additive only. Payloads are encrypted with the user's key (zeta_encrypt);
-- the 90-day payload purge (S2-2) ships in a later migration.
-- user_id leads both primary keys: ids are client-generated, and ON CONFLICT /
-- unique checks see other users' rows despite RLS, so a guessed id must never
-- block or reveal another user's row.

CREATE TABLE public.commands (
  id          uuid NOT NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id   text NOT NULL,
  type        text NOT NULL,
  client_ts   timestamptz NOT NULL,
  payload_enc bytea,
  status      text NOT NULL CHECK (status IN ('applied', 'duplicate', 'superseded', 'rejected')),
  result      jsonb NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX commands_user_applied_idx ON public.commands (user_id, applied_at DESC);
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY commands_select_own ON public.commands
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY commands_insert_own ON public.commands
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
-- Default privileges grant ALL (incl. TRUNCATE, which ignores RLS): reset first.
REVOKE ALL ON public.commands FROM anon, authenticated;
GRANT SELECT, INSERT ON public.commands TO authenticated;

CREATE TABLE public.field_versions (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity     text NOT NULL,
  entity_id  uuid NOT NULL,
  field      text NOT NULL,
  client_ts  timestamptz NOT NULL,
  command_id uuid NOT NULL,
  PRIMARY KEY (user_id, entity, entity_id, field)
);
ALTER TABLE public.field_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY field_versions_select_own ON public.field_versions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY field_versions_insert_own ON public.field_versions
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY field_versions_update_own ON public.field_versions
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE ALL ON public.field_versions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.field_versions TO authenticated;
