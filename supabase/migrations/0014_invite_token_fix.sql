-- ===========================================================================
-- 0014 -- inviting a partner has been failing with
--   "function gen_random_bytes(integer) does not exist"
--
-- gen_random_bytes comes from pgcrypto, which Supabase installs into the
-- `extensions` schema. 0006 pinned this function's search_path to
-- `public, auth` — correctly, because an unpinned search_path on a
-- SECURITY DEFINER function is a privilege-escalation route — and that pin
-- put pgcrypto out of reach. Nothing else noticed because gen_random_uuid()
-- lives in pg_catalog and resolves no matter what the search_path says.
--
-- Adding `extensions` to the search_path would work, but it makes every
-- invite depend on where a Supabase convention happens to put an extension.
-- gen_random_uuid() is in pg_catalog, so it is always resolvable: two of them
-- with the dashes stripped give a 64-character hex token carrying ~244 bits
-- of entropy, more than the 192 the old call produced, from the same kind of
-- cryptographic source.
-- ===========================================================================
create or replace function public.create_partner_invite(
  p_household_id uuid,
  p_email text,
  p_phone text
)
-- Column names must stay exactly as they are: createInvite() in
-- src/lib/onboarding/data.ts destructures `matched` off the returned row, and
-- Postgres refuses to CREATE OR REPLACE a function whose OUT parameters have
-- changed, so a rename here is both a silent app break and a failed migration.
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

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

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

create or replace function public.ourlife_schema_version()
returns int language sql immutable set search_path = '' as $$ select 14 $$;
grant execute on function public.ourlife_schema_version() to anon, authenticated;
