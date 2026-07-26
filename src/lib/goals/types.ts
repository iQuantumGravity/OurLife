// ===========================================================================
// Goals: the buckets a couple's life actually divides into.
//
// A goal is scoped (shared dream vs. one person's own), bucketed, and
// fundable. Everything the storyboard and the daily-feedback engine need
// hangs off this shape.
// ===========================================================================

export const GOAL_SCOPES = ["shared", "individual"] as const;
export type GoalScope = (typeof GOAL_SCOPES)[number];

export const GOAL_BUCKETS = [
  "retirement",
  "home",
  "travel",
  "family",
  "debt",
  "purchase",
  "emergency",
  "invest",
  "education",
  "other",
] as const;
export type GoalBucket = (typeof GOAL_BUCKETS)[number];

export const GOAL_STATUSES = ["active", "achieved", "paused", "dropped"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface BucketMeta {
  label: string;
  blurb: string;
  /** Rough horizon, used to order buckets sensibly on the storyboard. */
  horizon: "near" | "mid" | "far";
}

export const BUCKET_META: Record<GoalBucket, BucketMeta> = {
  emergency: {
    label: "Safety net",
    blurb: "Money that buys you options when something goes wrong.",
    horizon: "near",
  },
  debt: {
    label: "Debt",
    blurb: "What you're clearing, and by when.",
    horizon: "near",
  },
  purchase: {
    label: "Purchases",
    blurb: "The smaller things — a laptop, a bike, a good mattress.",
    horizon: "near",
  },
  travel: {
    label: "Travel",
    blurb: "Places you want to see while you can.",
    horizon: "mid",
  },
  home: {
    label: "Home",
    blurb: "A deposit, a renovation, a move.",
    horizon: "mid",
  },
  family: {
    label: "Family",
    blurb: "Kids, care, the people you're responsible for.",
    horizon: "mid",
  },
  education: {
    label: "Learning",
    blurb: "Study, a course, a career change.",
    horizon: "mid",
  },
  invest: {
    label: "Investing",
    blurb: "Money you're deliberately putting to work.",
    horizon: "far",
  },
  retirement: {
    label: "Retirement",
    blurb: "The long arc — when you get to stop, and on what.",
    horizon: "far",
  },
  other: {
    label: "Other",
    blurb: "Everything that doesn't fit a neat box.",
    horizon: "mid",
  },
};

export interface Goal {
  id: string;
  householdId: string;
  scope: GoalScope;
  ownerUserId: string | null;
  bucket: GoalBucket;
  name: string;
  note: string | null;
  targetAmount: number | null;
  savedAmount: number;
  /** "YYYY-MM-DD" */
  targetDate: string | null;
  monthlyContribution: number | null;
  priority: number;
  status: GoalStatus;
  createdAt: string;
}

/** A goal with everything derived that the UI needs to draw it. */
export interface GoalProgress extends Goal {
  /** 0..1, or null when there's no target to measure against. */
  progress: number | null;
  remaining: number | null;
  /** Months until target_date; negative when overdue. Null when undated. */
  monthsToTarget: number | null;
  /**
   * Given the household's real monthly surplus, when this goal is projected to
   * be funded. Null when it can't be projected (no target, or no surplus).
   */
  projectedDate: string | null;
  /**
   * Months between the projected date and the wanted date. Positive = late.
   * This is the number that moves when you make an unplanned purchase.
   */
  slipMonths: number | null;
  onTrack: boolean | null;
}

export interface GoalEvent {
  id: string;
  goalId: string | null;
  kind: "allocation" | "spend" | "contribution" | "adjustment" | "achieved";
  amount: number;
  summary: string | null;
  source: "manual" | "plaid" | "document" | "assistant" | "system";
  createdAt: string;
}
