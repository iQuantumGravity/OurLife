-- ===========================================================================
-- OurLife — initial schema
-- Households + members, pay stubs, uploaded statement metadata, and the plan
-- baseline. Row-level security ensures each household only ever sees its own
-- data. Apply with the Supabase MCP `apply_migration` tool or the Supabase CLI.
-- ===========================================================================

-- --- extensions -----------------------------------------------------------
create extension if not exists "pgcrypto";

-- --- helper: the household ids the current user belongs to -----------------
-- SECURITY DEFINER so it bypasses RLS on household_members and avoids the
-- recursive-policy trap when household_members' own policies reference it.
create or replace function public.user_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid()
$$;

revoke all on function public.user_household_ids() from public;
grant execute on function public.user_household_ids() to authenticated;

-- --- updated_at helper ------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- households
-- ===========================================================================
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Our household',
  created_by  uuid not null references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.households enable row level security;

create policy "members can view their household"
  on public.households for select
  using (id in (select public.user_household_ids()));

create policy "users can create a household"
  on public.households for insert
  with check (created_by = auth.uid());

create policy "members can update their household"
  on public.households for update
  using (id in (select public.user_household_ids()))
  with check (id in (select public.user_household_ids()));

-- ===========================================================================
-- household_members  (links auth.users <-> households)
-- ===========================================================================
create table if not exists public.household_members (
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text,
  role          text not null default 'partner',
  created_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.household_members enable row level security;

create policy "members can view co-members"
  on public.household_members for select
  using (household_id in (select public.user_household_ids()));

-- Allow adding yourself (bootstrap) or adding someone to a household you're in.
create policy "add self or co-member"
  on public.household_members for insert
  with check (
    user_id = auth.uid()
    or household_id in (select public.user_household_ids())
  );

create policy "members can update membership rows"
  on public.household_members for update
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

-- ===========================================================================
-- household_baseline  (the plan's starting assumptions — one row per household)
-- Stored as jsonb so the model can evolve without a migration each time.
-- ===========================================================================
create table if not exists public.household_baseline (
  household_id  uuid primary key references public.households (id) on delete cascade,
  data          jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

alter table public.household_baseline enable row level security;

create policy "members manage their baseline"
  on public.household_baseline for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create trigger household_baseline_updated_at
  before update on public.household_baseline
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- pay_stubs  (each real paycheck, folded into the model)
-- ===========================================================================
create table if not exists public.pay_stubs (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  member_user_id      uuid references auth.users (id) on delete set null,
  earner              text not null,                 -- free-text label, e.g. "Daniel"
  employer            text,
  pay_date            date not null,
  period_start        date,
  period_end          date,
  gross_amount        numeric(12,2) not null default 0,
  net_amount          numeric(12,2) not null default 0,
  taxes               numeric(12,2) not null default 0,
  retirement_contrib  numeric(12,2) not null default 0,
  other_deductions    numeric(12,2) not null default 0,
  is_commission       boolean not null default false,
  notes               text,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists pay_stubs_household_date_idx
  on public.pay_stubs (household_id, pay_date desc);

alter table public.pay_stubs enable row level security;

create policy "members manage their pay stubs"
  on public.pay_stubs for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create trigger pay_stubs_updated_at
  before update on public.pay_stubs
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- documents  (metadata for uploaded bank / credit-card statements)
-- The files themselves live in the private `statements` storage bucket.
-- ===========================================================================
create table if not exists public.documents (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  uploaded_by       uuid references auth.users (id) on delete set null,
  kind              text not null default 'bank_statement',  -- bank_statement | credit_card_statement | pay_stub | other
  label             text,
  period_label      text,
  storage_path      text not null,
  extracted_balance numeric(12,2),
  extracted_notes   text,
  status            text not null default 'uploaded',          -- uploaded | reviewed | parsed
  created_at        timestamptz not null default now()
);

create index if not exists documents_household_idx
  on public.documents (household_id, created_at desc);

alter table public.documents enable row level security;

create policy "members manage their documents"
  on public.documents for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

-- ===========================================================================
-- storage: private bucket for statements, keyed by household id folder
-- Path convention: {household_id}/{filename}
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('statements', 'statements', false)
on conflict (id) do nothing;

create policy "household members read their statements"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'statements'
    and (storage.foldername(name))[1] in (select public.user_household_ids()::text)
  );

create policy "household members upload their statements"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'statements'
    and (storage.foldername(name))[1] in (select public.user_household_ids()::text)
  );

create policy "household members delete their statements"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'statements'
    and (storage.foldername(name))[1] in (select public.user_household_ids()::text)
  );
