import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  OnboardingAnswersSchema,
  OnboardingStateSchema,
  emptyOnboardingAnswers,
  type OnboardingAnswers,
  type OnboardingAnswersPatch,
  type OnboardingState,
} from "./schema";

function toCamelState(row: any): OnboardingState {
  return OnboardingStateSchema.parse({
    mode: row?.mode ?? "individual",
    comparisonViewedAt: row?.comparison_viewed_at ?? null,
  });
}

function toCamelAnswers(row: any): OnboardingAnswers {
  return OnboardingAnswersSchema.parse({
    relationshipStatus: row?.relationship_status ?? null,
    hasPartner: row?.has_partner ?? null,
    married: row?.married ?? null,
    planToMarry: row?.plan_to_marry ?? null,
    marriageTimeline: row?.marriage_timeline ?? null,
    kidsStatus: row?.kids_status ?? null,
    kidsCount: row?.kids_count ?? null,
    kidsTimelineYears: row?.kids_timeline_years ?? null,
    retirementAge: row?.retirement_age ?? null,
    location: row?.location ?? null,
    vision: row?.vision ?? null,
    topGoals: row?.top_goals ?? [],
    incomeType: row?.income_type ?? null,
    existingDebt: row?.existing_debt ?? [],
    currentSavings: row?.current_savings ?? null,
    riskTolerance: row?.risk_tolerance ?? null,
    lifeTrackCompletedAt: row?.life_track_completed_at ?? null,
    moneyTrackCompletedAt: row?.money_track_completed_at ?? null,
    skippedFields: row?.skipped_fields ?? [],
    raw: row?.raw ?? {},
  });
}

function toSnakePatch(patch: OnboardingAnswersPatch): Record<string, unknown> {
  const map: Record<keyof OnboardingAnswersPatch, string> = {
    relationshipStatus: "relationship_status",
    hasPartner: "has_partner",
    married: "married",
    planToMarry: "plan_to_marry",
    marriageTimeline: "marriage_timeline",
    kidsStatus: "kids_status",
    kidsCount: "kids_count",
    kidsTimelineYears: "kids_timeline_years",
    retirementAge: "retirement_age",
    location: "location",
    vision: "vision",
    topGoals: "top_goals",
    incomeType: "income_type",
    existingDebt: "existing_debt",
    currentSavings: "current_savings",
    riskTolerance: "risk_tolerance",
    lifeTrackCompletedAt: "life_track_completed_at",
    moneyTrackCompletedAt: "money_track_completed_at",
    skippedFields: "skipped_fields",
    raw: "raw",
  };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = map[key as keyof OnboardingAnswersPatch];
    if (column) out[column] = value;
  }
  return out;
}

export async function getOnboardingState(
  householdId: string,
): Promise<{ state: OnboardingState; exists: boolean }> {
  const supabase = createClient();
  const { data } = await supabase
    .from("onboarding_state")
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();
  return { state: toCamelState(data), exists: Boolean(data) };
}

export async function saveOnboardingState(
  householdId: string,
  patch: Partial<{
    mode: OnboardingState["mode"];
    comparisonViewedAt: string | null;
  }>,
) {
  const supabase = createClient();
  const row: Record<string, unknown> = { household_id: householdId };
  if (patch.mode !== undefined) row.mode = patch.mode;
  if (patch.comparisonViewedAt !== undefined)
    row.comparison_viewed_at = patch.comparisonViewedAt;

  await supabase.from("onboarding_state").upsert(row, { onConflict: "household_id" });
}

export async function getOnboardingAnswers(
  householdId: string,
  userId: string,
): Promise<OnboardingAnswers> {
  const supabase = createClient();
  const { data } = await supabase
    .from("onboarding_answers")
    .select("*")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? toCamelAnswers(data) : emptyOnboardingAnswers;
}

export async function saveOnboardingAnswers(
  householdId: string,
  userId: string,
  patch: OnboardingAnswersPatch,
) {
  const supabase = createClient();
  const row = {
    household_id: householdId,
    user_id: userId,
    ...toSnakePatch(patch),
  };
  await supabase
    .from("onboarding_answers")
    .upsert(row, { onConflict: "household_id,user_id" });
}

export interface MemberAnswers {
  userId: string;
  displayName: string | null;
  answers: OnboardingAnswers;
}

/** Every household member's onboarding answers, for the couple comparison screen. */
export async function getHouseholdAnswers(
  householdId: string,
): Promise<MemberAnswers[]> {
  const supabase = createClient();
  const [{ data: members }, { data: answerRows }] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", householdId),
    supabase.from("onboarding_answers").select("*").eq("household_id", householdId),
  ]);

  const byUser = new Map((answerRows ?? []).map((r: any) => [r.user_id, r]));
  return (members ?? []).map((m: any) => ({
    userId: m.user_id,
    displayName: m.display_name,
    answers: byUser.has(m.user_id)
      ? toCamelAnswers(byUser.get(m.user_id))
      : emptyOnboardingAnswers,
  }));
}

// --- partner invites ---------------------------------------------------------

export interface InviteRow {
  id: string;
  invitee_email: string | null;
  invitee_phone: string | null;
  status: "pending" | "accepted" | "declined";
  token: string;
  created_at: string;
}

export async function listInvites(householdId: string): Promise<InviteRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("partner_invites")
    .select("id, invitee_email, invitee_phone, status, token, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  return (data ?? []) as InviteRow[];
}

/** Looks up an existing account by email/phone via the search-safe RPC. */
export async function findUserByContact(
  email: string | null,
  phone: string | null,
): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.rpc("find_user_by_contact", {
    p_email: email,
    p_phone: phone,
  });
  return (data as string | null) ?? null;
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createInvite(
  householdId: string,
  inviterUserId: string,
  contact: { email?: string; phone?: string },
) {
  const supabase = createClient();
  const matchedUserId = await findUserByContact(
    contact.email ?? null,
    contact.phone ?? null,
  );
  const token = randomToken();

  const { data, error } = await supabase
    .from("partner_invites")
    .insert({
      household_id: householdId,
      inviter_user_id: inviterUserId,
      invitee_user_id: matchedUserId,
      invitee_email: contact.email ?? null,
      invitee_phone: contact.phone ?? null,
      token,
    })
    .select("id, token")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create invite." };
  }
  return { ok: true, token: data.token as string, matched: Boolean(matchedUserId) };
}

export async function cancelInvite(inviteId: string) {
  const supabase = createClient();
  await supabase.from("partner_invites").delete().eq("id", inviteId);
}

export interface InviteDetails {
  householdName: string;
  inviterName: string | null;
  status: "pending" | "accepted" | "declined";
}

/** Public lookup by token, used by the /invite/[token] landing page — works
 * whether or not the visitor is signed in yet. */
export async function getInviteByToken(
  token: string,
): Promise<InviteDetails | null> {
  const supabase = createClient();
  const { data } = await supabase
    .rpc("get_invite_preview", { p_token: token })
    .maybeSingle();
  const row = data as {
    household_name: string | null;
    inviter_name: string | null;
    status: string;
  } | null;
  if (!row) return null;
  return {
    householdName: row.household_name ?? "a household",
    inviterName: row.inviter_name ?? null,
    status: row.status as InviteDetails["status"],
  };
}

export async function respondToInvite(
  token: string,
  action: "accept" | "decline",
) {
  const supabase = createClient();
  const { error } = await supabase.rpc("respond_to_invite", {
    p_token: token,
    p_action: action,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
