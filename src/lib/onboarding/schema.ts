import { z } from "zod";

// ===========================================================================
// Structured onboarding answers. Field names and enum values here match the
// typed columns in supabase/migrations/0004_onboarding.sql 1:1, so a saved
// answer round-trips cleanly between the wizard, the database, and whatever
// in the planning engine consumes it later.
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
  priority: z.number().int().min(1).max(5),
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

// --- Life track -------------------------------------------------------------
export const LifeTrackAnswersSchema = z.object({
  relationshipStatus: RelationshipStatusSchema.nullable().default(null),
  hasPartner: z.boolean().nullable().default(null),
  married: z.boolean().nullable().default(null),
  planToMarry: z.boolean().nullable().default(null),
  marriageTimeline: z.string().max(120).nullable().default(null),
  kidsStatus: KidsStatusSchema.nullable().default(null),
  kidsCount: z.number().int().min(0).max(20).nullable().default(null),
  kidsTimelineYears: z.number().int().min(0).max(40).nullable().default(null),
  retirementAge: z.number().int().min(30).max(90).nullable().default(null),
  location: z.string().max(120).nullable().default(null),
  vision: z.string().max(2000).nullable().default(null),
  topGoals: z.array(OnboardingGoalSchema).max(10).default([]),
});
export type LifeTrackAnswers = z.infer<typeof LifeTrackAnswersSchema>;

// --- Money track -------------------------------------------------------------
export const MoneyTrackAnswersSchema = z.object({
  incomeType: IncomeTypeSchema.nullable().default(null),
  existingDebt: z.array(DebtItemSchema).max(20).default([]),
  currentSavings: z.number().nonnegative().nullable().default(null),
  riskTolerance: RiskToleranceSchema.nullable().default(null),
});
export type MoneyTrackAnswers = z.infer<typeof MoneyTrackAnswersSchema>;

// --- Combined, as stored (one row per household+user) -----------------------
export const OnboardingAnswersSchema = LifeTrackAnswersSchema.merge(
  MoneyTrackAnswersSchema,
).extend({
  /** Per-person progress -- each partner moves through Life independently. */
  lifeTrackCompletedAt: z.string().nullable().default(null),
  moneyTrackCompletedAt: z.string().nullable().default(null),
  skippedFields: z.array(z.string()).default([]),
  raw: z.record(z.string(), z.unknown()).default({}),
});
export type OnboardingAnswers = z.infer<typeof OnboardingAnswersSchema>;

// Every field optional, for step-by-step partial saves.
export const OnboardingAnswersPatchSchema = OnboardingAnswersSchema.partial();
export type OnboardingAnswersPatch = z.infer<typeof OnboardingAnswersPatchSchema>;

export const emptyOnboardingAnswers: OnboardingAnswers =
  OnboardingAnswersSchema.parse({});

// --- Onboarding state (shared, household-level settings) --------------------
export const OnboardingStateSchema = z.object({
  mode: OnboardingModeSchema.default("individual"),
  comparisonViewedAt: z.string().nullable().default(null),
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

// --- Fields the couple-mode comparison screen cares about --------------------
export const COMPARABLE_FIELDS = [
  "retirementAge",
  "kidsStatus",
  "kidsCount",
  "riskTolerance",
] as const;
