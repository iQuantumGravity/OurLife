-- ===========================================================================
-- OurLife -- 0011: household_people as a function, not a view
--
-- 0008 shipped household_people as a view with security_invoker = true. That
-- means it runs with the caller's rights — and `authenticated` has no SELECT
-- on auth.users, which the view joins to derive a fallback display name. The
-- query failed, the client saw no rows, and every household reported ZERO
-- people. Symptom: the per-person finances split rendered "People 0" with no
-- panels at all, even for a household that plainly had a member.
--
-- A SECURITY DEFINER function can read auth.users while still refusing to
-- answer for a household the caller doesn't belong to — the same shape used
-- for the invite functions.
-- ===========================================================================

drop view if exists public.household_people;

create or replace function public.get_household_people(p_household_id uuid)
returns table (user_id uuid, name text, role text, created_at timestamptz)
language plpgsql
security definer
stable
set search_path = public, auth
as $$
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

  return query
    select
      hm.user_id,
      coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(hm.display_name), ''),
        split_part(coalesce(u.email, ''), '@', 1),
        'Member'
      )::text,
      hm.role::text,
      hm.created_at
    from public.household_members hm
    left join public.user_profiles p on p.user_id = hm.user_id
    left join auth.users u on u.id = hm.user_id
    where hm.household_id = p_household_id
    order by hm.created_at asc;
end;
$$;

revoke all on function public.get_household_people(uuid) from public, anon;
grant execute on function public.get_household_people(uuid) to authenticated;

create or replace function public.ourlife_schema_version()
returns int language sql immutable set search_path = '' as $$ select 11 $$;
grant execute on function public.ourlife_schema_version() to anon, authenticated;
