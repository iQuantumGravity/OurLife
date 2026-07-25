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
2. Apply the schema in [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
   (via the Supabase MCP `apply_migration` tool or `supabase db push`).
3. Copy your Project URL + anon key from **Project Settings → API** into
   `.env.local`.
4. In **Authentication → URL Configuration**, add `http://localhost:3000` and
   your Vercel domain to the redirect allow-list.

See [`supabase/README.md`](./supabase/README.md) for schema details.

## Deploy to Vercel

1. Import this repo in Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `NEXT_PUBLIC_SITE_URL` (your production URL) as environment variables.
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
## The assistant (Claude)

`/assistant` is the living part of the tool. You type what happened or what you want to explore, and Claude works on the plan itself rather than just talking about it:

- **Reads the plan** — baseline assumptions, milestones, logged pay stubs, uploaded documents, saved scenarios and the change journal.
- **Edits the plan** — merges baseline changes, adds/updates milestones, logs paychecks, saves what-if scenarios.
- **Reads documents** — pulls an uploaded pay stub / statement (PDF, image, CSV) out of the private bucket, extracts the transactions and balances, and writes them into `document_line_items`, plus a `pay_stubs` row when it is a stub.
- **Keeps a journal** — every change lands in `plan_events` with a before/after snapshot and who asked for it, so nothing changes silently.

Nothing is hard-deleted: dropped milestones keep a `dropped` status, scenarios are deactivated rather than removed, and documents keep their parse history.

### Connect Claude

1. Create an API key in the [Anthropic Console](https://console.anthropic.com/) → API keys.
2. Add `ANTHROPIC_API_KEY` as an environment variable (Vercel → Settings → Environment Variables, or `.env.local` locally). It is server-side only and never shipped to the browser.
3. Optionally set `ANTHROPIC_MODEL` to pin a model — left blank, the app asks the API for the newest Sonnet the key can see.
4. Redeploy. Without the key the app still runs; the assistant page just explains that it is not connected.

Note: this uses the Anthropic **API** (metered, billed per token). A Claude.ai subscription is a separate product and cannot be used as an app backend.

### API surface

- `POST /api/assistant` — `{ message, threadId? }` → runs the tool loop, persists the exchange, returns `{ reply, threadId, actions }`.
- `POST /api/documents/[id]/parse` — extracts one uploaded document into the model.

Both run as the signed-in user, so row-level security is what keeps a household's numbers private. There is no service-role key anywhere in this app.

## Schema

- `0001_init.sql` — households, members, baseline, pay stubs, document metadata, private storage bucket.
- `0002_living_layer.sql` — document parsing state, `document_line_items`, `chat_threads` / `chat_messages`, `plan_events` (the journal), `scenarios`.
## Google sign-in

The login page shows a "Continue with Google" button beside the email/password form.
Supabase owns the OAuth handshake; the repo only holds the button.

1. Google Cloud console (project `ourlife-503422`) -> **APIs & Services -> OAuth consent
   screen**. User type **External**; add your own address as a test user while the app is
   unverified.
2. **APIs & Services -> Credentials -> Create credentials -> OAuth client ID**, application
   type **Web application**:
   - Authorised JavaScript origin: `https://our-life-gules.vercel.app`
   - Authorised redirect URI: `https://qwyrurrkmhwdcrgssrpf.supabase.co/auth/v1/callback`
3. Supabase -> **Authentication -> Sign In / Providers -> Google**: enable it, paste the
   Client ID and Client Secret, Save.
4. Google returns to Supabase, Supabase returns to `/auth/callback`, and that route
   exchanges the one-time code for a session cookie before forwarding to `/dashboard`.

Add `http://localhost:3000` as a second authorised origin if you want Google sign-in to
work while developing locally.

Google Cloud enforces 2-step verification account-wide, so the console stays locked until
2SV is enabled on the Google account that owns the project.
