-- ===========================================================================
-- OurLife -- 0006: database-linter cleanup
--
-- Pins search_path on the two functions that were missing it. A mutable
-- search_path lets a caller who can create objects shadow an unqualified name
-- the function body resolves, so Supabase's linter flags it. Both functions
-- below reference only pg_catalog builtins, so an empty search_path is safe.
--
-- DELIBERATELY NOT CHANGED (the linter flags these; each is intentional):
--
--   * public.plaid_items has RLS enabled with no policies. That is the design:
--     it stores live Plaid access tokens, and only the service role -- which
--     bypasses RLS -- may read it, from /api/plaid/* route handlers.
--
--   * public.get_invite_preview is executable by `anon`. That is the point of
--     an invite link: someone with no account yet has to be able to see who is
--     inviting them before they sign up. It only ever answers for a live,
--     pending, unexpired invite and returns no financial data.
--
--   * public.create_partner_invite / respond_to_invite are executable by
--     `authenticated`. Both enforce their own authorization internally
--     (household membership, and a NULL-safe identity match respectively).
--
--   * public.user_household_ids keeps its `anon` EXECUTE grant. Every RLS
--     policy in this schema calls it, and RLS is evaluated for signed-out
--     requests too -- revoking it would make those requests fail with
--     "permission denied for function" instead of correctly returning no rows.
--     Called as anon it returns an empty set, because auth.uid() is null.
-- ===========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ourlife_schema_version()
returns int
language sql
immutable
set search_path = ''
as $$ select 6 $$;

grant execute on function public.ourlife_schema_version() to anon, authenticated;
