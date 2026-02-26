# Week 1 - Operational Checklist (After DB Migration)

## 1) Run migrations
From repo root:

```bash
supabase db push
```

This must apply:
- `20260225201000_create_product_events.sql`
- `20260225204500_create_product_event_analytics_views.sql`

## 2) Smoke test flows (manual)

### A. Auth + Onboarding
1. Sign up with test user
2. Complete onboarding
3. Open dashboard

Expected events:
- `auth_signup_completed`
- `onboarding_started`
- `onboarding_step_completed` (multiple)
- `onboarding_completed`
- `dashboard_viewed`

### B. Import flow
1. Open import wizard
2. Select PDF
3. Parse
4. Confirm import

Expected events:
- `import_flow_opened`
- `import_file_selected`
- `import_parse_requested`
- `import_parse_succeeded` (or `import_parse_failed`)
- `import_account_mapping_completed`
- `import_confirm_submitted`
- `import_completed`

### C. Categorization flow
1. Open categorize inbox
2. Open picker
3. Select category
4. Apply single/bulk

Expected events:
- `uncategorized_item_seen`
- `category_suggestion_shown`
- `category_picker_opened`
- `category_selected`
- `transaction_categorized`
- `bulk_categorize_applied`

## 3) SQL validation

### Raw events inserted
```sql
select event_name, count(*)
from product_events
where event_time >= now() - interval '1 day'
group by event_name
order by count(*) desc;
```

### Daily counts view
```sql
select *
from analytics.product_event_daily_counts
order by day desc, event_count desc
limit 50;
```

### Activation D7
```sql
select *
from analytics.activation_d7
order by cohort_day desc
limit 30;
```

### Import funnel
```sql
select *
from analytics.import_funnel_daily
order by day desc
limit 30;
```

### Categorization funnel
```sql
select *
from analytics.categorization_funnel_daily
order by day desc
limit 30;
```

## 4) Data quality checks

### Events without flow (should trend to 0 for new events)
```sql
select event_name, count(*)
from product_events
where flow is null
  and event_time >= now() - interval '7 day'
group by event_name
order by count(*) desc;
```

### Failed events without error code (should be 0)
```sql
select count(*) as failed_without_error_code
from product_events
where success = false
  and (error_code is null or btrim(error_code) = '');
```

## 5) Definition of done for Week 1
- Migrations deployed
- F1/F2/F3 events visible in `product_events`
- Views return non-empty data
- 7 days of stable event capture ready for Week 2 behavior mapping
