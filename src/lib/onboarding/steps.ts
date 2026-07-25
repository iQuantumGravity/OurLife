import type { OnboardingAnswers } from "./schema";

// ===========================================================================
// The onboarding question set. Two interleaved tracks -- "life" runs first,
// "money" unlocks once life is done (see canEnterMoneyTrack in data.ts) --
// but every step is independently skippable and resumable: the wizard saves
// after each step and can be re-entered at whatever step is next.
//
// `field` keys match OnboardingAnswers 1:1 (src/lib/onboarding/schema.ts),
// which in turn match the typed columns in 0004_onboarding.sql.
// ===========================================================================

export type FieldKey = keyof OnboardingAnswers;

interface BaseStep {
  id: string;
  track: "life" | "money";
  title: string;
  subtitle?: string;
  /** Every step is skippable by design; this is here for clarity, not choice. */
  skippable: true;
  /** Hide this step given the answers gathered so far (e.g. no partner -> no marriage timeline). */
  showIf?: (answers: Partial<OnboardingAnswers>) => boolean;
}

export interface YesNoStep extends BaseStep {
  kind: "yesno";
  field: FieldKey;
  yesLabel: string;
  noLabel: string;
}

export interface SelectStep extends BaseStep {
  kind: "select";
  field: FieldKey;
  options: { value: string; label: string }[];
}

export interface TextStep extends BaseStep {
  kind: "text" | "textarea" | "number";
  field: FieldKey;
  placeholder?: string;
}

export interface PartnerStepConfig extends BaseStep {
  kind: "partner";
  field: "hasPartner";
  yesLabel: string;
  noLabel: string;
}

export interface GoalsStepConfig extends BaseStep {
  kind: "goals";
}

export interface DebtStepConfig extends BaseStep {
  kind: "debt";
}

export interface CtaStepConfig extends BaseStep {
  kind: "plaid_cta" | "upload_cta";
}

// `mode_select` and `comparison` are synthetic wizard *stages* (see
// src/lib/onboarding/progress.ts), derived from state rather than answered
// like a normal step -- they're deliberately not part of this union.
export type Step =
  | YesNoStep
  | SelectStep
  | TextStep
  | PartnerStepConfig
  | GoalsStepConfig
  | DebtStepConfig
  | CtaStepConfig;

const hasPartner = (a: Partial<OnboardingAnswers>) => a.hasPartner === true;
const isMarried = (a: Partial<OnboardingAnswers>) => a.married === true;
const wantsToMarry = (a: Partial<OnboardingAnswers>) =>
  hasPartner(a) && !isMarried(a) && a.planToMarry === true;
const hasKids = (a: Partial<OnboardingAnswers>) =>
  a.kidsStatus === "has" || a.kidsStatus === "wants";

export const LIFE_STEPS: Step[] = [
  {
    id: "partner",
    track: "life",
    kind: "partner",
    title: "Do you have a partner you'd like to add?",
    subtitle:
      "Search for them by email or phone number. If they don't have an account yet, we'll send an invite link — they can create one and then accept or decline collaborating on the plan with you.",
    field: "hasPartner",
    yesLabel: "Yes, invite them",
    noLabel: "Not right now",
    skippable: true,
  },
  {
    id: "married",
    track: "life",
    kind: "yesno",
    title: "Are you two married?",
    subtitle: "No judgment either way — this just shapes a few defaults.",
    field: "married",
    yesLabel: "Yes",
    noLabel: "Not yet",
    skippable: true,
    showIf: hasPartner,
  },
  {
    id: "plan_to_marry",
    track: "life",
    kind: "yesno",
    title: "Do you plan to get married?",
    field: "planToMarry",
    yesLabel: "Yes",
    noLabel: "No plans to",
    skippable: true,
    showIf: (a) => hasPartner(a) && !isMarried(a),
  },
  {
    id: "marriage_timeline",
    track: "life",
    kind: "text",
    title: "What's the timeline?",
    subtitle: "A rough idea is plenty — \"next summer\" or \"a couple years out\" both work.",
    field: "marriageTimeline",
    placeholder: "e.g. Spring 2027",
    skippable: true,
    showIf: wantsToMarry,
  },
  {
    id: "kids_status",
    track: "life",
    kind: "select",
    title: "Kids in the picture?",
    subtitle: "Wherever you are with this, it helps the plan account for it honestly.",
    field: "kidsStatus",
    options: [
      { value: "none", label: "Not planning to" },
      { value: "wants", label: "Want kids someday" },
      { value: "has", label: "Already have kids" },
    ],
    skippable: true,
  },
  {
    id: "kids_count",
    track: "life",
    kind: "number",
    title: "How many?",
    field: "kidsCount",
    placeholder: "e.g. 2",
    skippable: true,
    showIf: hasKids,
  },
  {
    id: "kids_timeline_years",
    track: "life",
    kind: "number",
    title: "If not yet — how many years out, roughly?",
    field: "kidsTimelineYears",
    placeholder: "e.g. 3",
    skippable: true,
    showIf: (a) => a.kidsStatus === "wants",
  },
  {
    id: "location",
    track: "life",
    kind: "text",
    title: "Where are you two putting down roots?",
    subtitle: "City and state is plenty — this shapes cost-of-living assumptions.",
    field: "location",
    placeholder: "e.g. Denver, CO",
    skippable: true,
  },
  {
    id: "retirement_age",
    track: "life",
    kind: "number",
    title: "What age are you hoping to retire, or slow way down?",
    field: "retirementAge",
    placeholder: "e.g. 60",
    skippable: true,
  },
  {
    id: "goals",
    track: "life",
    kind: "goals",
    title: "What are you two working toward?",
    subtitle: "Add a few — a house, a trip, paying off a loan. You can reorder or edit these anytime.",
    skippable: true,
  },
  {
    id: "vision",
    track: "life",
    kind: "textarea",
    title: "In your own words — what does the life you're building look like?",
    subtitle: "No wrong answer here. This is just for you two to look back on.",
    field: "vision",
    placeholder: "Write as much or as little as you'd like…",
    skippable: true,
  },
];

export const MONEY_STEPS: Step[] = [
  {
    id: "income_type",
    track: "money",
    kind: "select",
    title: "How does your income mostly come in?",
    field: "incomeType",
    options: [
      { value: "salary", label: "Salary" },
      { value: "hourly", label: "Hourly" },
      { value: "commission", label: "Commission" },
      { value: "self_employed", label: "Self-employed" },
      { value: "mixed", label: "A mix" },
      { value: "other", label: "Something else" },
    ],
    skippable: true,
  },
  {
    id: "debt",
    track: "money",
    kind: "debt",
    title: "Any debt worth planning around?",
    subtitle: "Credit cards, student loans, car payments — whatever's real for you right now.",
    skippable: true,
  },
  {
    id: "current_savings",
    track: "money",
    kind: "number",
    title: "Roughly what's in savings today?",
    subtitle: "A ballpark number is fine — you can log exact figures later.",
    field: "currentSavings",
    placeholder: "e.g. 15000",
    skippable: true,
  },
  {
    id: "risk_tolerance",
    track: "money",
    kind: "select",
    title: "How do you feel about risk with money you're investing?",
    field: "riskTolerance",
    options: [
      { value: "conservative", label: "Play it safe" },
      { value: "moderate", label: "Balanced" },
      { value: "aggressive", label: "Comfortable with ups and downs" },
    ],
    skippable: true,
  },
  {
    id: "plaid",
    track: "money",
    kind: "plaid_cta",
    title: "Want to link a bank account?",
    subtitle: "This is where the plan starts updating itself. Totally optional, and you can do it anytime from Accounts.",
    skippable: true,
  },
  {
    id: "upload",
    track: "money",
    kind: "upload_cta",
    title: "Have a statement or pay stub handy?",
    subtitle: "Snap a photo or upload a PDF and we'll read it in — a check, an invoice, a bank statement all work.",
    skippable: true,
  },
];

export function stepsForTrack(track: "life" | "money"): Step[] {
  return track === "life" ? LIFE_STEPS : MONEY_STEPS;
}

export function visibleSteps(
  steps: Step[],
  answers: Partial<OnboardingAnswers>,
): Step[] {
  return steps.filter((s) => !s.showIf || s.showIf(answers));
}
