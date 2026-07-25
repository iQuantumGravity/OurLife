"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/data";
import {
  getOnboardingAnswers,
  saveOnboardingAnswers,
  saveOnboardingState,
  createInvite as createInviteRow,
  cancelInvite as cancelInviteRow,
} from "@/lib/onboarding/data";
import {
  OnboardingAnswersPatchSchema,
  InviteContactSchema,
  ANSWER_FIELD_KEYS,
  type OnboardingAnswersPatch,
} from "@/lib/onboarding/schema";
import { PARTNER_WAIT_SKIP } from "@/lib/onboarding/progress";
import { LIFE_STEPS, MONEY_STEPS } from "@/lib/onboarding/steps";

const VALID_SKIP_IDS = new Set<string>([
  ...LIFE_STEPS.map((s) => s.id),
  ...MONEY_STEPS.map((s) => s.id),
  PARTNER_WAIT_SKIP,
]);

export async function saveStep(patch: OnboardingAnswersPatch) {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and we'll pick up right here." };

  const parsed = OnboardingAnswersPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That value didn't look right." };
  }

  // Defense in depth: only ever write the keys the caller actually sent. Even
  // if the patch schema were to start materializing defaults again, a single
  // answer can never blank out the rest of the row.
  const requested = Object.keys(patch) as (keyof OnboardingAnswersPatch)[];
  const toSave: OnboardingAnswersPatch = {};
  for (const key of requested) {
    if (!ANSWER_FIELD_KEYS.includes(key)) continue;
    if (parsed.data[key] === undefined) continue;
    (toSave as any)[key] = parsed.data[key];
  }
  if (Object.keys(toSave).length === 0) return { error: "Nothing to save." };

  const res = await saveOnboardingAnswers(ctx.householdId, ctx.userId, toSave);
  if ("error" in res) return res;

  revalidatePath("/onboarding");
  return { ok: true as const };
}

export async function setMode(mode: "individual" | "couple") {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and we'll pick up right here." };
  const res = await saveOnboardingState(ctx.householdId, { mode });
  if ("error" in res) return res;
  revalidatePath("/onboarding");
  return { ok: true as const };
}

/** Records that a step (by step id) was passed over. */
export async function skipStep(stepId: string) {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and we'll pick up right here." };
  if (!VALID_SKIP_IDS.has(stepId)) return { error: "Unknown step." };

  const existing = await getOnboardingAnswers(ctx.householdId, ctx.userId);
  if (existing.skippedFields.includes(stepId)) {
    revalidatePath("/onboarding");
    return { ok: true as const };
  }
  const res = await saveOnboardingAnswers(ctx.householdId, ctx.userId, {
    skippedFields: [...existing.skippedFields, stepId],
  });
  if ("error" in res) return res;
  revalidatePath("/onboarding");
  return { ok: true as const };
}

/** "Go on without them" — stops the couple flow waiting on a partner. */
export async function waivePartnerWait() {
  return skipStep(PARTNER_WAIT_SKIP);
}

export async function completeTrack(track: "life" | "money") {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and we'll pick up right here." };
  const now = new Date().toISOString();
  const res = await saveOnboardingAnswers(
    ctx.householdId,
    ctx.userId,
    track === "life" ? { lifeTrackCompletedAt: now } : { moneyTrackCompletedAt: now },
  );
  if ("error" in res) return res;
  revalidatePath("/onboarding");
  return { ok: true as const };
}

/** Per-user, so both partners each get to see the comparison. */
export async function markComparisonViewed() {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and we'll pick up right here." };
  const res = await saveOnboardingAnswers(ctx.householdId, ctx.userId, {
    comparisonViewedAt: new Date().toISOString(),
  });
  if ("error" in res) return res;
  revalidatePath("/onboarding");
  return { ok: true as const };
}

export type InviteResult =
  | { error: string; ok?: undefined }
  | { ok: true; error?: undefined; matched: boolean; inviteUrl: string };

export async function invitePartner(input: {
  email?: string;
  phone?: string;
}): Promise<InviteResult> {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and we'll pick up right here." };

  const parsed = InviteContactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Add an email or phone number." };
  }

  const result = await createInviteRow(ctx.householdId, parsed.data);
  if ("error" in result && result.error) return { error: result.error };
  if (!("token" in result) || !result.token) {
    return { error: "Could not create that invite." };
  }

  revalidatePath("/onboarding");
  return {
    ok: true,
    matched: Boolean(result.matched),
    inviteUrl: `/invite/${result.token}`,
  };
}

export async function cancelInvite(inviteId: string) {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and we'll pick up right here." };
  const res = await cancelInviteRow(inviteId);
  revalidatePath("/onboarding");
  return res;
}
