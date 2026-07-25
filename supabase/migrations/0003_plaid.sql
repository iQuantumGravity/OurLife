-- ===========================================================================
-- OurLife — Plaid bank connections
-- Stores linked Plaid Items (one per bank login) and the transactions synced
-- from them. `plaid_items.access_token` is a live credential for reading the
-- household's real bank data, so that table carries RLS with **no** policies
-- for `anon`/`authenticated` — only the service role (which bypasses RLS) may
-- read or write it, from trusted server code. `transactions` is safe for
-- household members to read directly; writes still go through the service
-- role only, during sync.
-- ===========================================================================

-- ===========================================================================
-- plaid_items  (one per linked bank login — holds the Plaid access token)
-- ===========================================================================
create table if not exists public.plaid_items (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  item_id           text not null unique,
  access_token      text not null,
  institution_id    text,
  institution_name  text,
  cursor            text,
  created_at        timestamptz not null default now()
);

create index if not exists plaid_items_household_idx
  on public.plaid_items (household_id);

alter table public.plaid_items enable row level security;
-- Intentionally no policies: only the service role (bypasses RLS) touches
-- this table, from /api/plaid/* route handlers.

-- ===========================================================================
-- transactions  (synced from Plaid, one row per bank transaction)
-- ===========================================================================
create table if not exists public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  plaid_item_id        uuid not null references public.plaid_items (id) on delete cascade,
  plaid_transaction_id text not null unique,
  account_id           text not null,
  name                  text not null,
  merchant_name         text,
  amount                numeric(12,2) not null,
  iso_currency_code     text not null default 'USD',
  date                  date not null,
  pending               boolean not null default false,
  category              text,
  raw                   jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists transactions_household_date_idx
  on public.transactions (household_id, date desc);

alter table public.transactions enable row level security;

create policy "members can view their transactions"
  on public.transactions for select
  using (household_id in (select public.user_household_ids()));
-- No insert/update/delete policy for authenticated — rows are only ever
-- written by the service role during a Plaid sync.
