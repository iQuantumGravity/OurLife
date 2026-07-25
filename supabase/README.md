# Supabase setup for OurLife

The `migrations/` folder is the source of truth for the database schema.

## What's in the schema

| Table | Purpose |
| --- | --- |
| `households` | One per couple/family. |
| `household_members` | Links `auth.users` to a household so you and Wednesday share one plan. |
| `household_baseline` | The plan's starting assumptions (jsonb), one row per household. |
| `pay_stubs` | Every real paycheck — folds into the income & savings model. |
| `documents` | Metadata for uploaded bank / credit-card statements (files live in Storage). |
| `plaid_items` | One row per linked bank login (Plaid access token). Server-only — no client-facing RLS policies. |
| `transactions` | Transactions synced from Plaid. Read-only for household members; written only by the service role. |
| `user_profiles` | Phone number + display name per user, so a partner can be found by phone. |
| `partner_invites` | Search-by-email/phone or link-based invites to collaborate on a household. |
| `onboarding_state` | Shared per-household onboarding settings (mode, comparison-viewed). |
| `onboarding_answers` | Per-person Life & Money track answers — one row per household + user, so couple mode can compare two people's answers. |

Every table has **row-level security**: a member can only read or write rows for
a household they belong to. Uploaded statements go to a **private** `statements`
bucket, namespaced by `{household_id}/…`, with matching storage policies.
`plaid_items` and `transactions` (added in `migrations/0003_plaid.sql`) hold live
bank-access tokens and the data synced with them; see the comments in that
migration for why `plaid_items` has no policies at all.
`migrations/0004_onboarding.sql` centralizes the sensitive parts of the invite
flow in `security definer` functions rather than spreading them across RLS
policies. Two details there are load-bearing and easy to undo by accident:

- **`respond_to_invite`'s identity check must be NULL-safe.** Written the
  obvious way — `if not (a or b or c) then raise` — it is an auth bypass: when
  the invitee has no account yet, `invitee_user_id` is NULL, so the expression
  is NULL, `not NULL` is NULL, and PL/pgSQL skips a NULL `IF`. The guard never
  fires and *any* holder of the link joins the household. Every branch is
  `coalesce(..., false)`-wrapped so it can only be true or false.
- **`find_user_by_contact` is not granted to clients.** An RPC that answers
  "does this email/phone have an account" is an enumeration oracle. Invites go
  through `create_partner_invite`, which resolves the contact internally and
  returns only a boolean.

`migrations/0005_harden_membership.sql` closes a hole inherited from `0001`,
whose `household_members` insert policy allowed `user_id = auth.uid()` with no
constraint on `household_id` — meaning anyone who learned a household's uuid
(they appear in client components and in every statements-bucket path) could
add themselves to it and could never be removed, since there was no delete
policy. It also adds `ourlife_schema_version()` so `/setup` can detect
policy-only migrations that leave no table behind.

## Applying it

**Option A — Supabase MCP (from this assistant):**
apply every file in `migrations/` in numeric order (`0001_init.sql` through
`0006_lint_fixes.sql`) with the `apply_migration` tool against your chosen
project. `0004` onward are re-runnable; `0001`–`0003` are not (they use bare
`create policy`, which has no `IF NOT EXISTS` in Postgres).

**Option B — Supabase CLI:**
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## After applying

1. Grab your Project URL, anon key, and **service_role key** from
   **Project Settings → API**.
2. Put them in `.env.local` (see `.env.example`) — the service_role key is
   only needed if you're using the Plaid integration.
3. Add the same values to your Vercel project's environment variables.
4. In **Authentication → URL Configuration**, add your Vercel domain and
   `http://localhost:3000` to the allowed redirect URLs.

## Connect a bank (Plaid)

Optional. Create a Plaid app at [dashboard.plaid.com](https://dashboard.plaid.com/),
grab the Client ID + Secret for the environment you want (start with
`sandbox`), and add `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` plus
`SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (and Vercel, for production).
Once set, an **Accounts** page appears with a "Connect a bank account" button
that opens Plaid Link — supports SoFi and most US banks — and syncs
transactions in.

## Onboarding & inviting a partner

The **Onboarding** page walks through a Life track (relationship, kids,
goals, location, vision) and a Money track (income type, debt, savings,
risk tolerance, then a bank-connect and document-upload prompt). Every step
is skippable and saved as you go — closing the tab and coming back resumes
exactly where you left off. In couple mode, each partner answers Life
independently; once both are done, a comparison screen shows where you
line up before Money unlocks.

To add a partner: from the Onboarding page, search for them by email or
phone. If they already have an account, they'll see the invite next time
they sign in. If not, you'll get a link (`/invite/<token>`) to send them —
it walks them through creating an account and then accepting or declining.
A phone number can be added on the **Account** page after signing up, so
you can be found by phone as well as email.

## Real financial data

Your actual income, savings, and debt numbers belong in this database — never in
the git repo. A local, gitignored `supabase/seed.local.sql` is the place to seed
your real baseline once a household exists.
