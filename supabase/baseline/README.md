# Database baseline (2026-09-29)

The migrations folder can't build Zeta's database from zero: the first tables were created in the Supabase dashboard before `supabase/migrations/` existed (the first migration alters `accounts`, which no migration creates). This folder fixes that.

| File | What |
|---|---|
| `2026-09-29-prod-schema.sql` | Schema-only dump of production (`supabase db dump`, no data): tables, views, functions, policies, triggers, enums in the app schemas. Includes the effect of every migration up to `20260923182914`. |
| `2026-09-29-prod-extras.sql` | What that dump leaves out: `auth.users` triggers (profile + per-user encryption key), the `cleanup-anonymous-demo-users` cron job, the 4 storage buckets and their policies, and a **new** Vault master key generated for the target project. |

## Building a new project (how `zeta-dev` was made)
1. `psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -f 2026-09-29-prod-schema.sql -f 2026-09-29-prod-extras.sql` (one transaction; psql from the `public.ecr.aws/supabase/postgres` image works without a local install).
2. Mark every existing migration as applied: `ls supabase/migrations/*.sql | xargs -n1 basename | cut -d_ -f1 | xargs npx supabase migration repair --status applied --db-url "$DB_URL"`.
3. From then on, new migrations go through `npx supabase db push --db-url "$DB_URL"` as usual.

Verified on `zeta-dev`: object counts identical to production (47 tables, 13 views, 64 functions, 132 policies, 58 triggers, 19 enums); sign-up creates the profile and data key; an account name round-trips through encryption and is stored encrypted.

**Never run these files against production.** Refresh the dump when the baseline gets stale (e.g. before creating another project).

## History alignment (2026-09-29)
Production's migration history had drifted from this folder (17 files recorded under other timestamps after being applied from the dashboard, plus one change never committed). Aligned: production and `zeta-dev` both list 164/164. Apply migrations with `supabase db push`/CLI from now on, not from the dashboard or MCP, so versions stay in sync.
