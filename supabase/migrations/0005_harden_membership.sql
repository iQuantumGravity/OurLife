-- ===========================================================================
-- OurLife -- 0005: harden household membership
--
-- 0001 shipped an INSERT policy on household_members whose first branch was
-- `user_id = auth.uid()` with NO constraint on household_id. That was intended
-- to let a brand-new user bootstrap their own household, but as written it let
-- ANY authenticated user insert themselves into ANY household given only that
-- household's uuid -- bypassing partner_invites entirely.
--
-- Household uuids are not secret in practice: they are embedded in client
-- components (the uploader) and are the first path segment of every object in
-- the private `statements` bucket, so they leak through any shared signed URL.
--
-- This migration:
--   1. Narrows the self-insert branch to the genuine bootstrap case -- you may
--      only add yourself to a household you created. Every other path must go
--      through respond_to_invite(), which is SECURITY DEFINER and therefore
--      unaffected by this policy.
--   2. Adds a DELETE policy. There was none, so an unwanted member could never
--      be removed through the app once they were in.
--   3. Narrows UPDATE to your own membership row, so one member cannot rewrite
--      another member's role or display name.
-- ===========================================================================

-- --- 1. INSERT: bootstrap your own household, or add someone to yours -------
drop policy if exists "add self or co-member" on public.household_members;
drop policy if exists "bootstrap own household or add co-member" on public.household_members;

create policy "bootstrap own household or add co-member"
  on public.household_members for insert
  with check (
    -- Already a member of this household: may add a co-member.
    household_id in (select public.user_household_ids())
    -- Or: bootstrapping -- adding yourself to a household you just created.
    or (
      user_id = auth.uid()
      and exists (
        select 1
        from public.households h
        where h.id = household_id
          and h.created_by = auth.uid()
      )
    )
  );

-- --- 2. DELETE: members can leave, and can remove a co-member ---------------
drop policy if exists "members can remove membership rows" on public.household_members;

create policy "members can remove membership rows"
  on public.household_members for delete
  using (household_id in (select public.user_household_ids()));

-- --- 3. UPDATE: only your own row ------------------------------------------
drop policy if exists "members can update membership rows" on public.household_members;
drop policy if exists "members can update their own membership row" on public.household_members;

create policy "members can update their own membership row"
  on public.household_members for update
  using (user_id = auth.uid() and household_id in (select public.user_household_ids()))
  with check (user_id = auth.uid() and household_id in (select public.user_household_ids()));

-- --- 4. Schema version marker ----------------------------------------------
-- Policy changes leave no table or column behind, so the /setup page has no way
-- to tell whether this migration landed. This marker gives it (and every future
-- migration) something to read. Bump the returned number in each new migration.
create or replace function public.ourlife_schema_version()
returns int
language sql
immutable
as $$ select 5 $$;

grant execute on function public.ourlife_schema_version() to anon, authenticated;
