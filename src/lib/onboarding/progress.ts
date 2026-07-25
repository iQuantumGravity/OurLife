import type { OnboardingAnswers } from "./schema";
import { LIFE_STEPS, MONEY_STEPS, visibleSteps, type Step } from "./steps";

export interface ProgressExtras {
  stateExists: boolean;
  hasPlaidConnection: boolean;
  hasDocument: boolean;
}

export function isStepAnswered(
  step: Step,
  a: Partial<OnboardingAnswers>,
  extra: ProgressExtras,
): boolean {
  if (a.skippedFields?.includes(step.id)) return true;

  switch (step.kind) {
    case "yesno":
    case "select":
    case "number":
      return a[step.field] !== null && a[step.field] !== undefined;
    case "text":
    case "textarea":
      return (
        a[step.field] !== null &&
        a[step.field] !== undefined &&
        a[step.field] !== ""
      );
    case "partner":
      return a.hasPartner !== null && a.hasPartner !== undefined;
    case "goals":
      return (a.topGoals?.length ?? 0) > 0;
    case "debt":
      return (a.existingDebt?.length ?? 0) > 0;
    case "plaid_cta":
      return extra.hasPlaidConnection;
    case "upload_cta":
      return extra.hasDocument;
  }
}

export type WizardStage =
  | { kind: "mode_select" }
  | { kind: "step"; step: Step; track: "life" | "money"; index: number; total: number }
  | { kind: "life_complete" }
  | { kind: "waiting_on_partner" }
  | { kind: "comparison" }
  | { kind: "money_complete" }
  | { kind: "done" };

export function deriveStage(
  answers: Partial<OnboardingAnswers>,
  mode: "individual" | "couple",
  extra: ProgressExtras,
  partnerLifeDone: boolean,
  comparisonViewed: boolean,
): WizardStage {
  if (!extra.stateExists) return { kind: "mode_select" };

  const life = visibleSteps(LIFE_STEPS, answers);
  const lifeIdx = life.findIndex((s) => !isStepAnswered(s, answers, extra));
  if (lifeIdx !== -1) {
    return { kind: "step", step: life[lifeIdx], track: "life", index: lifeIdx, total: life.length };
  }
  if (!answers.lifeTrackCompletedAt) return { kind: "life_complete" };

  if (mode === "couple") {
    if (!partnerLifeDone) return { kind: "waiting_on_partner" };
    if (!comparisonViewed) return { kind: "comparison" };
  }

  const money = visibleSteps(MONEY_STEPS, answers);
  const moneyIdx = money.findIndex((s) => !isStepAnswered(s, answers, extra));
  if (moneyIdx !== -1) {
    return { kind: "step", step: money[moneyIdx], track: "money", index: moneyIdx, total: money.length };
  }
  if (!answers.moneyTrackCompletedAt) return { kind: "money_complete" };

  return { kind: "done" };
}

/** Overall progress bar: life steps + (couple ? comparison : 0) + money steps. */
export function overallProgress(
  answers: Partial<OnboardingAnswers>,
  mode: "individual" | "couple",
  extra: ProgressExtras,
  comparisonViewed: boolean,
): { done: number; total: number } {
  const life = visibleSteps(LIFE_STEPS, answers);
  const money = visibleSteps(MONEY_STEPS, answers);
  const lifeDone = life.filter((s) => isStepAnswered(s, answers, extra)).length;
  const moneyDone = answers.lifeTrackCompletedAt
    ? money.filter((s) => isStepAnswered(s, answers, extra)).length
    : 0;
  const comparisonTotal = mode === "couple" ? 1 : 0;
  const comparisonDone = mode === "couple" && comparisonViewed ? 1 : 0;

  return {
    done: lifeDone + comparisonDone + moneyDone,
    total: life.length + comparisonTotal + money.length,
  };
}
