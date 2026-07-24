import type { Baseline } from "./types";

// ===========================================================================
// SAMPLE baseline — a template only. It ships in the repo so the app renders
// something on first run. Your real household's numbers (names, incomes,
// savings, debts, the actual plan) live in the private database and override
// this the moment you're signed in. Nothing here is anyone's real financial data.
// ===========================================================================
export const SAMPLE_BASELINE: Baseline = {
  householdName: "Sample household",
  partnerA: "Partner A",
  partnerB: "Partner B",
  startingSavings: 60000,
  monthlyTakeHome: 9500,
  isSample: true,

  income: [
    { year: 2026, partnerA: "$70K", partnerB: "$85K", netMonthly: 9500, note: "Sample starting point." },
    { year: 2027, partnerA: "$78K", partnerB: "$88K", netMonthly: 10200, note: "Modest raises." },
    { year: 2028, partnerA: "$110K", partnerB: "$90K", netMonthly: 12500, note: "Promotion lands." },
    { year: 2029, partnerA: "$140K", partnerB: "$55K", netMonthly: 12000, note: "Home + first child; one partner part-time." },
    { year: 2031, partnerA: "$160K", partnerB: "$40K", netMonthly: 12800, note: "Second child." },
    { year: 2036, partnerA: "$210K", partnerB: "$45K", netMonthly: 15000, note: "Ten-year mark." },
  ],

  goals: [
    { id: "debt", name: "Clear credit-card debt", targetMonth: "2026-11", cost: 2000, category: "debt", fundedFrom: "Cash flow — first" },
    { id: "trip1", name: "International trip", targetMonth: "2027-05", cost: 8000, category: "travel", fundedFrom: "Monthly savings" },
    { id: "ring", name: "Engagement ring", targetMonth: "2027-08", cost: 12000, category: "milestone", fundedFrom: "Monthly savings" },
    { id: "wedding", name: "Wedding (net)", targetMonth: "2028-10", cost: 24000, category: "milestone", fundedFrom: "Monthly savings" },
    { id: "home", name: "First home — down payment", targetMonth: "2029-02", cost: 100000, category: "home", fundedFrom: "Seed + savings" },
    { id: "baby1", name: "First child", targetMonth: "2029-11", cost: 11000, category: "family", fundedFrom: "Savings" },
    { id: "baby2", name: "Second child", targetMonth: "2031-06", cost: 11000, category: "family", fundedFrom: "Savings" },
    { id: "vacation", name: "Vacation home — down payment", targetMonth: "2036-06", cost: 75000, category: "home", fundedFrom: "Savings" },
  ],

  phases: [
    {
      id: "P1", name: "Save & Explore", span: "2026 – 2027", months: 17,
      focus: "Clear debt, bank hard, fund a couple of trips and the ring from cash flow.",
      monthlyNet: 10000, monthlySave: 4000, monthlySpendCap: 6800, endBalance: 104000,
      funding: ["Debt payoff", "Travel", "Ring", "Seed growth"],
      milestones: ["Clear the card", "Two trips", "Ring → engaged", "~$104K, seed intact"],
    },
    {
      id: "P2", name: "Wedding & Big Trip", span: "2028", months: 12,
      focus: "Pay for the wedding and a last big trip while stockpiling the down-payment war chest.",
      monthlyNet: 12500, monthlySave: 5200, monthlySpendCap: 7300, endBalance: 135000,
      funding: ["Wedding", "Travel", "Down-payment war chest"],
      milestones: ["Promotion", "Last big trip", "Wedding paid", "War chest ~$135K"],
    },
    {
      id: "P3", name: "Home + First Child", span: "2029", months: 12,
      focus: "Buy the home early, before the baby, while income and reserves are full.",
      monthlyNet: 12000, monthlySave: 3000, monthlySpendCap: 9000, endBalance: 65000,
      funding: ["Home down payment", "First child"],
      milestones: ["Buy the home", "Housing carry rises", "One partner part-time", "First child"],
    },
    {
      id: "P4", name: "Two Under One Roof", span: "2030 – 2032", months: 36,
      focus: "Absorb childcare and a second child on one strong income; rebuild reserves.",
      monthlyNet: 12800, monthlySave: 3000, monthlySpendCap: 9800, endBalance: 155000,
      funding: ["Second child", "Reserve rebuild"],
      milestones: ["Daycare begins", "Second child", "Grow the emergency fund", "~$155K liquid"],
    },
    {
      id: "P5", name: "Build Toward the Vacation Home", span: "2033 – 2036", months: 48,
      focus: "As childcare eases, accumulate for the second home; buy once the kids are older.",
      monthlyNet: 14000, monthlySave: 4500, monthlySpendCap: 9500, endBalance: 300000,
      funding: ["Vacation home", "Long-term reserves"],
      milestones: ["Childcare eases", "Income matures", "Buy the vacation home", "~$300K + two homes"],
    },
  ],

  elevation: [
    { label: "'26", month: "2026-07", value: 60000, sub: "start" },
    { label: "'27", month: "2027-12", value: 104000, sub: "ring + trips paid" },
    { label: "'28", month: "2028-12", value: 135000, sub: "wedding paid" },
    { label: "'29", month: "2029-12", value: 65000, sub: "home + child", valley: true },
    { label: "'32", month: "2032-12", value: 155000, sub: "second child" },
    { label: "'36", month: "2036-12", value: 300000, sub: "+ vacation home" },
  ],
};
