import "server-only";
import { getOnboardingAnswers } from "@/lib/onboarding/data";
import { getGoals, createGoal } from "./data";
import type { GoalBucket } from "./types";

// ===========================================================================
// Onboarding answers → real goals.
//
// Onboarding collects "top goals" as loose answers on a form. Goals are the
// thing the rest of the app actually reasons about: they hold money, project
// dates, and move when you spend. Without this bridge a household that
// finished onboarding sees its ambitions listed on the dashboard while the
// goals page insists they have none — two parallel truths, neither wired to
// the other.
// ===========================================================================

/** Onboarding's coarse categories mapped onto the goal buckets. */
const BUCKET_FOR: Record<string, GoalBucket> = {
  debt: "debt",
  travel: "travel",
  home: "home",
  family: "family",
  invest: "invest",
  milestone: "purchase",
};

const NAME_FOR: Record<string, string> = {
  debt: "Pay off debt",
  travel: "Travel",
  milestone: "Milestone",
  home: "Home",
  family: "Family",
  invest: "Investing",
};

export interface ImportableGoal {
  name: string;
  bucket: GoalBucket;
  targetAmount: number | null;
  /** "YYYY-MM-DD" */
  targetDate: string | null;
  priority: number;
}

/** Names collide on case and stray whitespace far more often than on content. */
function key(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The onboarding goals that don't yet exist as real goals. Matching is by
 * name, so re-running an import after the user has renamed something imports
 * it again — a duplicate is recoverable, a silently-skipped goal is not.
 */
export async function pendingOnboardingGoals(
  householdId: string,
  userId: string,
): Promise<ImportableGoal[]> {
  const [answers, existing] = await Promise.all([
    getOnboardingAnswers(householdId, userId),
    getGoals(householdId),
  ]);

  const taken = new Set(existing.map((g) => key(g.name)));

  return answers.topGoals
    .map((g) => ({
      name: g.note?.trim() || NAME_FOR[g.type] || g.type,
      bucket: BUCKET_FOR[g.type] ?? ("other" as GoalBucket),
      targetAmount: g.targetAmount ?? null,
      targetDate: g.targetDate ? `${g.targetDate}-01` : null,
      priority: g.priority * 10,
    }))
    .filter((g) => !taken.has(key(g.name)));
}

/**
 * Create the pending onboarding goals for real. They arrive as shared goals:
 * onboarding asks about the household's plans, not one person's, and moving a
 * goal to "just mine" afterwards is one tap.
 */
export async function importOnboardingGoals(
  householdId: string,
  userId: string,
): Promise<{ ok: true; created: number } | { error: string }> {
  const pending = await pendingOnboardingGoals(householdId, userId);
  if (pending.length === 0) return { ok: true, created: 0 };

  let created = 0;
  for (const g of pending) {
    const res = await createGoal(householdId, userId, {
      scope: "shared",
      ownerUserId: null,
      bucket: g.bucket,
      name: g.name,
      note: null,
      targetAmount: g.targetAmount,
      targetDate: g.targetDate,
      priority: g.priority,
    });
    // A single failure shouldn't strand the rest, but it also shouldn't be
    // reported as a clean import.
    if ("error" in res) {
      const why = res.error ?? "couldn't save that goal";
      return created > 0
        ? { error: `Imported ${created}, then hit: ${why}` }
        : { error: why };
    }
    created += 1;
  }
  return { ok: true, created };
}
