-- ===========================================================================
-- OurLife -- 0004: onboarding
--
-- Adds:
--   * user_profiles     phone number + display name (lets someone be found
--                        by phone even without SMS auth enabled)
--   * partner_invites   search-by-email/phone + link-based invites to
--                        collaborate on a household's plan
--   * onboarding_state  per-household wizard progress (mode, current step,
--                        which parts are done) -- shared, so either partner
--                        picks up where the other left off
--   * onboarding_answers  per-person structured answers for the Life and
--                        Money tracks (one row per household+user, so couple
--                        mode can compare two people's answers)
--
-- Two SECURITY DEFINER functions centralize the sensitive bits instead of
-- scattering them across RLS policies:
--   * find_user_by_contact(email, phone) -> uuid       (search, minimal leak)
--   * respond_to_invite(token, action)   -> void        (accept/decline)
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

create policy "self manage profile"
  on public.user_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "household members can view co-member profiles"
  on public.user_profiles for select
  using (
    user_id in (
      select hm.user_id
      from public.household_members hm
      where hm.household_id in (select public.user_household_ids())
    )
  );

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- partner_invites
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
  responded_at      timestamptz,
  constraint partner_invites_contact_present check (invitee_email is not null or invitee_phone is not null)
);

create index if not exists partner_invites_household_idx
  on public.partner_invites (household_id);

alter table public.partner_invites enable row level security;

-- Household members can see and create invites for their household, and
-- cancel ones they sent while still pending. Status transitions to
-- accepted/declined only happen inside respond_to_invite() below, so there
-- is deliberately no UPDATE policy here.
create policy "members can view their household's invites"
  on public.partner_invites for select
  using (household_id in (select public.user_household_ids()));

create policy "members can create invites"
  on public.partner_invites for insert
  with check (
    household_id in (select public.user_household_ids())
    and inviter_user_id = auth.uid()
  );

create policy "inviters can cancel a pending invite"
  on public.partner_invites for delete
  using (
    household_id in (select public.user_household_ids())
    and status = 'pending'
  );

-- ===========================================================================
-- find_user_by_contact -- looks up an existing account by email or phone
-- without exposing a general directory. Returns only the matching user id
-- (or null), never email/phone back to the caller.
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
     or (p_phone is not null and p.phone = p_phone)
  limit 1
$$;

revoke all on function public.find_user_by_contact(text, text) from public;
grant execute on function public.find_user_by_contact(text, text) to authenticated;

-- ===========================================================================
-- get_invite_preview -- lets the (possibly signed-out) person on the other
-- end of an invite link see who/what they're being asked to join, without
-- needing a client-facing SELECT policy on partner_invites. Reachable only
-- by knowing the random token, same trust model as the token itself.
-- ===========================================================================
create or replace function public.get_invite_preview(p_token text)
returns table (household_name text, inviter_name text, status text)
language sql
security definer
stable
set search_path = public
as $$
  select h.name, p.display_name, i.status
  from public.partner_invites i
  join public.households h on h.id = i.household_id
  left join public.user_profiles p on p.user_id = i.inviter_user_id
  where i.token = p_token
$$;

revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- ===========================================================================
-- respond_to_invite -- accept or decline, matched by token + the caller's
-- own identity (auth.uid(), their email, or their saved phone). Accepting
-- adds the caller to the household; declining just closes out the invite.
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
begin
  if p_action not in ('accept', 'decline') then
    raise exception 'invalid action';
  end if;

  select * into v_invite
  from public.partner_invites
  where token = p_token and status = 'pending'
  for update;

  if not found then
    raise exception 'invite not found or already answered';
  end if;

  select email into v_caller_email from auth.users where id = auth.uid();
  select phone into v_caller_phone from public.user_profiles where user_id = auth.uid();

  if not (
    v_invite.invitee_user_id = auth.uid()
    or (v_invite.invitee_email is not null and lower(v_invite.invitee_email) = lower(v_caller_email))
    or (v_invite.invitee_phone is not null and v_invite.invitee_phone = v_caller_phone)
  ) then
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

revoke all on function public.respond_to_invite(text, text) from public;
grant execute on function public.respond_to_invite(text, text) to authenticated;

-- ===========================================================================
-- onboarding_state  (one row per household -- shared settings)
--
-- Progress through individual questions is tracked per-person, on
-- onboarding_answers below (each partner moves through the Life track at
-- their own pace in couple mode). This table only holds what's genuinely
-- shared: which mode the household picked, and whether the comparison
-- screen has been shown.
-- ===========================================================================
create table if not exists public.onboarding_state (
  household_id              uuid primary key references public.households (id) on delete cascade,
  mode                      text not null default 'individual' check (mode in ('individual', 'couple')),
  comparison_viewed_at      timestamptz,
  updated_at                timestamptz not null default now()
);

alter table public.onboarding_state enable row level security;

create policy "members manage their onboarding state"
  on public.onboarding_state for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create trigger onboarding_state_updated_at
  before update on public.onboarding_state
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- onboarding_answers  (one row per household+user -- Life & Money tracks)
--
-- Fields used by the comparison screen and the planning engine are typed
-- columns; anything looser (vision text, free-form notes, future questions)
-- lives in `raw`, mirroring how household_baseline.data works in 0001.
-- ===========================================================================
create table if not exists public.onboarding_answers (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,

  -- Per-person progress
  life_track_completed_at   timestamptz,
  money_track_completed_at  timestamptz,

  -- Life track
  relationship_status    text check (relationship_status in ('single', 'partnered', 'married', 'other')),
  has_partner            boolean,
  married                boolean,
  plan_to_marry          boolean,
  marriage_timeline      text,
  kids_status            text check (kids_status in ('has', 'wants', 'none')),
  kids_count             int,
  kids_timeline_years    int,
  retirement_age         int,
  location               text,
  vision                 text,
  top_goals              jsonb not null default '[]'::jsonb,

  -- Money track
  income_type            text check (income_type in ('salary', 'hourly', 'commission', 'self_employed', 'mixed', 'other')),
  existing_debt          jsonb not null default '[]'::jsonb,
  current_savings         numeric(14,2),
  risk_tolerance          text check (risk_tolerance in ('conservative', 'moderate', 'aggressive')),

  skipped_fields          text[] not null default '{}',
  raw                      jsonb not null default '{}'::jsonb,
  updated_at               timestamptz not null default now(),

  unique (household_id, user_id)
);

create index if not exists onboarding_answers_household_idx
  on public.onboarding_answers (household_id);

alter table public.onboarding_answers enable row level security;

create policy "members manage their own onboarding answers"
  on public.onboarding_answers for all
  using (user_id = auth.uid() and household_id in (select public.user_household_ids()))
  with check (user_id = auth.uid() and household_id in (select public.user_household_ids()));

create policy "members can view co-member onboarding answers"
  on public.onboarding_answers for select
  using (household_id in (select public.user_household_ids()));

create trigger onboarding_answers_updated_at
  before update on public.onboarding_answers
  for each row execute function public.set_updated_at();
