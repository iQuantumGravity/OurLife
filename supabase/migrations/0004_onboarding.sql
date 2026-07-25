-- ===========================================================================
-- OurLife -- 0004: onboarding
--
-- Adds:
--   * user_profiles       phone number + display name (lets someone be found
--                          by phone even without SMS auth enabled)
--   * partner_invites     link-based invites to collaborate on a household
--   * onboarding_state    shared per-household onboarding settings
--   * onboarding_answers  per-person Life and Money track answers (one row per
--                          household+user, so couple mode can compare two
--                          people's answers)
--
-- SECURITY NOTES (learned the hard way -- see the comments on each function):
--   * respond_to_invite's identity check MUST be NULL-safe. SQL three-valued
--     logic makes `not (a or b or c)` evaluate to NULL when a branch is NULL,
--     and PL/pgSQL treats a NULL IF condition as false -- which silently skips
--     the guard and lets any token-holder join. Every predicate here is
--     wrapped so it can only ever be true or false.
--   * find_user_by_contact is NOT granted to clients. Exposing an
--     "does this email/phone have an account" RPC to any signed-up user is an
--     enumeration oracle. Invite creation goes through create_partner_invite,
--     which resolves the contact internally and never returns the uuid.
--
-- This file is re-runnable: every policy is dropped first, and triggers use
-- CREATE OR REPLACE (PG14+).
-- ===========================================================================

-- ===========================================================================
-- user_profiles  (phone + display name; one row per auth user)
-- ===========================================================================
create table if not exists public.user_profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  phone         text unique,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "self manage profile" on public.user_profiles;
create policy "self manage profile"
  on public.user_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "household members can view co-member profiles" on public.user_profiles;
create policy "household members can view co-member profiles"
  on public.user_profiles for select
  using (
    user_id in (
      select hm.user_id
      from public.household_members hm
      where hm.household_id in (select public.user_household_ids())
    )
  );

create or replace trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- partner_invites
--
-- A pending invite is a bearer credential, so it expires. Status transitions
-- happen only inside respond_to_invite() (SECURITY DEFINER), which is why
-- there is deliberately no UPDATE policy for clients.
-- ===========================================================================
create table if not exists public.partner_invites (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  inviter_user_id   uuid not null references auth.users (id) on delete cascade,
  invitee_user_id   uuid references auth.users (id) on delete set null,
  invitee_email     text,
  invitee_phone     text,
  token             text not null unique,
  status            text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '7 days',
  responded_at      timestamptz,
  constraint partner_invites_contact_present check (invitee_email is not null or invitee_phone is not null)
);

-- Added separately so re-running against an older copy of this table upgrades it.
alter table public.partner_invites
  add column if not exists expires_at timestamptz not null default now() + interval '7 days';

create index if not exists partner_invites_household_idx
  on public.partner_invites (household_id);

alter table public.partner_invites enable row level security;

drop policy if exists "members can view their household's invites" on public.partner_invites;
create policy "members can view their household's invites"
  on public.partner_invites for select
  using (household_id in (select public.user_household_ids()));

-- Insert goes through create_partner_invite(); this policy is a backstop that
-- still refuses to let anyone forge an invite from another household or claim
-- to be a different inviter.
drop policy if exists "members can create invites" on public.partner_invites;
create policy "members can create invites"
  on public.partner_invites for insert
  with check (
    household_id in (select public.user_household_ids())
    and inviter_user_id = auth.uid()
  );

drop policy if exists "inviters can cancel a pending invite" on public.partner_invites;
create policy "inviters can cancel a pending invite"
  on public.partner_invites for delete
  using (
    inviter_user_id = auth.uid()
    and household_id in (select public.user_household_ids())
    and status = 'pending'
  );

-- ===========================================================================
-- find_user_by_contact -- resolve an existing account by email or phone.
--
-- NOT granted to anon/authenticated: reachable only from other SECURITY
-- DEFINER functions in this file. Exposing it directly would let any signed-up
-- user test arbitrary emails/phones for account existence.
--
-- Deterministic: an exact email match always wins over a phone match, so
-- supplying both can never bind an invite to an arbitrary account.
-- ===========================================================================
create or replace function public.find_user_by_contact(p_email text, p_phone text)
returns uuid
language sql
security definer
stable
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  left join public.user_profiles p on p.user_id = u.id
  where (p_email is not null and lower(u.email) = lower(p_email))
     or (p_phone is not null and (p.phone = p_phone or u.phone = p_phone))
  order by
    (p_email is not null and lower(u.email) = lower(p_email)) desc,
    u.created_at asc
  limit 1
$$;

revoke all on function public.find_user_by_contact(text, text) from public, anon, authenticated;

-- ===========================================================================
-- create_partner_invite -- create an invite without leaking whether the
-- contact already has an account as a standalone probe. Returns the generated
-- token plus a "matched" flag (a boolean, never the uuid).
-- ===========================================================================
create or replace function public.create_partner_invite(
  p_household_id uuid,
  p_email        text,
  p_phone        text
)
returns table (token text, matched boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_match uuid;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  if p_email is null and p_phone is null then
    raise exception 'an email or phone number is required';
  end if;

  -- Caller must be a member of the household they are inviting into.
  if not exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id and hm.user_id = auth.uid()
  ) then
    raise exception 'not a member of that household';
  end if;

  v_match := public.find_user_by_contact(p_email, p_phone);
  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.partner_invites (
    household_id, inviter_user_id, invitee_user_id,
    invitee_email, invitee_phone, token
  )
  values (
    p_household_id, auth.uid(), v_match,
    p_email, p_phone, v_token
  );

  return query select v_token, (v_match is not null);
end;
$$;

revoke all on function public.create_partner_invite(uuid, text, text) from public, anon;
grant execute on function public.create_partner_invite(uuid, text, text) to authenticated;

-- ===========================================================================
-- get_invite_preview -- lets the (possibly signed-out) person on the other end
-- of an invite link see who is inviting them, without a client-facing SELECT
-- policy on partner_invites. Only ever answers for a live, pending invite, so
-- a consumed or expired token stops being a status oracle.
-- ===========================================================================
create or replace function public.get_invite_preview(p_token text)
returns table (household_name text, inviter_name text)
language sql
security definer
stable
set search_path = public
as $$
  select h.name, p.display_name
  from public.partner_invites i
  join public.households h on h.id = i.household_id
  left join public.user_profiles p on p.user_id = i.inviter_user_id
  where i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
$$;

revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- ===========================================================================
-- respond_to_invite -- accept or decline.
--
-- The identity check is built so every branch is strictly boolean. Writing it
-- as `if not (a or b or c)` would be a security hole: when invitee_user_id is
-- NULL (the normal case for inviting someone who has no account yet) the
-- expression is NULL, `not NULL` is NULL, and PL/pgSQL skips a NULL IF -- so
-- the guard silently would not fire and ANY token holder would be let in.
-- ===========================================================================
create or replace function public.respond_to_invite(p_token text, p_action text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite public.partner_invites%rowtype;
  v_caller_email text;
  v_caller_phone text;
  v_authorized boolean;
begin
  if p_action not in ('accept', 'decline') then
    raise exception 'invalid action';
  end if;

  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into v_invite
  from public.partner_invites
  where token = p_token and status = 'pending' and expires_at > now()
  for update;

  if not found then
    raise exception 'invite not found, already answered, or expired';
  end if;

  select u.email into v_caller_email from auth.users u where u.id = auth.uid();
  select p.phone into v_caller_phone from public.user_profiles p where p.user_id = auth.uid();

  -- Each branch is coalesced to a real boolean; an unknown never reads as
  -- "authorized". Both sides of every comparison must be non-null to match.
  v_authorized :=
       coalesce(v_invite.invitee_user_id = auth.uid(), false)
    or coalesce(
         v_invite.invitee_email is not null
         and v_caller_email is not null
         and lower(v_invite.invitee_email) = lower(v_caller_email), false)
    or coalesce(
         v_invite.invitee_phone is not null
         and v_caller_phone is not null
         and v_invite.invitee_phone = v_caller_phone, false);

  if not coalesce(v_authorized, false) then
    raise exception 'this invite is not addressed to you';
  end if;

  if p_action = 'accept' then
    insert into public.household_members (household_id, user_id, display_name)
    values (v_invite.household_id, auth.uid(), v_caller_email)
    on conflict (household_id, user_id) do nothing;

    update public.partner_invites
    set status = 'accepted', invitee_user_id = auth.uid(), responded_at = now()
    where id = v_invite.id;
  else
    update public.partner_invites
    set status = 'declined', invitee_user_id = auth.uid(), responded_at = now()
    where id = v_invite.id;
  end if;
end;
$$;

revoke all on function public.respond_to_invite(text, text) from public, anon;
grant execute on function public.respond_to_invite(text, text) to authenticated;

-- ===========================================================================
-- onboarding_state  (one row per household -- shared settings only)
--
-- Per-question progress is tracked per person on onboarding_answers below, so
-- each partner moves through the Life track at their own pace.
-- ===========================================================================
create table if not exists public.onboarding_state (
  household_id  uuid primary key references public.households (id) on delete cascade,
  mode          text not null default 'individual' check (mode in ('individual', 'couple')),
  updated_at    timestamptz not null default now()
);

alter table public.onboarding_state enable row level security;

drop policy if exists "members manage their onboarding state" on public.onboarding_state;
create policy "members manage their onboarding state"
  on public.onboarding_state for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create or replace trigger onboarding_state_updated_at
  before update on public.onboarding_state
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- onboarding_answers  (one row per household+user -- Life & Money tracks)
--
-- CHECK constraints deliberately mirror the Zod bounds in
-- src/lib/onboarding/schema.ts so the database can never hold a value the
-- application refuses to parse.
-- ===========================================================================
create table if not exists public.onboarding_answers (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,

  -- Per-person progress
  life_track_completed_at   timestamptz,
  money_track_completed_at  timestamptz,
  comparison_viewed_at      timestamptz,

  -- Life track
  relationship_status    text check (relationship_status in ('single', 'partnered', 'married', 'other')),
  has_partner            boolean,
  married                boolean,
  plan_to_marry          boolean,
  marriage_timeline      text    check (marriage_timeline is null or length(marriage_timeline) <= 120),
  kids_status            text    check (kids_status in ('has', 'wants', 'none')),
  kids_count             int     check (kids_count is null or kids_count between 0 and 20),
  kids_timeline_years    int     check (kids_timeline_years is null or kids_timeline_years between 0 and 40),
  retirement_age         int     check (retirement_age is null or retirement_age between 30 and 90),
  location               text    check (location is null or length(location) <= 120),
  vision                 text    check (vision is null or length(vision) <= 2000),
  top_goals              jsonb not null default '[]'::jsonb check (jsonb_typeof(top_goals) = 'array'),

  -- Money track
  income_type            text    check (income_type in ('salary', 'hourly', 'commission', 'self_employed', 'mixed', 'other')),
  existing_debt          jsonb not null default '[]'::jsonb check (jsonb_typeof(existing_debt) = 'array'),
  current_savings        numeric(14,2) check (current_savings is null or current_savings >= 0),
  risk_tolerance         text    check (risk_tolerance in ('conservative', 'moderate', 'aggressive')),

  skipped_fields         text[] not null default '{}',
  raw                    jsonb not null default '{}'::jsonb check (jsonb_typeof(raw) = 'object'),
  updated_at             timestamptz not null default now(),

  unique (household_id, user_id)
);

-- Added separately so re-running against an older copy upgrades it in place.
alter table public.onboarding_answers
  add column if not exists comparison_viewed_at timestamptz;

create index if not exists onboarding_answers_household_idx
  on public.onboarding_answers (household_id);

alter table public.onboarding_answers enable row level security;

drop policy if exists "members manage their own onboarding answers" on public.onboarding_answers;
create policy "members manage their own onboarding answers"
  on public.onboarding_answers for all
  using (user_id = auth.uid() and household_id in (select public.user_household_ids()))
  with check (user_id = auth.uid() and household_id in (select public.user_household_ids()));

drop policy if exists "members can view co-member onboarding answers" on public.onboarding_answers;
create policy "members can view co-member onboarding answers"
  on public.onboarding_answers for select
  using (household_id in (select public.user_household_ids()));

create or replace trigger onboarding_answers_updated_at
  before update on public.onboarding_answers
  for each row execute function public.set_updated_at();
