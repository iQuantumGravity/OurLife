import type { OnboardingAnswers } from "./schema";
import { LIFE_STEPS, MONEY_STEPS, visibleSteps, type Step } from "./steps";

/** Recorded in skippedFields when someone chooses not to wait for a partner. */
export const PARTNER_WAIT_SKIP = "partner_wait";

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

export interface StageInput {
  answers: Partial<OnboardingAnswers>;
  mode: "individual" | "couple";
  extra: ProgressExtras;
  /** A second person has actually joined the household. */
  partnerExists: boolean;
  /** That person has finished their own Life track. */
  partnerLifeDone: boolean;
}

export function deriveStage({
  answers,
  mode,
  extra,
  partnerExists,
  partnerLifeDone,
}: StageInput): WizardStage {
  if (!extra.stateExists) return { kind: "mode_select" };

  // A completed track is checked BEFORE its step loop. Otherwise a step whose
  // "answered" state is derived from live data -- the Plaid and upload CTAs
  // read from real connections/documents -- would yank a finished user back
  // into the wizard the moment they deleted a statement.
  if (!answers.lifeTrackCompletedAt) {
    const life = visibleSteps(LIFE_STEPS, answers);
    const idx = life.findIndex((s) => !isStepAnswered(s, answers, extra));
    if (idx !== -1) {
      return { kind: "step", step: life[idx], track: "life", index: idx, total: life.length };
    }
    return { kind: "life_complete" };
  }

  // The comparison only makes sense when someone is actually there to compare
  // with. Gating on `mode === "couple"` alone stranded anyone who picked couple
  // mode and then never invited a partner (or whose partner never joined) --
  // and because the money track sits behind this gate, it also blocked the
  // bank-link and upload steps, which must never be blocked.
  const waived = answers.skippedFields?.includes(PARTNER_WAIT_SKIP) ?? false;
  if (mode === "couple" && partnerExists && !waived) {
    if (!partnerLifeDone) return { kind: "waiting_on_partner" };
    if (!answers.comparisonViewedAt) return { kind: "comparison" };
  }

  if (!answers.moneyTrackCompletedAt) {
    const money = visibleSteps(MONEY_STEPS, answers);
    const idx = money.findIndex((s) => !isStepAnswered(s, answers, extra));
    if (idx !== -1) {
      return { kind: "step", step: money[idx], track: "money", index: idx, total: money.length };
    }
    return { kind: "money_complete" };
  }

  return { kind: "done" };
}

/** Overall progress: life steps + (couple ? comparison : 0) + money steps. */
export function overallProgress(
  answers: Partial<OnboardingAnswers>,
  mode: "individual" | "couple",
  extra: ProgressExtras,
  partnerExists: boolean,
): { done: number; total: number } {
  const life = visibleSteps(LIFE_STEPS, answers);
  const money = visibleSteps(MONEY_STEPS, answers);

  const lifeDone = answers.lifeTrackCompletedAt
    ? life.length
    : life.filter((s) => isStepAnswered(s, answers, extra)).length;

  // Counted whether or not the Life track is finished -- someone who links a
  // bank early (which the product explicitly invites) should see the credit.
  const moneyDone = answers.moneyTrackCompletedAt
    ? money.length
    : money.filter((s) => isStepAnswered(s, answers, extra)).length;

  const comparisonTotal = mode === "couple" && partnerExists ? 1 : 0;
  const comparisonDone =
    comparisonTotal && answers.comparisonViewedAt ? 1 : 0;

  return {
    done: Math.min(lifeDone + comparisonDone + moneyDone, life.length + comparisonTotal + money.length),
    total: life.length + comparisonTotal + money.length,
  };
}
