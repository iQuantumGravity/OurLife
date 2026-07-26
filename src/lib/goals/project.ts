import type { Goal, GoalProgress } from "./types";

// ===========================================================================
// Projection: when will each goal actually be funded, and how far has it
// slipped from when you wanted it?
//
// The whole point of the app is that this recomputes constantly. Spend $400
// you hadn't planned and the surplus drops, so every goal downstream of it
// moves — visibly, with a number attached, not as a vague feeling.
//
// Deliberately simple and explainable: a linear run-down of monthly surplus
// through goals in priority order. A user can follow the arithmetic, which
// matters more here than sophistication nobody trusts.
// ===========================================================================

const MS_MONTH = 1000 * 60 * 60 * 24 * 30.44;

export function monthsBetweenDates(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_MONTH;
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + Math.ceil(months));
  return d;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ProjectionInput {
  goals: Goal[];
  /** Real money available per month after everything else — can be negative. */
  monthlySurplus: number;
  /** Unallocated savings that can be applied to goals right now. */
  liquidUnallocated: number;
  now?: Date;
}

/**
 * Order goals for funding: explicit priority first, then the soonest deadline,
 * then the smallest — small wins early keep people going.
 */
function fundingOrder(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.targetDate && b.targetDate)
      return a.targetDate.localeCompare(b.targetDate);
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return (a.targetAmount ?? Infinity) - (b.targetAmount ?? Infinity);
  });
}

export function projectGoals({
  goals,
  monthlySurplus,
  liquidUnallocated,
  now = new Date(),
}: ProjectionInput): GoalProgress[] {
  const active = goals.filter((g) => g.status === "active");
  const ordered = fundingOrder(active);

  // Spare cash fills goals in order — the same dollar can't fund two things.
  let spare = Math.max(0, liquidUnallocated);
  // Months consumed by everything ahead of this goal in the queue.
  let monthsConsumed = 0;

  const byId = new Map<string, GoalProgress>();

  for (const g of ordered) {
    const target = g.targetAmount;
    const alreadySaved = g.savedAmount ?? 0;

    // Apply spare cash on top of what's explicitly allocated.
    let effectiveSaved = alreadySaved;
    if (target !== null && spare > 0) {
      const need = Math.max(0, target - effectiveSaved);
      const applied = Math.min(spare, need);
      effectiveSaved += applied;
      spare -= applied;
    }

    const remaining =
      target !== null ? Math.max(0, target - effectiveSaved) : null;
    const progress =
      target !== null && target > 0
        ? Math.max(0, Math.min(1, effectiveSaved / target))
        : null;

    const wanted = g.targetDate ? new Date(g.targetDate + "T00:00:00Z") : null;
    const monthsToTarget = wanted ? monthsBetweenDates(now, wanted) : null;

    // How long this goal takes once it reaches the front of the queue. A goal
    // with its own monthly contribution funds itself in parallel; otherwise it
    // waits its turn on the shared surplus.
    let monthsToFund: number | null = null;
    if (remaining !== null && remaining <= 0) {
      monthsToFund = 0;
    } else if (remaining !== null) {
      const rate =
        g.monthlyContribution && g.monthlyContribution > 0
          ? g.monthlyContribution
          : monthlySurplus;
      if (rate > 0) {
        const own = remaining / rate;
        monthsToFund =
          g.monthlyContribution && g.monthlyContribution > 0
            ? own // funded from its own line, no queueing
            : monthsConsumed + own;
        if (!(g.monthlyContribution && g.monthlyContribution > 0)) {
          monthsConsumed += own;
        }
      }
    }

    const projected =
      monthsToFund !== null ? iso(addMonths(now, monthsToFund)) : null;

    const slipMonths =
      monthsToFund !== null && monthsToTarget !== null
        ? Math.round(monthsToFund - monthsToTarget)
        : null;

    byId.set(g.id, {
      ...g,
      savedAmount: effectiveSaved,
      progress,
      remaining,
      monthsToTarget: monthsToTarget === null ? null : Math.round(monthsToTarget),
      projectedDate: projected,
      slipMonths,
      onTrack: slipMonths === null ? null : slipMonths <= 0,
    });
  }

  // Non-active goals still need to render, just without a projection.
  for (const g of goals) {
    if (byId.has(g.id)) continue;
    const target = g.targetAmount;
    byId.set(g.id, {
      ...g,
      progress:
        target !== null && target > 0
          ? Math.max(0, Math.min(1, (g.savedAmount ?? 0) / target))
          : null,
      remaining: target !== null ? Math.max(0, target - (g.savedAmount ?? 0)) : null,
      monthsToTarget: null,
      projectedDate: null,
      slipMonths: null,
      onTrack: null,
    });
  }

  // Preserve the caller's original ordering.
  return goals.map((g) => byId.get(g.id)!).filter(Boolean);
}

/**
 * What a one-off amount does to the plan: how many months later everything
 * lands. This is the "you spent $400 you hadn't planned" number.
 */
export function impactOfSpend(
  amount: number,
  monthlySurplus: number,
): { monthsDelayed: number; explanation: string } {
  if (amount <= 0) {
    return { monthsDelayed: 0, explanation: "No impact." };
  }
  if (monthlySurplus <= 0) {
    return {
      monthsDelayed: 0,
      explanation:
        "You're not currently saving a surplus each month, so there's no timeline to push — this adds to what needs making up first.",
    };
  }
  const months = amount / monthlySurplus;
  const rounded = Math.round(months * 10) / 10;
  return {
    monthsDelayed: rounded,
    explanation:
      rounded < 0.1
        ? "Barely a ripple at your current savings rate."
        : `That's about ${rounded} month${rounded === 1 ? "" : "s"} of your current saving rate.`,
  };
}
