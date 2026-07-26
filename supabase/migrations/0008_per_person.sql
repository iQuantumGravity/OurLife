-- ===========================================================================
-- OurLife -- 0008: per-person attribution inside a household
--
-- Two people share one plan, but each brings their own paychecks, statements
-- and bank accounts. The model is "shared, attributed, filterable": both
-- partners see everything and totals always combine, but every record knows
-- whose it is so the UI can filter to one person.
--
-- pay_stubs already carried member_user_id and documents carried uploaded_by.
-- What was missing:
--   * plaid_items had no owner at all, so a linked bank belonged to nobody
--   * transactions inherited that namelessness
--
-- Both get an owner column, backfilled where it can be inferred.
-- ===========================================================================

-- --- bank connections: whose login is this? --------------------------------
alter table public.plaid_items
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null;

comment on column public.plaid_items.owner_user_id is
  'The household member who linked this bank. Null for connections made before 0008.';

-- --- transactions: denormalised owner, so filtering never needs a join ------
alter table public.transactions
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null;

create index if not exists transactions_owner_idx
  on public.transactions (household_id, owner_user_id, date desc);

-- Backfill from the parent item where one is known.
update public.transactions t
set owner_user_id = i.owner_user_id
from public.plaid_items i
where t.plaid_item_id = i.id
  and t.owner_user_id is null
  and i.owner_user_id is not null;

-- --- pay stubs: make the existing column useful ----------------------------
-- member_user_id was nullable and never set from the UI. Backfill it from
-- created_by so historical rows are attributable, and index it for filtering.
update public.pay_stubs
set member_user_id = created_by
where member_user_id is null and created_by is not null;

create index if not exists pay_stubs_member_idx
  on public.pay_stubs (household_id, member_user_id, pay_date desc);

-- --- documents: index the existing uploader column --------------------------
create index if not exists documents_uploader_idx
  on public.documents (household_id, uploaded_by, created_at desc);

-- ===========================================================================
-- household_people -- one row per member, with the display name the plan
-- should use for them. household_members already links users to households;
-- this view saves every caller from re-deriving "what do I call this person".
-- ===========================================================================
create or replace view public.household_people
with (security_invoker = true)
as
  select
    hm.household_id,
    hm.user_id,
    coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(hm.display_name), ''),
      split_part(coalesce(u.email, ''), '@', 1),
      'Member'
    ) as name,
    hm.role,
    hm.created_at
  from public.household_members hm
  left join public.user_profiles p on p.user_id = hm.user_id
  left join auth.users u on u.id = hm.user_id;

grant select on public.household_people to authenticated;

create or replace function public.ourlife_schema_version()
returns int
language sql
immutable
set search_path = ''
as $$ select 8 $$;

grant execute on function public.ourlife_schema_version() to anon, authenticated;
