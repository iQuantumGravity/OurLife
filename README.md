# OurLife

A living, interactive life & financial plan for two — the app version of the
ten-year plan we mapped out. Log real pay stubs and upload bank / credit-card
statements, and watch them fold into the income trajectory, the savings
"elevation" curve, and the milestone plan.

Built with **Next.js (App Router)**, **Supabase** (auth · Postgres · Storage),
and **Tailwind**, deployable on **Vercel**.

## What's here (the baseline)

- **Auth** — email/password logins via Supabase, so you and Wednesday each sign in.
- **Households** — you share one plan; row-level security keeps your data private.
- **Dashboard** — the plan: snapshot tiles, the savings elevation chart, the
  five save/spend phases, and every milestone with its cost and date.
- **Pay-stub console** — add each paycheck; it updates your real take-home and
  how you're tracking vs. the plan.
- **Statement uploads** — bank / credit-card statements to a private,
  per-household storage bucket, with signed-link viewing.
- **Bank connections (Plaid)** — link a bank (SoFi and most US institutions)
  and sync transactions in automatically, instead of uploading statements by
  hand. Optional — hidden until Plaid keys are set.

Your real numbers never live in this repo — they live in your private Supabase
database. The committed baseline is a clearly-labeled sample template.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm run dev                  # http://localhost:3000
```

Without Supabase keys the app still runs — it shows the sample plan and a
"connect the backend" banner.

## Connect Supabase

1. Create a Supabase project (or reuse one).
2. Apply the schema in [`supabase/migrations/`](./supabase/migrations/) —
   `0001_init.sql` then `0002_plaid.sql` — via the Supabase MCP
   `apply_migration` tool or `supabase db push`.
3. Copy your Project URL + anon key (and, for Plaid, the service_role key)
   from **Project Settings → API** into `.env.local`.
4. In **Authentication → URL Configuration**, add `http://localhost:3000` and
   your Vercel domain to the redirect allow-list.

See [`supabase/README.md`](./supabase/README.md) for schema details, and the
same file for the optional Plaid setup steps.

## Deploy to Vercel

1. Import this repo in Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `NEXT_PUBLIC_SITE_URL` (your production URL) as environment variables —
   plus `SUPABASE_SERVICE_ROLE_KEY`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, and
   `PLAID_ENV` if you're using bank connections.
3. Deploy. Add the production domain to Supabase's auth redirect allow-list.

## Roadmap (next builds)

- Automated parsing of uploaded PDF statements (balances, transactions) into the model.
- Per-month projections so pay stubs re-forecast the full curve, not just the near term.
- Editable baseline & assumptions in the UI (income, VP band, goals, home price).
- Invite flow to add your partner to the household.
- The full branching timeline (Steady Growth vs. Dream Payout) and the
  investment waterfall from the original plan.

## Security notes

- Every table is protected by row-level security scoped to household membership.
- Uploaded files sit in a **private** bucket, namespaced by household id.
- Consider making this repository **private** in GitHub settings — even though no
  secrets or personal figures are committed, it's a personal finance tool.

### Known follow-up before going live: upgrade Next.js

This baseline pins **Next 14.2.35** (the latest 14.2.x — the critical
Server-Actions DoS advisory is patched). `npm audit` still lists several *high*
advisories whose fixes only land in the Next **15/16** line (image-optimizer
DoS, SSRF in rewrites/custom servers, cache poisoning). Most don't apply to how
this app is built today — it uses no `next/image` remote patterns, no custom
server, and no i18n/rewrites — but **upgrading to the latest Next major is the
#1 task before this holds real financial data in production.** That upgrade
touches the async `cookies()` API in `src/lib/supabase/*`, so it's a deliberate
change, not a drive-by bump.
