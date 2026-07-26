// ===========================================================================
// The OurLife model — shared types for the plan, the projection, and pay stubs.
// ===========================================================================

export type GoalCategory =
  | "debt"
  | "travel"
  | "milestone"
  | "home"
  | "family"
  | "invest";

export interface Goal {
  id: string;
  name: string;
  /** Target month, "YYYY-MM". */
  targetMonth: string;
  cost: number;
  category: GoalCategory;
  fundedFrom: string;
  note?: string;
}

export interface Phase {
  id: string;
  name: string;
  span: string;
  months: number;
  focus: string;
  /** Combined monthly take-home during this phase. */
  monthlyNet: number;
  /** Target saved per month. */
  monthlySave: number;
  /** Ceiling on living + discretionary spend. */
  monthlySpendCap: number;
  /** Liquid savings at the end of the phase. */
  endBalance: number;
  funding: string[];
  milestones: string[];
  note?: string;
}

export interface ElevationPoint {
  label: string;
  /** "YYYY-MM" the value lands. */
  month: string;
  /** Balance in whole dollars. */
  value: number;
  sub: string;
  valley?: boolean;
}

export interface IncomeYear {
  year: number;
  partnerA: string;
  partnerB: string;
  /** Combined take-home per month, whole dollars. */
  netMonthly: number;
  note: string;
}

export interface Baseline {
  householdName: string;
  partnerA: string;
  partnerB: string;
  /** Liquid house-down-payment seed today. */
  startingSavings: number;
  /** Combined take-home per month today. */
  monthlyTakeHome: number;
  goals: Goal[];
  phases: Phase[];
  elevation: ElevationPoint[];
  income: IncomeYear[];
}

// --- pay stubs (mirrors the pay_stubs table) -------------------------------
export interface PayStub {
  id: string;
  earner: string;
  employer: string | null;
  /** "YYYY-MM-DD" */
  pay_date: string;
  gross_amount: number;
  net_amount: number;
  taxes: number;
  retirement_contrib: number;
  other_deductions: number;
  is_commission: boolean;
  notes: string | null;
  /** Which household member this paycheck belongs to. */
  member_user_id?: string | null;
}

export interface MonthlyActual {
  /** "YYYY-MM" */
  month: string;
  net: number;
  gross: number;
  count: number;
}

export interface EarnerTotals {
  earner: string;
  gross: number;
  net: number;
  count: number;
}
