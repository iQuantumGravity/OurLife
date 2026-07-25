import { isSupabaseConfigured } from "@/lib/config";
import { isPlaidConfigured } from "@/lib/config";
import { hasClaudeKey } from "@/lib/ai/anthropic";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "missing" | "unknown";

interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
  fix: string;
}

// Tries a cheap, RLS-safe query against a table to tell "migration not
// applied" (Postgres error 42P01, undefined_table) apart from "applied, but
// no rows visible to an anonymous request" (which is the expected, healthy
// case pre-sign-in).
async function tableExists(table: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const supabase = createClient();
    const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(0);
    if (!error) return true;
    return error.code !== "42P01";
  } catch {
    return false;
  }
}

export default async function SetupPage() {
  const supabaseOk = isSupabaseConfigured;
  const plaidOk = isPlaidConfigured;
  const claudeOk = hasClaudeKey();
  const serviceRoleOk = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [baselineTable, livingLayerTable, plaidTable, onboardingTable] =
    await Promise.all([
      tableExists("household_baseline"),
      tableExists("chat_threads"),
      tableExists("plaid_items"),
      tableExists("onboarding_state"),
    ]);

  const checks: Check[] = [
    {
      label: "Supabase connected",
      status: supabaseOk ? "ok" : "missing",
      detail: supabaseOk
        ? "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
        : "Env vars are not set — the app is running on sample data.",
      fix: "Project Settings → API in Supabase, then add NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (and Vercel for production).",
    },
    {
      label: "Core schema (0001_init.sql)",
      status: !supabaseOk ? "unknown" : baselineTable ? "ok" : "missing",
      detail: baselineTable
        ? "households, pay_stubs, documents, and related tables exist."
        : "Base tables aren't there yet.",
      fix: "Apply supabase/migrations/0001_init.sql via the Supabase SQL editor, the Supabase MCP apply_migration tool, or `supabase db push`.",
    },
    {
      label: "Living layer (0002_living_layer.sql)",
      status: !supabaseOk ? "unknown" : livingLayerTable ? "ok" : "missing",
      detail: livingLayerTable
        ? "Assistant chat, document parsing, and the plan journal are wired up."
        : "The assistant's tables aren't there yet.",
      fix: "Apply supabase/migrations/0002_living_layer.sql the same way as above, after 0001.",
    },
    {
      label: "Plaid schema (0003_plaid.sql)",
      status: !supabaseOk ? "unknown" : plaidTable ? "ok" : "missing",
      detail: plaidTable
        ? "plaid_items and transactions exist."
        : "Bank-connection tables aren't there yet.",
      fix: "Apply supabase/migrations/0003_plaid.sql, after 0001 and 0002.",
    },
    {
      label: "Onboarding schema (0004_onboarding.sql)",
      status: !supabaseOk ? "unknown" : onboardingTable ? "ok" : "missing",
      detail: onboardingTable
        ? "Onboarding answers and partner invites are wired up."
        : "The onboarding wizard's tables aren't there yet.",
      fix: "Apply supabase/migrations/0004_onboarding.sql last.",
    },
    {
      label: "Service-role key",
      status: serviceRoleOk ? "ok" : "missing",
      detail: serviceRoleOk
        ? "SUPABASE_SERVICE_ROLE_KEY is set — needed for Plaid token storage."
        : "Not set. Bank connections won't work without it.",
      fix: "Project Settings → API → service_role in Supabase, then add SUPABASE_SERVICE_ROLE_KEY (server-only — never NEXT_PUBLIC_) to .env.local / Vercel.",
    },
    {
      label: "Plaid keys",
      status: plaidOk ? "ok" : "missing",
      detail: plaidOk
        ? "PLAID_CLIENT_ID and PLAID_SECRET are set."
        : "Not set — the Accounts page will hide bank-connect until it is.",
      fix: "Create an app at dashboard.plaid.com/team/keys, then add PLAID_CLIENT_ID / PLAID_SECRET / PLAID_ENV (start with sandbox).",
    },
    {
      label: "Claude (assistant + parsing)",
      status: claudeOk ? "ok" : "missing",
      detail: claudeOk
        ? "ANTHROPIC_API_KEY is set."
        : "Not set — the Assistant page will explain it isn't connected.",
      fix: "Create a key in the Anthropic Console → API keys, then add ANTHROPIC_API_KEY.",
    },
  ];

  const remaining = checks.filter((c) => c.status !== "ok").length;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Setup guide
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Get OurLife fully connected
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          This page checks your live environment each time you load it — safe
          to bookmark and re-check from your phone as you add keys in Vercel
          or Supabase.{" "}
          {remaining === 0
            ? "Everything below is connected."
            : `${remaining} thing${remaining === 1 ? "" : "s"} left.`}
        </p>
      </section>

      <ol className="flex flex-col gap-3">
        {checks.map((c, i) => (
          <li
            key={c.label}
            className="rounded-card border border-line bg-raised p-4"
          >
            <div className="flex items-start gap-3">
              <span
                className={
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] " +
                  (c.status === "ok"
                    ? "bg-teal/20 text-teal"
                    : c.status === "missing"
                      ? "bg-clay/20 text-clay"
                      : "bg-line text-muted")
                }
                aria-hidden
              >
                {c.status === "ok" ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-fg">{c.label}</h2>
                  <span
                    className={
                      "font-mono text-[10px] uppercase tracking-wider " +
                      (c.status === "ok"
                        ? "text-teal"
                        : c.status === "missing"
                          ? "text-clay"
                          : "text-muted")
                    }
                  >
                    {c.status === "ok"
                      ? "Connected"
                      : c.status === "missing"
                        ? "Not yet"
                        : "Depends on Supabase"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{c.detail}</p>
                {c.status !== "ok" && (
                  <p className="mt-2 text-sm text-fg">{c.fix}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="rounded-card border border-line bg-sunken p-4 text-sm text-muted">
        Once everything above is green, head to{" "}
        <a href="/onboarding" className="text-teal hover:underline">
          Onboarding
        </a>{" "}
        to set up your household's plan, invite a partner, connect a bank
        account, and upload a first statement.
      </section>
    </div>
  );
}
