-- ===========================================================================
-- OurLife -- 0002: the living layer
--
-- Adds the pieces that turn the baseline plan into a tool that grows:
--   * documents.*        parsing state for uploaded pay stubs / statements
--   * document_line_items transactions extracted out of a statement
--   * chat_threads/messages  the assistant conversation, per household
--   * plan_events        journal of every change (who/what/before/after)
--   * scenarios          named what-if branches of the plan
--
-- Every table is row-level-security scoped to household membership, exactly
-- like 0001. Apply with the Supabase CLI (supabase db push) or the SQL editor.
-- ===========================================================================

-- --- documents: parsing state --------------------------------------------
alter table public.documents add column if not exists mime_type text;
alter table public.documents add column if not exists byte_size bigint;
alter table public.documents add column if not exists parsed_at timestamptz;
alter table public.documents add column if not exists parsed_data jsonb;
alter table public.documents add column if not exists parse_error text;
alter table public.documents add column if not exists parse_model text;

-- --- document_line_items: transactions pulled out of a statement ----------
create table if not exists public.document_line_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  txn_date date,
  description text,
  merchant text,
  amount numeric(14,2) not null default 0,
  direction text not null default 'debit',
  category text,
  account_label text,
  balance_after numeric(14,2),
  is_recurring boolean not null default false,
  confidence numeric(4,3),
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_line_items_household_date_idx
  on public.document_line_items (household_id, txn_date desc);
create index if not exists document_line_items_document_idx
  on public.document_line_items (document_id);

alter table public.document_line_items enable row level security;

create policy "members manage their line items"
  on public.document_line_items for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

-- --- assistant chat -------------------------------------------------------
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null default 'New conversation',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_threads_household_idx
  on public.chat_threads (household_id, updated_at desc);

alter table public.chat_threads enable row level security;

create policy "members manage their threads"
  on public.chat_threads for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create trigger chat_threads_updated_at
  before update on public.chat_threads
  for each row execute function public.set_updated_at();

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null,
  content text,
  tool_calls jsonb,
  model text,
  author_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_idx
  on public.chat_messages (thread_id, created_at);

alter table public.chat_messages enable row level security;

create policy "members manage their messages"
  on public.chat_messages for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

-- --- plan_events: the journal of how the plan changed ---------------------
create table if not exists public.plan_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source text not null default 'chat',
  action text not null,
  summary text,
  before_data jsonb,
  after_data jsonb,
  thread_id uuid references public.chat_threads(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists plan_events_household_idx
  on public.plan_events (household_id, created_at desc);

alter table public.plan_events enable row level security;

create policy "members manage their plan events"
  on public.plan_events for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

-- --- scenarios: what-if branches of the plan ------------------------------
create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default false,
  overrides jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scenarios_household_idx
  on public.scenarios (household_id, created_at desc);

alter table public.scenarios enable row level security;

create policy "members manage their scenarios"
  on public.scenarios for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create trigger scenarios_updated_at
  before update on public.scenarios
  for each row execute function public.set_updated_at();
