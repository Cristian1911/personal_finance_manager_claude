-- Capture tokens: scoped API keys for external integrations (MCP, Telegram, WhatsApp)
create table if not exists capture_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  label text not null default 'Default',
  default_account_id uuid references accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,

  constraint capture_tokens_token_length check (char_length(token) >= 32)
);

-- Index for token lookup (used on every /api/capture request)
create index idx_capture_tokens_token on capture_tokens (token) where revoked_at is null;

-- Index for user listing
create index idx_capture_tokens_user_id on capture_tokens (user_id);

-- RLS
alter table capture_tokens enable row level security;

create policy "Users can manage their own capture tokens"
  on capture_tokens for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
