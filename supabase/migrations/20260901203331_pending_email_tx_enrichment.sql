-- Enrich queued email transactions before importing.
--
-- The user can now set a category, tags and a note on a row while it still
-- sits in the "Pendientes por correo" queue. On approve, the enrichment lands
-- on the created transaction (category as USER_OVERRIDE, tags via
-- transaction_tags, notes verbatim). Keeping it on the pending row means it
-- survives reloads and is shared between the desktop card, the mobile
-- Herramientas panel and the dedicated /import/correo inbox.
alter table pending_email_transactions
  add column if not exists category_id uuid references categories(id) on delete set null,
  add column if not exists tag_ids uuid[] not null default '{}',
  add column if not exists notes text;
