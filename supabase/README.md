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

Every table has **row-level security**: a member can only read or write rows for
a household they belong to. Uploaded statements go to a **private** `statements`
bucket, namespaced by `{household_id}/…`, with matching storage policies.

## Applying it

**Option A — Supabase MCP (from this assistant):**
apply `migrations/0001_init.sql` with the `apply_migration` tool against your
chosen project.

**Option B — Supabase CLI:**
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## After applying

1. Grab your Project URL and anon key from **Project Settings → API**.
2. Put them in `.env.local` (see `.env.example`).
3. Add the same values to your Vercel project's environment variables.
4. In **Authentication → URL Configuration**, add your Vercel domain and
   `http://localhost:3000` to the allowed redirect URLs.

## Real financial data

Your actual income, savings, and debt numbers belong in this database — never in
the git repo. A local, gitignored `supabase/seed.local.sql` is the place to seed
your real baseline once a household exists.
