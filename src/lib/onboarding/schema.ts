import { z } from "zod";

// ===========================================================================
// Structured onboarding answers. Field names and enum values here match the
// typed columns in supabase/migrations/0004_onboarding.sql 1:1, so a saved
// answer round-trips cleanly between the wizard, the database, and whatever
// in the planning engine consumes it later.
//
// IMPORTANT -- why the patch schema is built separately from the read schema:
// in Zod 4, `.partial()` does NOT suppress `.default()`. Parsing `{ a: 1 }`
// against a partial()'d schema whose other fields carry defaults returns those
// defaults as concrete values, not `undefined`. Feeding that into an upsert
// rewrites every column, wiping answers the user gave earlier. So the patch
// schema below is built from DEFAULT-FREE field definitions, and only the read
// schema applies defaults.
// ===========================================================================

export const OnboardingModeSchema = z.enum(["individual", "couple"]);
export type OnboardingMode = z.infer<typeof OnboardingModeSchema>;

export const RelationshipStatusSchema = z.enum([
  "single",
  "partnered",
  "married",
  "other",
]);
export type RelationshipStatus = z.infer<typeof RelationshipStatusSchema>;

export const KidsStatusSchema = z.enum(["has", "wants", "none"]);
export type KidsStatus = z.infer<typeof KidsStatusSchema>;

export const IncomeTypeSchema = z.enum([
  "salary",
  "hourly",
  "commission",
  "self_employed",
  "mixed",
  "other",
]);
export type IncomeType = z.infer<typeof IncomeTypeSchema>;

export const RiskToleranceSchema = z.enum([
  "conservative",
  "moderate",
  "aggressive",
]);
export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;

export const GoalCategorySchema = z.enum([
  "debt",
  "travel",
  "milestone",
  "home",
  "family",
  "invest",
]);

export const OnboardingGoalSchema = z.object({
  type: GoalCategorySchema,
  /** "YYYY-MM", optional -- some goals don't have a date yet. */
  targetDate: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  targetAmount: z.number().nonnegative().nullable().optional(),
  priority: z.number().int().min(1).max(10),
  note: z.string().max(280).optional(),
});
export type OnboardingGoal = z.infer<typeof OnboardingGoalSchema>;

export const DebtItemSchema = z.object({
  type: z.enum([
    "credit_card",
    "student_loan",
    "auto_loan",
    "personal_loan",
    "medical",
    "other",
  ]),
  balance: z.number().nonnegative(),
  rate: z.number().min(0).max(1).nullable().optional(),
  minPayment: z.number().nonnegative().nullable().optional(),
});
export type DebtItem = z.infer<typeof DebtItemSchema>;

// ---------------------------------------------------------------------------
// Default-free field definitions. These bounds intentionally mirror the CHECK
// constraints in 0004_onboarding.sql -- keep the two in step.
// ---------------------------------------------------------------------------
const FIELDS = {
  // Life track
  relationshipStatus: RelationshipStatusSchema.nullable(),
  hasPartner: z.boolean().nullable(),
  married: z.boolean().nullable(),
  planToMarry: z.boolean().nullable(),
  marriageTimeline: z.string().max(120).nullable(),
  kidsStatus: KidsStatusSchema.nullable(),
  kidsCount: z.number().int().min(0).max(20).nullable(),
  kidsTimelineYears: z.number().int().min(0).max(40).nullable(),
  retirementAge: z.number().int().min(30).max(90).nullable(),
  location: z.string().max(120).nullable(),
  vision: z.string().max(2000).nullable(),
  topGoals: z.array(OnboardingGoalSchema).max(10),

  // Money track
  incomeType: IncomeTypeSchema.nullable(),
  existingDebt: z.array(DebtItemSchema).max(20),
  currentSavings: z.number().nonnegative().nullable(),
  riskTolerance: RiskToleranceSchema.nullable(),

  // Per-person progress
  lifeTrackCompletedAt: z.string().nullable(),
  moneyTrackCompletedAt: z.string().nullable(),
  comparisonViewedAt: z.string().nullable(),
  skippedFields: z.array(z.string()),
  raw: z.record(z.string(), z.unknown()),
} as const;

/**
 * Patch schema -- every field optional AND default-free, so `parse()` returns
 * only the keys the caller actually supplied. Never add `.default()` here.
 */
export const OnboardingAnswersPatchSchema = z.object(FIELDS).partial();
export type OnboardingAnswersPatch = z.infer<typeof OnboardingAnswersPatchSchema>;

/** Read schema -- defaults applied so a missing column becomes a sane value. */
export const OnboardingAnswersSchema = z.object({
  relationshipStatus: FIELDS.relationshipStatus.default(null),
  hasPartner: FIELDS.hasPartner.default(null),
  married: FIELDS.married.default(null),
  planToMarry: FIELDS.planToMarry.default(null),
  marriageTimeline: FIELDS.marriageTimeline.default(null),
  kidsStatus: FIELDS.kidsStatus.default(null),
  kidsCount: FIELDS.kidsCount.default(null),
  kidsTimelineYears: FIELDS.kidsTimelineYears.default(null),
  retirementAge: FIELDS.retirementAge.default(null),
  location: FIELDS.location.default(null),
  vision: FIELDS.vision.default(null),
  topGoals: FIELDS.topGoals.default([]),
  incomeType: FIELDS.incomeType.default(null),
  existingDebt: FIELDS.existingDebt.default([]),
  currentSavings: FIELDS.currentSavings.default(null),
  riskTolerance: FIELDS.riskTolerance.default(null),
  lifeTrackCompletedAt: FIELDS.lifeTrackCompletedAt.default(null),
  moneyTrackCompletedAt: FIELDS.moneyTrackCompletedAt.default(null),
  comparisonViewedAt: FIELDS.comparisonViewedAt.default(null),
  skippedFields: FIELDS.skippedFields.default([]),
  raw: FIELDS.raw.default({}),
});
export type OnboardingAnswers = z.infer<typeof OnboardingAnswersSchema>;

/** The full set of writable answer keys, used to bound what a patch may touch. */
export const ANSWER_FIELD_KEYS = Object.keys(FIELDS) as (keyof OnboardingAnswersPatch)[];

export const emptyOnboardingAnswers: OnboardingAnswers =
  OnboardingAnswersSchema.parse({});

// --- Onboarding state (shared, household-level settings) --------------------
export const OnboardingStateSchema = z.object({
  mode: OnboardingModeSchema.default("individual"),
});
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

// --- Partner invites ----------------------------------------------------------
export const InviteContactSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(7).max(20).optional(),
  })
  .refine((v) => Boolean(v.email || v.phone), {
    message: "An email or phone number is required.",
  });
export type InviteContact = z.infer<typeof InviteContactSchema>;

export const InviteResponseActionSchema = z.enum(["accept", "decline"]);
export type InviteResponseAction = z.infer<typeof InviteResponseActionSchema>;
