-- ===========================================================================
-- OurLife -- 0007: atomic household bootstrap
--
-- getContext() created a household for a first-time user like this:
--
--   insert into households (...) select("id").single()
--
-- PostgREST implements `.select()` after an insert as a RETURNING clause, and
-- RETURNING is filtered by the table's SELECT policy. That policy is
--
--   id in (select public.user_household_ids())
--
-- and at the moment of insert the caller is not a member of the household
-- yet -- the membership row is written on the NEXT statement. So the row was
-- created but came back empty, `hh` was null, and getContext() returned null.
--
-- The visible effect was that every signed-in user looked signed-out: the
-- dashboard fell back to sample data, the assistant's input stayed disabled,
-- and nothing could ever be saved. Zero households existed in production
-- despite real sign-ups.
--
-- Doing the whole bootstrap inside one SECURITY DEFINER function fixes the
-- ordering problem and makes it atomic: either the household, the membership
-- and the baseline all exist, or none of them do.
-- ===========================================================================

create or replace function public.bootstrap_household(p_name text default 'Our household')
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_household uuid;
  v_existing  uuid;
  v_email     text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  -- Idempotent: if the caller already belongs somewhere, hand that back
  -- rather than spawning a second household on a double-submit.
  select hm.household_id into v_existing
  from public.household_members hm
  where hm.user_id = auth.uid()
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  select u.email into v_email from auth.users u where u.id = auth.uid();

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Our household'), auth.uid())
  returning id into v_household;

  insert into public.household_members (household_id, user_id, display_name)
  values (v_household, auth.uid(), split_part(coalesce(v_email, ''), '@', 1))
  on conflict (household_id, user_id) do nothing;

  insert into public.household_baseline (household_id, data)
  values (v_household, '{}'::jsonb)
  on conflict (household_id) do nothing;

  return v_household;
end;
$$;

revoke all on function public.bootstrap_household(text) from public, anon;
grant execute on function public.bootstrap_household(text) to authenticated;

-- Bump the marker so /setup can tell this migration landed.
create or replace function public.ourlife_schema_version()
returns int
language sql
immutable
set search_path = ''
as $$ select 7 $$;

grant execute on function public.ourlife_schema_version() to anon, authenticated;
