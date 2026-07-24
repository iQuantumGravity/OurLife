// ===========================================================================
// The engine that folds real pay stubs into the plan.
// Pure functions — no I/O — so they're easy to test and reuse on client & server.
// ===========================================================================

import type {
  Baseline,
  EarnerTotals,
  MonthlyActual,
  PayStub,
} from "./types";

const monthKey = (isoDate: string) => isoDate.slice(0, 7); // "YYYY-MM"

/** Sum each month's actual take-home from the pay stubs. */
export function stubsByMonth(stubs: PayStub[]): MonthlyActual[] {
  const map = new Map<string, MonthlyActual>();
  for (const s of stubs) {
    const month = monthKey(s.pay_date);
    const cur =
      map.get(month) ?? { month, net: 0, gross: 0, count: 0 };
    cur.net += Number(s.net_amount) || 0;
    cur.gross += Number(s.gross_amount) || 0;
    cur.count += 1;
    map.set(month, cur);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Total across every stub. */
export function totalNet(stubs: PayStub[]): number {
  return stubs.reduce((sum, s) => sum + (Number(s.net_amount) || 0), 0);
}

/** Roll up gross/net by earner (e.g. "Daniel" vs "Wednesday"). */
export function byEarner(stubs: PayStub[]): EarnerTotals[] {
  const map = new Map<string, EarnerTotals>();
  for (const s of stubs) {
    const cur =
      map.get(s.earner) ?? { earner: s.earner, gross: 0, net: 0, count: 0 };
    cur.gross += Number(s.gross_amount) || 0;
    cur.net += Number(s.net_amount) || 0;
    cur.count += 1;
    map.set(s.earner, cur);
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

export interface MonthComparison {
  month: string;
  actualNet: number;
  planNet: number;
  variance: number;
  onTrack: boolean;
}

/**
 * Compare each month that has real stubs against the plan's expected take-home.
 * `planNet` uses the baseline's current monthly take-home as the reference line
 * — the simplest honest benchmark until per-month projections are wired up.
 */
export function actualVsPlan(
  baseline: Baseline,
  stubs: PayStub[],
): MonthComparison[] {
  const planNet = baseline.monthlyTakeHome;
  return stubsByMonth(stubs).map((m) => {
    const variance = m.net - planNet;
    return {
      month: m.month,
      actualNet: m.net,
      planNet,
      variance,
      // within 5% counts as on track
      onTrack: variance >= -0.05 * planNet,
    };
  });
}

/**
 * The live savings balance: start from the seed and add each month's ACTUAL
 * net minus the plan's expected spend for that month. Months without stubs are
 * skipped, so this is a "how are we tracking so far" line, not the full forecast.
 */
export function actualBalanceSeries(
  baseline: Baseline,
  stubs: PayStub[],
): { month: string; balance: number }[] {
  const months = stubsByMonth(stubs);
  const expectedSpend =
    baseline.monthlyTakeHome - (baseline.phases[0]?.monthlySave ?? 0);
  let balance = baseline.startingSavings;
  const out: { month: string; balance: number }[] = [];
  for (const m of months) {
    balance += m.net - expectedSpend;
    out.push({ month: m.month, balance: Math.round(balance) });
  }
  return out;
}

/** How much has actually been banked vs. the plan target, over the stub window. */
export function savingsProgress(
  baseline: Baseline,
  stubs: PayStub[],
): { monthsLogged: number; actualSaved: number; targetSaved: number } {
  const months = stubsByMonth(stubs);
  const expectedSpend =
    baseline.monthlyTakeHome - (baseline.phases[0]?.monthlySave ?? 0);
  const actualSaved = months.reduce((s, m) => s + (m.net - expectedSpend), 0);
  const targetSaved =
    months.length * (baseline.phases[0]?.monthlySave ?? 0);
  return {
    monthsLogged: months.length,
    actualSaved: Math.round(actualSaved),
    targetSaved: Math.round(targetSaved),
  };
}
