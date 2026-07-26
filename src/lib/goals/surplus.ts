import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPayStubs } from "@/lib/data";
import { stubsByMonth } from "@/lib/model/engine";

// ===========================================================================
// The monthly surplus — the single number every projection hangs off.
//
// Income comes from logged pay stubs. Spending comes from whatever the
// household actually has: synced Plaid transactions if a bank is linked,
// otherwise line items parsed out of uploaded statements. Both feed the same
// figure, so linking a bank makes the feedback faster, not different in kind.
// ===========================================================================

export type SpendingSource = "plaid" | "documents" | "none";

export interface SurplusView {
  /** Mean monthly take-home across months with logged income. */
  monthlyIncome: number | null;
  /** Mean monthly outgoings across months with observed spending. */
  monthlySpend: number | null;
  /** income - spend. Null when we can't honestly compute either side. */
  monthlySurplus: number | null;
  source: SpendingSource;
  monthsOfIncome: number;
  monthsOfSpending: number;
  /** Spending in the last 30 days, for the "recent activity" readout. */
  last30Spend: number;
  /** Individual outgoings over the last 30 days, newest first. */
  recent: RecentSpend[];
}

export interface RecentSpend {
  id: string;
  date: string;
  name: string;
  amount: number;
  category: string | null;
  source: SpendingSource;
}

function monthKey(d: string): string {
  return d.slice(0, 7);
}

/**
 * Both sides of the surplus are measured over this same window. Averaging
 * all-time income against four months of spending compares two different
 * households: someone who logged a few stubs from a job they left last year
 * would show that old salary minus today's spending, and the UI would label
 * the result "from linked banks".
 */
const WINDOW_DAYS = 120;

/**
 * Enough to cover a heavy spender's four months. The cap still has to be
 * detected rather than trusted — see below.
 */
const ROW_CAP = 2000;

export async function getSurplus(householdId: string): Promise<SurplusView> {
  const supabase = createClient();

  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const sinceIso = since.toISOString().slice(0, 10);

  const [allStubs, txRes, itemRes] = await Promise.all([
    getPayStubs(householdId),
    supabase
      .from("transactions")
      .select("id, name, merchant_name, amount, date, category, pending")
      .eq("household_id", householdId)
      .gte("date", sinceIso)
      .order("date", { ascending: false })
      .limit(ROW_CAP),
    supabase
      .from("document_line_items")
      .select("id, description, merchant, amount, txn_date, category, direction")
      .eq("household_id", householdId)
      .gte("txn_date", sinceIso)
      .order("txn_date", { ascending: false })
      .limit(ROW_CAP),
  ]);

  // getPayStubs has no date filter, so the window is applied here.
  const stubs = allStubs.filter((s) => s.pay_date && s.pay_date >= sinceIso);

  const incomeMonths = stubsByMonth(stubs);
  const monthlyIncome =
    incomeMonths.length > 0
      ? Math.round(
          incomeMonths.reduce((s, m) => s + m.net, 0) / incomeMonths.length,
        )
      : null;

  // Plaid is authoritative when present: it's continuous, where documents are
  // whatever happened to be uploaded.
  const txs = (txRes.data ?? []) as any[];
  const items = (itemRes.data ?? []) as any[];

  let source: SpendingSource = "none";
  let rows: RecentSpend[] = [];
  // Rows come back newest-first, so hitting the cap means the OLDEST month in
  // the result is cut off partway through. Averaging it in understates spend
  // and inflates the surplus, which makes every goal look closer than it is.
  let capped = false;

  if (txs.length > 0) {
    capped = txs.length >= ROW_CAP;
    source = "plaid";
    rows = txs
      // Plaid signs outgoings positive; money in is negative.
      .filter((t) => Number(t.amount) > 0)
      .map((t) => ({
        id: t.id,
        date: t.date,
        name: t.merchant_name || t.name || "Purchase",
        amount: Number(t.amount),
        category: t.category ?? null,
        source: "plaid" as const,
      }));
  } else if (items.length > 0) {
    source = "documents";
    capped = items.length >= ROW_CAP;
    rows = items
      .filter((i) => (i.direction ?? "debit") === "debit")
      .map((i) => ({
        id: i.id,
        date: i.txn_date,
        name: i.merchant || i.description || "Purchase",
        amount: Math.abs(Number(i.amount ?? 0)),
        category: i.category ?? null,
        source: "documents" as const,
      }));
  }

  const spendByMonth = new Map<string, number>();
  for (const r of rows) {
    if (!r.date) continue;
    const k = monthKey(r.date);
    spendByMonth.set(k, (spendByMonth.get(k) ?? 0) + r.amount);
  }
  // The current month is partial, so averaging it in understates spend.
  const nowKey = new Date().toISOString().slice(0, 7);
  // So is the oldest month when the row cap truncated the result.
  const oldestKey =
    capped && spendByMonth.size > 0
      ? [...spendByMonth.keys()].sort()[0]
      : null;

  const completeMonths = [...spendByMonth.entries()].filter(
    ([k]) => k !== nowKey && k !== oldestKey,
  );

  const monthlySpend =
    completeMonths.length > 0
      ? Math.round(
          completeMonths.reduce((s, [, v]) => s + v, 0) / completeMonths.length,
        )
      : null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const last30Spend = Math.round(
    rows.filter((r) => r.date >= cutoffIso).reduce((s, r) => s + r.amount, 0),
  );

  return {
    monthlyIncome,
    monthlySpend,
    monthlySurplus:
      monthlyIncome !== null && monthlySpend !== null
        ? monthlyIncome - monthlySpend
        : null,
    source,
    monthsOfIncome: incomeMonths.length,
    monthsOfSpending: completeMonths.length,
    last30Spend,
    recent: rows.slice(0, 12),
  };
}
