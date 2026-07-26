import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Goal, GoalEvent, GoalBucket, GoalScope } from "./types";

function toGoal(r: any): Goal {
  return {
    id: r.id,
    householdId: r.household_id,
    scope: r.scope as GoalScope,
    ownerUserId: r.owner_user_id ?? null,
    bucket: r.bucket as GoalBucket,
    name: r.name,
    note: r.note ?? null,
    targetAmount: r.target_amount === null ? null : Number(r.target_amount),
    savedAmount: Number(r.saved_amount ?? 0),
    targetDate: r.target_date ?? null,
    monthlyContribution:
      r.monthly_contribution === null ? null : Number(r.monthly_contribution),
    priority: r.priority ?? 100,
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function getGoals(householdId: string): Promise<Goal[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("household_id", householdId)
    .order("priority", { ascending: true })
    .order("target_date", { ascending: true, nullsFirst: false });
  return (data ?? []).map(toGoal);
}

export async function getGoalEvents(
  householdId: string,
  limit = 25,
): Promise<GoalEvent[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("goal_events")
    .select("id, goal_id, kind, amount, summary, source, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    goalId: r.goal_id ?? null,
    kind: r.kind,
    amount: Number(r.amount ?? 0),
    summary: r.summary ?? null,
    source: r.source,
    createdAt: r.created_at,
  }));
}

export interface GoalInput {
  scope: GoalScope;
  ownerUserId: string | null;
  bucket: GoalBucket;
  name: string;
  note?: string | null;
  targetAmount?: number | null;
  targetDate?: string | null;
  monthlyContribution?: number | null;
  priority?: number;
}

export async function createGoal(
  householdId: string,
  userId: string,
  input: GoalInput,
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      household_id: householdId,
      created_by: userId,
      scope: input.scope,
      // The DB constraint enforces this pairing too; normalise here so a
      // shared goal never carries a stray owner from the form state.
      owner_user_id: input.scope === "individual" ? input.ownerUserId : null,
      bucket: input.bucket,
      name: input.name,
      note: input.note ?? null,
      target_amount: input.targetAmount ?? null,
      target_date: input.targetDate ?? null,
      monthly_contribution: input.monthlyContribution ?? null,
      priority: input.priority ?? 100,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { ok: true as const, id: data?.id as string };
}

export async function updateGoal(
  householdId: string,
  goalId: string,
  patch: Partial<GoalInput> & { status?: string; savedAmount?: number },
) {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.scope !== undefined) {
    row.scope = patch.scope;
    row.owner_user_id =
      patch.scope === "individual" ? (patch.ownerUserId ?? null) : null;
  } else if (patch.ownerUserId !== undefined) {
    row.owner_user_id = patch.ownerUserId;
  }
  if (patch.bucket !== undefined) row.bucket = patch.bucket;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.targetAmount !== undefined) row.target_amount = patch.targetAmount;
  if (patch.targetDate !== undefined) row.target_date = patch.targetDate;
  if (patch.monthlyContribution !== undefined)
    row.monthly_contribution = patch.monthlyContribution;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.savedAmount !== undefined) row.saved_amount = patch.savedAmount;

  if (Object.keys(row).length === 0) return { ok: true as const };

  const { error } = await supabase
    .from("goals")
    .update(row)
    .eq("id", goalId)
    .eq("household_id", householdId);
  return error ? { error: error.message } : { ok: true as const };
}

export async function deleteGoal(householdId: string, goalId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", goalId)
    .eq("household_id", householdId);
  return error ? { error: error.message } : { ok: true as const };
}

export async function logGoalEvent(
  householdId: string,
  userId: string | null,
  event: {
    goalId?: string | null;
    kind: GoalEvent["kind"];
    amount: number;
    summary?: string | null;
    source?: GoalEvent["source"];
    sourceId?: string | null;
  },
) {
  const supabase = createClient();
  const { error } = await supabase.from("goal_events").insert({
    household_id: householdId,
    goal_id: event.goalId ?? null,
    kind: event.kind,
    amount: event.amount,
    summary: event.summary ?? null,
    source: event.source ?? "manual",
    source_id: event.sourceId ?? null,
    created_by: userId,
  });
  return error ? { error: error.message } : { ok: true as const };
}

/** Move money onto a goal and record why, in one place. */
export async function allocateToGoal(
  householdId: string,
  userId: string,
  goalId: string,
  amount: number,
  summary?: string,
) {
  const supabase = createClient();
  const { data: current } = await supabase
    .from("goals")
    .select("saved_amount")
    .eq("id", goalId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!current) return { error: "That goal no longer exists." };

  const next = Math.max(0, Number(current.saved_amount ?? 0) + amount);
  const res = await updateGoal(householdId, goalId, { savedAmount: next });
  if ("error" in res) return res;

  await logGoalEvent(householdId, userId, {
    goalId,
    kind: amount >= 0 ? "contribution" : "spend",
    amount,
    summary: summary ?? null,
    source: "manual",
  });
  return { ok: true as const, savedAmount: next };
}
