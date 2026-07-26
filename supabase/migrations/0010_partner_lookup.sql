-- ===========================================================================
-- OurLife -- 0010: partner search
--
-- The missing piece in linking two people: before sending an invite you need
-- to know whether the person already has an account, because that changes
-- what happens next. A partner who signs up on their own gets their own
-- household and never joins yours — which is exactly what went wrong in
-- production.
--
-- This answers only two booleans: does an account exist, and are they already
-- in this household. Never a user id, never a name, never an email. The
-- underlying find_user_by_contact is deliberately not client-callable so it
-- can't be used to enumerate accounts; this wrapper preserves that by
-- requiring the caller to be a member of the household they're asking about.
-- ===========================================================================
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
returns int language sql immutable set search_path = '' as $$ select 10 $$;
grant execute on function public.ourlife_schema_version() to anon, authenticated;
