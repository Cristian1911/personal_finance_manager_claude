BEGIN;

-- ============================================================
-- Add a non-PII `kind` discriminator (merchant|person) to destinatarios.
-- 6-step _enc rebuild. `kind` is a PLAIN passthrough column (no encryption).
--
-- IMPORTANT: the trigger bodies below are based on the CURRENT has_auth-
-- guarded versions — insert fn from 20260417193237, update fn from
-- 20260417203708 — NOT the original 20260408143004 minimal bodies.
-- Copying the originals would regress the has_auth guard that protects
-- encrypted columns when there is no JWT (anon/admin context).
-- ============================================================

-- Step 0: enum
CREATE TYPE destinatario_kind AS ENUM ('merchant', 'person');

-- Step 1: add column to the _enc base table (plain, non-PII)
ALTER TABLE destinatarios_enc
  ADD COLUMN IF NOT EXISTS kind destinatario_kind NOT NULL DEFAULT 'merchant';

-- Step 2: drop the view + its INSTEAD OF triggers (CASCADE)
DROP VIEW IF EXISTS destinatarios CASCADE;

-- Step 3: recreate the decrypting view WITH kind as a PLAIN passthrough
CREATE VIEW destinatarios WITH (security_invoker = true) AS
SELECT
  created_at, default_category_id, id, is_active, kind,
  zeta_decrypt(name) AS name,
  name_hmac,
  zeta_decrypt(notes) AS notes,
  updated_at, user_id
FROM destinatarios_enc;

-- Step 4a: INSERT trigger fn (current has_auth-guarded body + kind passthrough)
CREATE OR REPLACE FUNCTION public.destinatarios_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.is_active := COALESCE(NEW.is_active, true);
  NEW.kind := COALESCE(NEW.kind, 'merchant');

  INSERT INTO destinatarios_enc (
    id, user_id, name, name_hmac, notes, default_category_id,
    is_active, kind, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.user_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE zeta_encrypt_as(NEW.name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_hmac(NEW.name) ELSE zeta_hmac_as(NEW.name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE zeta_encrypt_as(NEW.notes, NEW.user_id) END,
    NEW.default_category_id, NEW.is_active, NEW.kind,
    NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$function$;

-- Step 4b: UPDATE trigger fn (current has_auth-guarded body + kind passthrough)
CREATE OR REPLACE FUNCTION public.destinatarios_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
  _old destinatarios_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM destinatarios_enc WHERE id = OLD.id;
  END IF;

  UPDATE destinatarios_enc SET
    created_at = NEW.created_at,
    default_category_id = NEW.default_category_id,
    is_active = NEW.is_active,
    kind = NEW.kind,
    name = CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE _old.name END,
    name_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.name) ELSE _old.name_hmac END,
    notes = CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE _old.notes END,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

-- Step 4c: DELETE trigger fn (unchanged)
CREATE OR REPLACE FUNCTION public.destinatarios_view_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM destinatarios_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$function$;

-- Step 5: recreate the three INSTEAD OF triggers (dropped by the CASCADE)
CREATE TRIGGER destinatarios_view_insert_trg
  INSTEAD OF INSERT ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_insert();
CREATE TRIGGER destinatarios_view_update_trg
  INSTEAD OF UPDATE ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_update();
CREATE TRIGGER destinatarios_view_delete_trg
  INSTEAD OF DELETE ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_delete();

-- Step 6: re-grant view permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON destinatarios TO authenticated;
GRANT ALL ON destinatarios TO postgres, service_role;

COMMIT;
