-- Labelled set for the Jev eval: one user's human-confirmed categories.
-- Run via Supabase MCP / psql as a role allowed to call zeta_decrypt_as.
-- Save the rows as TSV (descr, label, dir, acct, n, first, src) into $JEV_EVAL_DIR/data.tsv.
-- Never commit the output: it contains decrypted bank descriptions.
with t as (
  select t.transaction_date d,
         coalesce(zeta_decrypt_as(t.raw_description, t.user_id), zeta_decrypt_as(t.merchant_name, t.user_id)) descr,
         t.categorization_source::text src, t.direction::text dir, a.account_type::text acct,
         c.name cat, p.name parent
  from transactions_enc t
  join accounts_enc a on a.id = t.account_id
  join categories c on c.id = t.category_id
  left join categories p on p.id = c.parent_id
  where t.user_id = :user_id
    and not coalesce(t.is_excluded, false)
    and t.reconciled_into_transaction_id is null
    and t.categorization_source in ('USER_OVERRIDE', 'USER_CREATED', 'USER_LEARNED')
)
select descr, coalesce(parent || ' > ', '') || cat as label, dir, acct, count(*) n, min(d) first,
       string_agg(distinct substr(src, 6, 1), ',') src   -- L=USER_LEARNED, O=USER_OVERRIDE, C=USER_CREATED
from t group by 1, 2, 3, 4 order by min(d);

-- cats.json: {"<category id>": "Parent > Name"} for system + the user's categories
-- select json_object_agg(c.id, coalesce(p.name || ' > ', '') || c.name)
-- from categories c left join categories p on p.id = c.parent_id
-- where c.user_id is null or c.user_id = :user_id;
