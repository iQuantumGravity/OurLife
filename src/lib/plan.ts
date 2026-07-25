import "server-only";
import { getBaseline, getPayStubs } from "@/lib/data";
import { getOnboardingAnswers } from "@/lib/onboarding/data";
import { stubsByMonth, byEarner } from "@/lib/model/engine";
import type { Baseline, PayStub, ElevationPoint, Phase } from "@/lib/model/types";
import type { OnboardingAnswers } from "@/lib/onboarding/schema";

// ===========================================================================
// The plan as it ACTUALLY is, assembled only from things the household really
// entered: their onboarding answers, their logged pay stubs, and whatever the
// assistant has written into household_baseline.
//
// Nothing here is ever invented. Where a number isn't known it stays null and
// the UI renders an honest empty state, rather than borrowing a figure from a
// sample plan and presenting it as the user's own.
// ===========================================================================

export interface PlanGoal {
  id: string;
  name: string;
  /** "YYYY-MM", or null when the household hasn't dated it yet. */
  targetMonth: string | null;
  cost: number | null;
  fundedFrom: string | null;
}

export interface PlanView {
  /** False when the household has entered literally nothing yet. */
  hasAnything: boolean;
  householdName: string | null;

  /** Liquid savings today. From the baseline, else the onboarding answer. */
  startingSavings: number | null;
  savingsSource: "baseline" | "onboarding" | null;

  /** Average real monthly take-home, computed from logged stubs. */
  monthlyTakeHome: number | null;
  takeHomeSource: "stubs" | "baseline" | null;

  goals: PlanGoal[];
  goalsSource: "baseline" | "onboarding" | null;

  /** Only ever populated by a real authored plan — never synthesized. */
  phases: Phase[];
  elevation: ElevationPoint[];

  stubs: PayStub[];
  monthsLogged: number;
  totalNetLogged: number;
  earners: { earner: string; net: number; count: number }[];

  retirementAge: number | null;
  location: string | null;
}

const GOAL_LABEL: Record<string, string> = {
  debt: "Pay off debt",
  travel: "Travel",
  milestone: "Milestone",
  home: "Home",
  family: "Family",
  invest: "Investing",
};

function goalsFromOnboarding(a: OnboardingAnswers): PlanGoal[] {
  return [...a.topGoals]
    .sort((x, y) => x.priority - y.priority)
    .map((g, i) => ({
      id: `onboarding-${i}`,
      name: g.note?.trim() || GOAL_LABEL[g.type] || g.type,
      targetMonth: g.targetDate ?? null,
      cost: g.targetAmount ?? null,
      fundedFrom: null,
    }));
}

function goalsFromBaseline(b: Baseline): PlanGoal[] {
  return (b.goals ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    targetMonth: g.targetMonth ?? null,
    cost: typeof g.cost === "number" ? g.cost : null,
    fundedFrom: g.fundedFrom ?? null,
  }));
}

/** Mean monthly take-home across the months that actually have stubs. */
function averageMonthlyNet(stubs: PayStub[]): number | null {
  const months = stubsByMonth(stubs);
  if (months.length === 0) return null;
  const total = months.reduce((s, m) => s + m.net, 0);
  return Math.round(total / months.length);
}

export async function getPlanView(
  householdId: string,
  userId: string,
): Promise<PlanView> {
  const [baseline, stubs, answers] = await Promise.all([
    getBaseline(householdId),
    getPayStubs(householdId),
    getOnboardingAnswers(householdId, userId),
  ]);

  const months = stubsByMonth(stubs);
  const avgNet = averageMonthlyNet(stubs);

  const startingSavings =
    typeof baseline?.startingSavings === "number"
      ? baseline.startingSavings
      : answers.currentSavings ?? null;
  const savingsSource: PlanView["savingsSource"] =
    typeof baseline?.startingSavings === "number"
      ? "baseline"
      : answers.currentSavings !== null
        ? "onboarding"
        : null;

  // Real logged pay always beats a planned figure -- this is the whole point
  // of logging stubs.
  const monthlyTakeHome =
    avgNet ??
    (typeof baseline?.monthlyTakeHome === "number"
      ? baseline.monthlyTakeHome
      : null);
  const takeHomeSource: PlanView["takeHomeSource"] =
    avgNet !== null ? "stubs" : baseline?.monthlyTakeHome ? "baseline" : null;

  const baselineGoals = baseline ? goalsFromBaseline(baseline) : [];
  const onboardingGoals = goalsFromOnboarding(answers);
  const goals = baselineGoals.length > 0 ? baselineGoals : onboardingGoals;
  const goalsSource: PlanView["goalsSource"] =
    baselineGoals.length > 0
      ? "baseline"
      : onboardingGoals.length > 0
        ? "onboarding"
        : null;

  const hasAnything =
    baseline !== null ||
    stubs.length > 0 ||
    onboardingGoals.length > 0 ||
    answers.currentSavings !== null ||
    answers.lifeTrackCompletedAt !== null;

  return {
    hasAnything,
    householdName: baseline?.householdName ?? null,
    startingSavings,
    savingsSource,
    monthlyTakeHome,
    takeHomeSource,
    goals,
    goalsSource,
    phases: baseline?.phases ?? [],
    elevation: baseline?.elevation ?? [],
    stubs,
    monthsLogged: months.length,
    totalNetLogged: Math.round(months.reduce((s, m) => s + m.net, 0)),
    earners: byEarner(stubs).map((e) => ({
      earner: e.earner,
      net: Math.round(e.net),
      count: e.count,
    })),
    retirementAge: answers.retirementAge,
    location: answers.location,
  };
}
