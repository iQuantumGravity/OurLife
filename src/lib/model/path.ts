import "server-only";
import type { PlanView } from "@/lib/plan";
import type { GoalProgress } from "@/lib/goals/types";

// ===========================================================================
// The life path: the plan expressed as an ordered sequence of stages, each
// with real progress derived from what's actually been logged.
//
// Progress is never invented. A stage with no cost and no date has no
// meaningful percentage, and says so, rather than showing a confident 0%.
// ===========================================================================

export type StageKind = "phase" | "milestone";

export interface PathStage {
  id: string;
  kind: StageKind;
  name: string;
  detail: string | null;
  /** "YYYY-MM" when known. Drives ordering and the "now" marker. */
  month: string | null;
  /** What this stage costs or targets, when known. */
  target: number | null;
  /** Money actually attributable to it so far, when computable. */
  saved: number | null;
  /** 0..1, or null when there's nothing honest to compute from. */
  progress: number | null;
  status: "done" | "current" | "upcoming" | "undated";
}

export interface LifePath {
  stages: PathStage[];
  /** "YYYY-MM" */
  nowMonth: string;
  /** Overall completion across stages that have a computable progress. */
  overall: number | null;
  totalTarget: number;
  totalSaved: number;
}

function monthOf(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/**
 * How many stages there are, and how many are behind you.
 *
 * "Passed" only means anything for a stage with a date, so `dated` — not the
 * raw stage count — is the honest denominator. Both the headline tile and the
 * map read this, because two components counting the same thing differently
 * is how a page ends up claiming "5 stages" above "0 of 4 stages passed".
 */
export interface StageCounts {
  total: number;
  dated: number;
  done: number;
  undated: number;
}

export function stageCounts(path: LifePath): StageCounts {
  const dated = path.stages.filter((s) => s.status !== "undated");
  return {
    total: path.stages.length,
    dated: dated.length,
    done: dated.filter((s) => s.status === "done").length,
    undated: path.stages.length - dated.length,
  };
}

/** Months between two "YYYY-MM" strings; negative when b precedes a. */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

/**
 * Stages from real goals. Preferred over the onboarding-answer path: these
 * carry their own allocated money and projected dates, so the road shows what
 * is actually funded rather than what was once typed into a form.
 */
export function buildLifePathFromGoals(
  goals: GoalProgress[],
  now = new Date(),
): LifePath {
  const nowMonth = monthOf(now);
  const active = goals.filter((g) => g.status !== "dropped");

  const stages: PathStage[] = active.map((g) => {
    const month = g.targetDate ? g.targetDate.slice(0, 7) : null;
    const elapsed = month ? monthsBetween(nowMonth, month) : null;

    let status: PathStage["status"];
    if (g.status === "achieved") status = "done";
    else if (!month) status = "undated";
    else if (elapsed !== null && elapsed < 0) status = "done";
    else if (elapsed !== null && elapsed <= 3) status = "current";
    else status = "upcoming";

    return {
      id: g.id,
      kind: "milestone",
      name: g.name,
      detail:
        g.slipMonths !== null && g.slipMonths > 0
          ? `${g.slipMonths} month${g.slipMonths === 1 ? "" : "s"} behind`
          : (g.note ?? null),
      month,
      target: g.targetAmount,
      saved: g.targetAmount !== null ? Math.min(g.savedAmount, g.targetAmount) : null,
      progress: g.progress,
      status,
    };
  });

  stages.sort((a, b) => {
    if (a.month && b.month) return a.month.localeCompare(b.month);
    if (a.month) return -1;
    if (b.month) return 1;
    return 0;
  });

  const totalTarget = stages.reduce((s, x) => s + (x.target ?? 0), 0);
  const totalAllocated = stages.reduce((s, x) => s + (x.saved ?? 0), 0);

  return {
    stages,
    nowMonth,
    overall: totalTarget > 0 ? totalAllocated / totalTarget : null,
    totalTarget,
    totalSaved: totalAllocated,
  };
}

export function buildLifePath(plan: PlanView, now = new Date()): LifePath {
  const nowMonth = monthOf(now);
  const stages: PathStage[] = [];

  // Phases first — these only exist when a real plan has been authored.
  for (const p of plan.phases) {
    stages.push({
      id: `phase-${p.id}`,
      kind: "phase",
      name: p.name,
      detail: p.focus ?? null,
      month: null,
      target: typeof p.endBalance === "number" ? p.endBalance : null,
      saved: null,
      progress: null,
      status: "undated",
    });
  }

  // Milestones carry dates and costs, so they can show real progress.
  //
  // Savings are allocated as a WATERFALL, soonest goal first, rather than
  // measuring every goal against the full balance independently. The naive
  // version claims $24k "100% funds" both a $6k debt and a $9k trip — the same
  // dollars counted twice. Money can only be spent once, so it fills the
  // nearest goal, then what's left flows to the next.
  const liquid = plan.startingSavings ?? 0;
  let remaining = liquid;

  // Order the allocation by date (soonest first), undated goals last.
  const ordered = [...plan.goals].sort((a, b) => {
    if (a.targetMonth && b.targetMonth)
      return a.targetMonth.localeCompare(b.targetMonth);
    if (a.targetMonth) return -1;
    if (b.targetMonth) return 1;
    return 0;
  });

  for (const g of ordered) {
    const target = g.cost;
    const elapsed = g.targetMonth ? monthsBetween(nowMonth, g.targetMonth) : null;

    let status: PathStage["status"];
    if (!g.targetMonth) status = "undated";
    else if (elapsed !== null && elapsed < 0) status = "done";
    else if (elapsed !== null && elapsed <= 3) status = "current";
    else status = "upcoming";

    let saved: number | null = null;
    let progress: number | null = null;
    if (target && target > 0) {
      saved = Math.min(remaining, target);
      remaining -= saved;
      progress = Math.max(0, Math.min(1, saved / target));
    }

    stages.push({
      id: g.id,
      kind: "milestone",
      name: g.name,
      detail: g.fundedFrom,
      month: g.targetMonth,
      target,
      saved,
      progress,
      status,
    });
  }

  // Dated stages in chronological order; undated ones trail behind rather
  // than being dropped — an undated goal is still a goal.
  stages.sort((a, b) => {
    if (a.month && b.month) return a.month.localeCompare(b.month);
    if (a.month) return -1;
    if (b.month) return 1;
    return 0;
  });

  // Overall = money actually allocated ÷ everything targeted. Averaging the
  // per-stage percentages would let one fully-funded small goal drag the
  // headline number up out of all proportion to what it represents.
  const totalTarget = stages.reduce((sum, s) => sum + (s.target ?? 0), 0);
  const totalAllocated = stages.reduce((sum, s) => sum + (s.saved ?? 0), 0);
  const overall = totalTarget > 0 ? totalAllocated / totalTarget : null;

  return {
    stages,
    nowMonth,
    overall,
    totalTarget,
    totalSaved: liquid,
  };
}
