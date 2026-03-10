-- Migrate existing category_rules into destinatarios + destinatario_rules.
-- Each unique pattern becomes a destinatario (named after the pattern),
-- with the linked category as default_category_id.

-- 1. Create destinatarios from existing rules
INSERT INTO destinatarios (user_id, name, default_category_id)
SELECT cr.user_id, cr.pattern, cr.category_id
FROM category_rules cr
ON CONFLICT DO NOTHING;

-- 2. Create matching rules for each migrated destinatario
INSERT INTO destinatario_rules (user_id, destinatario_id, match_type, pattern)
SELECT d.user_id, d.id, 'contains', lower(d.name)
FROM destinatarios d
INNER JOIN category_rules cr
  ON cr.user_id = d.user_id AND lower(cr.pattern) = lower(d.name)
ON CONFLICT DO NOTHING;
