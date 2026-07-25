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
  // safeParse: a stored value the schema rejects should degrade to a default,
  // never take down the page that would let the user fix it.
  const parsed = OnboardingStateSchema.safeParse({
    mode: row?.mode ?? "individual",
  });
  return parsed.success ? parsed.data : { mode: "individual" };
}

function toCamelAnswers(row: any): OnboardingAnswers {
  const parsed = OnboardingAnswersSchema.safeParse({
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
    currentSavings:
      row?.current_savings === null || row?.current_savings === undefined
        ? null
        : Number(row.current_savings),
    riskTolerance: row?.risk_tolerance ?? null,
    lifeTrackCompletedAt: row?.life_track_completed_at ?? null,
    moneyTrackCompletedAt: row?.money_track_completed_at ?? null,
    comparisonViewedAt: row?.comparison_viewed_at ?? null,
    skippedFields: row?.skipped_fields ?? [],
    raw: row?.raw ?? {},
  });

  if (parsed.success) return parsed.data;

  // A value outside the schema's bounds (hand-edited in SQL, backfilled, or
  // written by an older build) must not 500 the onboarding page forever.
  // Keep the progress/skip bookkeeping so the wizard still resumes correctly.
  return {
    ...emptyOnboardingAnswers,
    lifeTrackCompletedAt: row?.life_track_completed_at ?? null,
    moneyTrackCompletedAt: row?.money_track_completed_at ?? null,
    comparisonViewedAt: row?.comparison_viewed_at ?? null,
    skippedFields: Array.isArray(row?.skipped_fields) ? row.skipped_fields : [],
  };
}

const COLUMN_OF: Record<keyof OnboardingAnswersPatch, string> = {
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
  comparisonViewedAt: "comparison_viewed_at",
  skippedFields: "skipped_fields",
  raw: "raw",
};

function toSnakePatch(patch: OnboardingAnswersPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    // Skipping `undefined` matters: an upsert writes every column present in
    // the payload, so a stray key would blank a column the user never touched.
    if (value === undefined) continue;
    const column = COLUMN_OF[key as keyof OnboardingAnswersPatch];
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
  patch: Partial<{ mode: OnboardingState["mode"] }>,
) {
  const supabase = createClient();
  const row: Record<string, unknown> = { household_id: householdId };
  if (patch.mode !== undefined) row.mode = patch.mode;
  const { error } = await supabase
    .from("onboarding_state")
    .upsert(row, { onConflict: "household_id" });
  return error ? { error: error.message } : { ok: true as const };
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
  const { error } = await supabase
    .from("onboarding_answers")
    .upsert(row, { onConflict: "household_id,user_id" });
  return error ? { error: error.message } : { ok: true as const };
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
  expires_at: string;
}

export async function listInvites(householdId: string): Promise<InviteRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("partner_invites")
    .select("id, invitee_email, invitee_phone, status, token, created_at, expires_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  return (data ?? []) as InviteRow[];
}

/**
 * Create an invite. The contact lookup, token generation and insert all happen
 * inside one SECURITY DEFINER function so the app never exposes a standalone
 * "does this email have an account" probe, and never handles the matched uuid.
 */
export async function createInvite(
  householdId: string,
  contact: { email?: string; phone?: string },
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("create_partner_invite", {
      p_household_id: householdId,
      p_email: contact.email ?? null,
      p_phone: contact.phone ?? null,
    })
    .maybeSingle();

  if (error) return { error: error.message };
  const row = data as { token: string; matched: boolean } | null;
  if (!row) return { error: "Could not create invite." };
  return { ok: true as const, token: row.token, matched: row.matched };
}

export async function cancelInvite(inviteId: string) {
  const supabase = createClient();
  // .select() so RLS filtering out every row surfaces as a failure instead of
  // a silent success -- e.g. the partner accepted a moment ago in another tab.
  const { data, error } = await supabase
    .from("partner_invites")
    .delete()
    .eq("id", inviteId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "That invite could no longer be cancelled." };
  }
  return { ok: true as const };
}

export interface InviteDetails {
  householdName: string;
  inviterName: string | null;
}

/**
 * Public lookup by token for the /invite/[token] landing page -- works whether
 * or not the visitor is signed in. Returns nothing for a consumed or expired
 * token, so an old link can't be polled as a status oracle.
 */
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
  } | null;
  if (!row) return null;
  return {
    householdName: row.household_name ?? "a household",
    inviterName: row.inviter_name ?? null,
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
  return { ok: true as const };
}
