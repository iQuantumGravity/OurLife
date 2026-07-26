-- ===========================================================================
-- OurLife -- 0012: goals as first-class, bucketed, fundable things
--
-- Until now a "goal" was a loose object inside onboarding_answers.top_goals
-- (jsonb). That can't carry the product: buckets need an owner and a scope,
-- daily feedback needs money allocated PER goal so a purchase can eat into
-- one, and the storyboard needs each goal to have live progress.
--
-- A goal here is:
--   * scoped  -- "shared" (a dream you hold together) or "individual" (mine)
--   * bucketed -- retirement, home, travel, family, debt, purchase, emergency,
--                 invest, education, other  -- the "separate buckets" idea
--   * fundable -- a target amount, a target date, and money allocated to it
--   * ordered  -- an explicit priority, editable, driving the funding waterfall
-- ===========================================================================

create table if not exists public.goals (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,

  -- Who it belongs to. "shared" is the household's; "individual" is one
  -- person's, named by owner_user_id.
  scope          text not null default 'shared'
                   check (scope in ('shared', 'individual')),
  owner_user_id  uuid references auth.users (id) on delete set null,

  -- The bucket. Deliberately broad so a retirement timeline, a $40 gadget and
  -- a house all have a home.
  bucket         text not null default 'other'
                   check (bucket in (
                     'retirement','home','travel','family','debt',
                     'purchase','emergency','invest','education','other')),

  name           text not null,
  note           text,

  target_amount  numeric(14,2) check (target_amount is null or target_amount >= 0),
  -- Money set aside toward THIS goal specifically. The daily-feedback engine
  -- moves this; a manual allocation can too.
  saved_amount   numeric(14,2) not null default 0 check (saved_amount >= 0),

  /** "YYYY-MM-01" -- stored as a date, rendered as a month. */
  target_date    date,
  -- How much per month this goal wants, when the user thinks in cadence rather
  -- than deadline. Either this or target_date drives the projection.
  monthly_contribution numeric(14,2)
                   check (monthly_contribution is null or monthly_contribution >= 0),

  priority       int not null default 100,
  status         text not null default 'active'
                   check (status in ('active','achieved','paused','dropped')),

  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- An individual goal must name its owner; a shared one must not.
  constraint goals_scope_owner check (
    (scope = 'individual' and owner_user_id is not null)
    or (scope = 'shared' and owner_user_id is null)
  )
);

create index if not exists goals_household_idx
  on public.goals (household_id, status, priority);
create index if not exists goals_owner_idx
  on public.goals (household_id, owner_user_id);

alter table public.goals enable row level security;

-- Both partners see every goal, shared or individual: the whole point is a
-- couple painting the picture together. Writes are open to household members;
-- who "owns" an individual goal is about attribution and funding, not secrecy.
create policy "members manage household goals"
  on public.goals for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- goal_events -- the daily-feedback ledger.
--
-- Every time something moves a goal -- a synced transaction, a manual
-- allocation, a plan change -- a row lands here with the delta and why. This
-- is what makes "you made an unplanned purchase, here's the timeline shift"
-- auditable rather than magic.
-- ===========================================================================
create table if not exists public.goal_events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  goal_id       uuid references public.goals (id) on delete cascade,

  kind          text not null
                  check (kind in ('allocation','spend','contribution','adjustment','achieved')),
  -- Positive moves a goal forward, negative sets it back.
  amount        numeric(14,2) not null default 0,
  summary       text,
  -- Link back to the transaction or document that caused it, when there is one.
  source        text not null default 'manual'
                  check (source in ('manual','plaid','document','assistant','system')),
  source_id     text,

  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists goal_events_goal_idx
  on public.goal_events (goal_id, created_at desc);
create index if not exists goal_events_household_idx
  on public.goal_events (household_id, created_at desc);

alter table public.goal_events enable row level security;

create policy "members manage household goal events"
  on public.goal_events for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create or replace function public.ourlife_schema_version()
returns int language sql immutable set search_path = '' as $$ select 12 $$;
grant execute on function public.ourlife_schema_version() to anon, authenticated;
