"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/data";
import {
  createGoal,
  updateGoal,
  deleteGoal,
  allocateToGoal,
} from "@/lib/goals/data";
import {
  GOAL_BUCKETS,
  GOAL_SCOPES,
  type GoalBucket,
  type GoalScope,
} from "@/lib/goals/types";

/** One shape for every action here, so callers can always read `.error`. */
export type GoalActionResult = { ok?: true; error?: string };

function revalidateAll() {
  revalidatePath("/goals");
  revalidatePath("/path");
  revalidatePath("/dashboard");
}

function parseAmount(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const s = String(raw).replace(/[^0-9.]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function addGoal(fd: FormData): Promise<GoalActionResult> {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };

  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Give it a name." };
  if (name.length > 120) return { error: "That name is a bit long." };

  const scopeRaw = String(fd.get("scope") ?? "shared");
  const scope: GoalScope = (GOAL_SCOPES as readonly string[]).includes(scopeRaw)
    ? (scopeRaw as GoalScope)
    : "shared";

  const bucketRaw = String(fd.get("bucket") ?? "other");
  const bucket: GoalBucket = (GOAL_BUCKETS as readonly string[]).includes(bucketRaw)
    ? (bucketRaw as GoalBucket)
    : "other";

  // An individual goal defaults to the person creating it.
  const ownerRaw = String(fd.get("owner") ?? "").trim();
  const ownerUserId = scope === "individual" ? ownerRaw || ctx.userId : null;

  const month = String(fd.get("targetMonth") ?? "").trim();
  const targetDate = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : null;

  const res = await createGoal(ctx.householdId, ctx.userId, {
    scope,
    ownerUserId,
    bucket,
    name,
    note: String(fd.get("note") ?? "").trim() || null,
    targetAmount: parseAmount(fd.get("targetAmount")),
    targetDate,
    monthlyContribution: parseAmount(fd.get("monthlyContribution")),
    priority: Number(fd.get("priority") ?? 100) || 100,
  });
  if ("error" in res) return res;

  revalidateAll();
  return { ok: true as const };
}

export async function setGoalStatus(
  goalId: string,
  status: string,
): Promise<GoalActionResult> {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };
  const res = await updateGoal(ctx.householdId, goalId, { status });
  revalidateAll();
  return "error" in res ? { error: res.error } : { ok: true };
}

export async function removeGoal(goalId: string): Promise<GoalActionResult> {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };
  const res = await deleteGoal(ctx.householdId, goalId);
  revalidateAll();
  return "error" in res ? { error: res.error } : { ok: true };
}

export async function contribute(
  goalId: string,
  amount: number,
  note?: string,
): Promise<GoalActionResult> {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };
  if (!Number.isFinite(amount) || amount === 0) {
    return { error: "Enter an amount." };
  }
  const res = await allocateToGoal(
    ctx.householdId,
    ctx.userId,
    goalId,
    amount,
    note,
  );
  revalidateAll();
  return "error" in res ? { error: res.error } : { ok: true };
}

export async function importFromOnboarding(): Promise<GoalActionResult> {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };
  const { importOnboardingGoals } = await import("@/lib/goals/import");
  const res = await importOnboardingGoals(ctx.householdId, ctx.userId);
  revalidateAll();
  return "error" in res ? { error: res.error } : { ok: true };
}

export async function reprioritise(
  goalId: string,
  direction: "up" | "down",
): Promise<GoalActionResult> {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };
  // Coarse but predictable: nudge the priority number. Ties break on date.
  const delta = direction === "up" ? -10 : 10;
  const { getGoals } = await import("@/lib/goals/data");
  const goals = await getGoals(ctx.householdId);
  const g = goals.find((x) => x.id === goalId);
  if (!g) return { error: "That goal no longer exists." };
  const res = await updateGoal(ctx.householdId, goalId, {
    priority: Math.max(0, g.priority + delta),
  });
  revalidateAll();
  return "error" in res ? { error: res.error } : { ok: true };
}
