alter table public.accounts
add column if not exists debit_card_mask text;

create index if not exists idx_accounts_user_debit_card_mask
on public.accounts (user_id, debit_card_mask)
where debit_card_mask is not null and is_active = true;
