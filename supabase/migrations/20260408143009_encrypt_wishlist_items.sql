-- ==================================================
-- Encrypt wishlist_items table (3 encrypted)
-- ==================================================

ALTER TABLE wishlist_items RENAME TO wishlist_items_enc;

ALTER TABLE wishlist_items_enc
  ALTER COLUMN name TYPE BYTEA USING zeta_encrypt_as(name, user_id);
ALTER TABLE wishlist_items_enc
  ALTER COLUMN url TYPE BYTEA USING zeta_encrypt_as(url, user_id);
ALTER TABLE wishlist_items_enc
  ALTER COLUMN why TYPE BYTEA USING zeta_encrypt_as(why, user_id);

CREATE VIEW wishlist_items WITH (security_invoker = true) AS
SELECT
  account_id, amount, bought_at, category_id, created_at, currency_code,
  desire_type, enriched, enriched_at, funding_type, id, image_url,
  installments, last_nudge_dismissed_at, last_score, last_scored_at,
  last_verdict,
  zeta_decrypt(name) AS name,
  ready_at, status, transaction_id, updated_at, urgency,
  zeta_decrypt(url) AS url,
  user_id,
  zeta_decrypt(why) AS why
FROM wishlist_items_enc;

CREATE OR REPLACE FUNCTION wishlist_items_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wishlist_items_enc (
    account_id, amount, bought_at, category_id, created_at, currency_code,
    desire_type, enriched, enriched_at, funding_type, id, image_url,
    installments, last_nudge_dismissed_at, last_score, last_scored_at,
    last_verdict, name, ready_at, status, transaction_id, updated_at,
    urgency, url, user_id, why
  ) VALUES (
    NEW.account_id, NEW.amount, NEW.bought_at, NEW.category_id,
    NEW.created_at, NEW.currency_code, NEW.desire_type, NEW.enriched,
    NEW.enriched_at, NEW.funding_type, NEW.id, NEW.image_url,
    NEW.installments, NEW.last_nudge_dismissed_at, NEW.last_score,
    NEW.last_scored_at, NEW.last_verdict,
    zeta_encrypt(NEW.name),
    NEW.ready_at, NEW.status, NEW.transaction_id, NEW.updated_at,
    NEW.urgency,
    zeta_encrypt(NEW.url),
    NEW.user_id,
    zeta_encrypt(NEW.why)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wishlist_items_view_insert_trg
  INSTEAD OF INSERT ON wishlist_items
  FOR EACH ROW EXECUTE FUNCTION wishlist_items_view_insert();

CREATE OR REPLACE FUNCTION wishlist_items_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE wishlist_items_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    bought_at = NEW.bought_at,
    category_id = NEW.category_id,
    created_at = NEW.created_at,
    currency_code = NEW.currency_code,
    desire_type = NEW.desire_type,
    enriched = NEW.enriched,
    enriched_at = NEW.enriched_at,
    funding_type = NEW.funding_type,
    image_url = NEW.image_url,
    installments = NEW.installments,
    last_nudge_dismissed_at = NEW.last_nudge_dismissed_at,
    last_score = NEW.last_score,
    last_scored_at = NEW.last_scored_at,
    last_verdict = NEW.last_verdict,
    name = zeta_encrypt(NEW.name),
    ready_at = NEW.ready_at,
    status = NEW.status,
    transaction_id = NEW.transaction_id,
    updated_at = NEW.updated_at,
    urgency = NEW.urgency,
    url = zeta_encrypt(NEW.url),
    user_id = NEW.user_id,
    why = zeta_encrypt(NEW.why)
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wishlist_items_view_update_trg
  INSTEAD OF UPDATE ON wishlist_items
  FOR EACH ROW EXECUTE FUNCTION wishlist_items_view_update();

CREATE OR REPLACE FUNCTION wishlist_items_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM wishlist_items_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wishlist_items_view_delete_trg
  INSTEAD OF DELETE ON wishlist_items
  FOR EACH ROW EXECUTE FUNCTION wishlist_items_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON wishlist_items TO authenticated;
GRANT ALL ON wishlist_items TO postgres, service_role;
