-- ===========================================================================
-- OurLife -- 0009: make bootstrap race-safe, and let an existing account join
--
-- Two problems seen in production:
--
-- 1. A user ended up with TWO households. bootstrap_household() checked "are
--    you already a member?" and only then inserted — but Next renders the
--    layout and the page in parallel, and both call getContext(). Two
--    concurrent calls each saw no membership and each created a household.
--    Now serialised per-user with a transaction-scoped advisory lock.
--
-- 2. A partner signed up normally instead of through the invite link, so she
--    got her own household and there was nothing to "accept" her into the
--    other one. Accepting an invite now moves you out of a household you were
--    only ever auto-assigned — provided it holds no real data — instead of
--    leaving you a member of two.
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

  -- Serialise per user for the rest of the transaction. Without this, the
  -- layout's and the page's concurrent getContext() calls both pass the
  -- membership check below and each create a household.
  perform pg_advisory_xact_lock(hashtext('ourlife_bootstrap:' || auth.uid()::text));

  select hm.household_id into v_existing
  from public.household_members hm
  where hm.user_id = auth.uid()
  order by hm.created_at asc
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

-- ===========================================================================
-- household_is_empty -- does this household hold anything worth keeping?
-- Used to decide whether it is safe to abandon an auto-created household when
-- its owner joins someone else's.
-- ===========================================================================
create or replace function public.household_is_empty(p_household uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    not exists (select 1 from public.pay_stubs      where household_id = p_household)
    and not exists (select 1 from public.documents  where household_id = p_household)
    and not exists (select 1 from public.plaid_items where household_id = p_household)
    and not exists (select 1 from public.transactions where household_id = p_household)
    and not exists (
      select 1 from public.household_baseline
      where household_id = p_household and data <> '{}'::jsonb
    )
    -- More than one member means it is somebody else's home too.
    and (select count(*) from public.household_members where household_id = p_household) <= 1
$$;

revoke all on function public.household_is_empty(uuid) from public, anon;
grant execute on function public.household_is_empty(uuid) to authenticated;

-- ===========================================================================
-- respond_to_invite -- accept/decline, now handling the "I already have my
-- own household" case that a normal sign-up creates.
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
  v_old uuid;
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

  -- Every branch coalesced to a real boolean: SQL three-valued logic would
  -- otherwise make `not (a or b or c)` evaluate to NULL and skip the guard.
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
    -- Leave any household that was only ever auto-created for us and holds
    -- nothing. Without this you end up a member of two, and getContext()
    -- picks one arbitrarily.
    for v_old in
      select hm.household_id
      from public.household_members hm
      where hm.user_id = auth.uid()
        and hm.household_id <> v_invite.household_id
    loop
      if public.household_is_empty(v_old) then
        delete from public.household_members
        where household_id = v_old and user_id = auth.uid();
        delete from public.households where id = v_old;
      end if;
    end loop;

    insert into public.household_members (household_id, user_id, display_name)
    values (v_invite.household_id, auth.uid(), split_part(coalesce(v_caller_email, ''), '@', 1))
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

create or replace function public.ourlife_schema_version()
returns int
language sql
immutable
set search_path = ''
as $$ select 9 $$;

grant execute on function public.ourlife_schema_version() to anon, authenticated;
