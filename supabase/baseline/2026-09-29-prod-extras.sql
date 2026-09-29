-- Zeta baseline extras (2026-09-29)
-- What a schema-only dump of `public` leaves out, read from production:
-- auth.users triggers, the scheduled job, storage buckets + policies, and the
-- Vault master key. Apply AFTER 2026-09-29-prod-schema.sql on a NEW, empty
-- project. Never run this against production (it already has all of it).
-- The master key is generated fresh per project: dev never shares prod's key.

-- 1. Envelope encryption master key (KEK), new random value for this project.
SELECT vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'zeta_master_key',
  'Master encryption key for Zeta envelope encryption'
);

-- 2. auth.users triggers: profile row + per-user data key on sign-up.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_encryption_key
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_encryption_key();

-- 3. Scheduled job.
SELECT cron.schedule(
  'cleanup-anonymous-demo-users',
  '0 7 * * *',
  $$SELECT public.cleanup_anonymous_demo_users(interval '7 days')$$
);

-- 4. Storage buckets (all private).
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES
  ('unrecognized-statements', 'unrecognized-statements', false, 15728640),
  ('bug-reports',             'bug-reports',             false, NULL),
  ('email-pdfs',              'email-pdfs',              false, 15728640),
  ('design-reviews',          'design-reviews',          false, NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies (copied from production's pg_policies).
CREATE POLICY "Users can access their own email PDFs" ON storage.objects AS PERMISSIVE FOR ALL TO public USING (((bucket_id = 'email-pdfs'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'email-pdfs'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can delete own bug attachments" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'bug-reports'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));
CREATE POLICY "Users can read own bug attachments" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'bug-reports'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));
CREATE POLICY "Users can read own review files" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'design-reviews'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can update own bug attachments" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'bug-reports'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid)))) WITH CHECK (((bucket_id = 'bug-reports'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));
CREATE POLICY "Users can upload own bug attachments" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'bug-reports'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));
CREATE POLICY "Users can upload own review files" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'design-reviews'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])));
