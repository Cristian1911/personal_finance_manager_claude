-- ============================================================
-- Product event analytics views (Week 1 operational reporting)
-- ============================================================

create schema if not exists analytics;

-- Daily event counts by name and flow
create or replace view analytics.product_event_daily_counts as
select
  date_trunc('day', event_time)::date as day,
  event_name,
  coalesce(flow, 'unknown') as flow,
  count(*) as event_count,
  count(distinct user_id) as user_count
from product_events
group by 1, 2, 3;

-- Activation by signup cohort day (D7)
create or replace view analytics.activation_d7 as
with signups as (
  select user_id, min(event_time) as signup_time
  from product_events
  where event_name = 'auth_signup_completed'
    and success is true
  group by user_id
),
activated as (
  select distinct e.user_id
  from product_events e
  join signups s on s.user_id = e.user_id
  where e.event_name in ('import_completed', 'transaction_categorized', 'first_financial_insight_rendered')
    and e.success is true
    and e.event_time <= s.signup_time + interval '7 day'
)
select
  date_trunc('day', s.signup_time)::date as cohort_day,
  count(*) as signups,
  count(a.user_id) as activated_d7,
  case when count(*) = 0 then 0
       else round((count(a.user_id)::numeric / count(*)::numeric) * 100, 2)
  end as activation_d7_pct
from signups s
left join activated a on a.user_id = s.user_id
group by 1
order by 1 desc;

-- Import funnel completion by session/day
create or replace view analytics.import_funnel_daily as
with base as (
  select
    date_trunc('day', event_time)::date as day,
    user_id,
    coalesce(session_id, concat(user_id::text, ':', date_trunc('minute', event_time)::text)) as sid,
    max((event_name = 'import_flow_opened')::int) as opened,
    max((event_name = 'import_file_selected')::int) as file_selected,
    max((event_name = 'import_parse_requested')::int) as parse_requested,
    max((event_name = 'import_parse_succeeded')::int) as parse_succeeded,
    max((event_name = 'import_confirm_submitted')::int) as confirm_submitted,
    max((event_name = 'import_completed' and coalesce(success, false))::int) as completed
  from product_events
  where flow = 'import'
  group by 1, 2, 3
)
select
  day,
  count(*) as sessions,
  sum(opened) as opened,
  sum(file_selected) as file_selected,
  sum(parse_requested) as parse_requested,
  sum(parse_succeeded) as parse_succeeded,
  sum(confirm_submitted) as confirm_submitted,
  sum(completed) as completed,
  case when sum(opened) = 0 then 0
       else round((sum(completed)::numeric / sum(opened)::numeric) * 100, 2)
  end as open_to_complete_pct
from base
group by 1
order by 1 desc;

-- Categorization funnel by day
create or replace view analytics.categorization_funnel_daily as
with base as (
  select
    date_trunc('day', event_time)::date as day,
    user_id,
    max((event_name = 'uncategorized_item_seen')::int) as seen,
    max((event_name = 'category_picker_opened')::int) as picker_opened,
    max((event_name = 'category_selected')::int) as selected,
    max((event_name = 'transaction_categorized' and coalesce(success, false))::int) as categorized,
    max((event_name = 'bulk_categorize_applied' and coalesce(success, false))::int) as bulk_categorized
  from product_events
  where flow = 'categorize'
  group by 1, 2
)
select
  day,
  count(*) as users_with_activity,
  sum(seen) as seen,
  sum(picker_opened) as picker_opened,
  sum(selected) as selected,
  sum(categorized) as categorized,
  sum(bulk_categorized) as bulk_categorized,
  case when sum(seen) = 0 then 0
       else round((sum(categorized)::numeric / sum(seen)::numeric) * 100, 2)
  end as seen_to_categorized_pct
from base
group by 1
order by 1 desc;

