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
  type OnboardingAnswersPatch,
} from "@/lib/onboarding/schema";

export async function saveStep(
  patch: OnboardingAnswersPatch,
  opts?: { skippedField?: string },
) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not signed in." };

  const parsed = OnboardingAnswersPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid answer." };
  }

  let toSave = parsed.data;
  if (opts?.skippedField) {
    const existing = await getOnboardingAnswers(ctx.householdId, ctx.userId);
    const skippedFields = existing.skippedFields.includes(opts.skippedField)
      ? existing.skippedFields
      : [...existing.skippedFields, opts.skippedField];
    toSave = { ...toSave, skippedFields };
  }

  await saveOnboardingAnswers(ctx.householdId, ctx.userId, toSave);
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function setMode(mode: "individual" | "couple") {
  const ctx = await getContext();
  if (!ctx) return { error: "Not signed in." };
  await saveOnboardingState(ctx.householdId, { mode });
  revalidatePath("/onboarding");
  return { ok: true };
}

/** For steps with no single answer field of their own (partner, goals, debt,
 * the Plaid/upload CTAs) -- just records that the step was passed over. */
export async function skipField(fieldKey: string) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not signed in." };
  const existing = await getOnboardingAnswers(ctx.householdId, ctx.userId);
  if (!existing.skippedFields.includes(fieldKey)) {
    await saveOnboardingAnswers(ctx.householdId, ctx.userId, {
      skippedFields: [...existing.skippedFields, fieldKey],
    });
  }
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function completeTrack(track: "life" | "money") {
  const ctx = await getContext();
  if (!ctx) return { error: "Not signed in." };
  const now = new Date().toISOString();
  await saveOnboardingAnswers(ctx.householdId, ctx.userId, {
    [track === "life" ? "lifeTrackCompletedAt" : "moneyTrackCompletedAt"]: now,
  });
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function markComparisonViewed() {
  const ctx = await getContext();
  if (!ctx) return { error: "Not signed in." };
  await saveOnboardingState(ctx.householdId, {
    comparisonViewedAt: new Date().toISOString(),
  });
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function invitePartner(input: { email?: string; phone?: string }) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not signed in." };

  const parsed = InviteContactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Add an email or phone." };
  }

  const result = await createInviteRow(ctx.householdId, ctx.userId, parsed.data);
  if ("error" in result) return result;

  revalidatePath("/onboarding");
  return {
    ok: true,
    matched: result.matched,
    inviteUrl: `/invite/${result.token}`,
  };
}

export async function cancelInvite(inviteId: string) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not signed in." };
  await cancelInviteRow(inviteId);
  revalidatePath("/onboarding");
  return { ok: true };
}
