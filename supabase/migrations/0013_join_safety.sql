-- ===========================================================================
-- 0013 -- two fixes around joining a household.
--
-- 1. household_is_empty() decided whether it was safe to DELETE a household.
--    It answered by checking five tables by hand. 0012 added goals and
--    goal_events and never came back here, so a solo user who had done
--    onboarding and built up their goals looked "empty" — accepting a partner
--    invite silently cascaded their entire plan away.
--
--    The list is now derived from the foreign keys instead of written out, so
--    a table added tomorrow counts from the day it exists.
--
-- 2. partner_lookup() answers "does this address have an account". 0004
--    deliberately withheld find_user_by_contact from clients for exactly that
--    reason; 0010 wrapped it and granted the wrapper, guarded only by
--    membership of a household the caller already belongs to — which every
--    caller satisfies with their own id. The feature is wanted, so it stays,
--    but it is now rate limited so it can't be walked through an address list.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. An honest emptiness check
-- ---------------------------------------------------------------------------
create or replace function public.household_is_empty(p_household uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  r record;
  n bigint;
begin
  -- More than one member means it is somebody else's home too.
  select count(*) into n
  from public.household_members
  where household_id = p_household;
  if n > 1 then
    return false;
  end if;

  -- Every table that hangs off households, discovered from the catalog rather
  -- than listed by hand. Enumerating them by hand is precisely what made this
  -- function wrong, and the cost of being wrong here is deleted user data.
  for r in
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.households'::regclass
      and array_length(c.conkey, 1) = 1
  loop
    if r.tbl = 'household_members' then
      -- Counted above; the joiner's own row is expected.
      continue;
    elsif r.tbl = 'household_baseline' then
      -- bootstrap_household seeds this with literal '{}', so its mere
      -- presence means nothing. Content does.
      execute format(
        'select count(*) from %s where %I = $1 and data <> ''{}''::jsonb',
        r.tbl, r.col
      ) into n using p_household;
    else
      execute format('select count(*) from %s where %I = $1', r.tbl, r.col)
        into n using p_household;
    end if;

    if n > 0 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.household_is_empty(uuid) from public, anon;
grant execute on function public.household_is_empty(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Rate limit the partner lookup
-- ---------------------------------------------------------------------------
create table if not exists public.partner_lookup_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists partner_lookup_attempts_user_time
  on public.partner_lookup_attempts (user_id, created_at desc);

alter table public.partner_lookup_attempts enable row level security;

-- No policies: this is bookkeeping for a SECURITY DEFINER function, and
-- nothing should read it through PostgREST. RLS on with no policy denies all
-- client access while the definer function still writes freely.
revoke all on table public.partner_lookup_attempts from anon, authenticated;

create or replace function public.partner_lookup(
  p_household_id uuid,
  p_email text,
  p_phone text
)
returns table (has_account boolean, already_member boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_match uuid;
  v_recent int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  if not exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id and hm.user_id = auth.uid()
  ) then
    raise exception 'not a member of that household';
  end if;

  if p_email is null and p_phone is null then
    raise exception 'an email or phone number is required';
  end if;

  -- Adding a partner takes a handful of tries. Walking an address list takes
  -- thousands, so a generous ceiling still separates the two cleanly.
  select count(*) into v_recent
  from public.partner_lookup_attempts
  where user_id = auth.uid()
    and created_at > now() - interval '1 hour';

  if v_recent >= 20 then
    raise exception 'too many partner searches — try again in an hour';
  end if;

  insert into public.partner_lookup_attempts (user_id) values (auth.uid());

  v_match := public.find_user_by_contact(p_email, p_phone);

  return query
  select
    v_match is not null,
    coalesce(
      v_match is not null and exists (
        select 1 from public.household_members hm
        where hm.household_id = p_household_id and hm.user_id = v_match
      ), false);
end;
$$;

revoke all on function public.partner_lookup(uuid, text, text) from public, anon;
grant execute on function public.partner_lookup(uuid, text, text) to authenticated;

create or replace function public.ourlife_schema_version()
returns int language sql immutable set search_path = '' as $$ select 13 $$;
grant execute on function public.ourlife_schema_version() to anon, authenticated;
