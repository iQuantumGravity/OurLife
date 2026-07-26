"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingAnswers, OnboardingMode } from "@/lib/onboarding/schema";
import { deriveStage, overallProgress } from "@/lib/onboarding/progress";
import type { Step } from "@/lib/onboarding/steps";
import type { InviteRow } from "@/lib/onboarding/data";
import {
  saveStep,
  skipStep,
  setMode,
  completeTrack,
  markComparisonViewed,
  waivePartnerWait,
} from "./actions";
import { PartnerStep } from "./PartnerStep";
import { GoalsStep } from "./GoalsStep";
import { DebtStep } from "./DebtStep";
import { Comparison } from "./Comparison";
import { PlaidConnect } from "@/app/(app)/accounts/PlaidConnect";
import { Uploader } from "@/app/(app)/records/Uploader";
import { VoiceButton, appendSpoken } from "@/components/VoiceInput";

type ActionResult = { ok?: true; error?: string } | undefined;

interface Props {
  mode: OnboardingMode;
  stateExists: boolean;
  answers: OnboardingAnswers;
  partnerAnswers: OnboardingAnswers | null;
  partnerName: string | null;
  partnerExists: boolean;
  householdId: string;
  hasPlaidConnection: boolean;
  hasDocument: boolean;
  invites: InviteRow[];
}

export function Wizard(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extra = {
    stateExists: props.stateExists,
    hasPlaidConnection: props.hasPlaidConnection,
    hasDocument: props.hasDocument,
  };
  const stage = deriveStage({
    answers: props.answers,
    mode: props.mode,
    extra,
    partnerExists: props.partnerExists,
    partnerLifeDone: Boolean(props.partnerAnswers?.lifeTrackCompletedAt),
  });
  const progress = overallProgress(
    props.answers,
    props.mode,
    extra,
    props.partnerExists,
  );
  const locked = busy || pending;

  /** Runs an action, surfaces its error, and only refreshes on success. */
  async function run(fn: () => Promise<ActionResult>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res?.error) {
        setError(res.error);
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError("Something went wrong saving that. Try again?");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const pct = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <header>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Onboarding
        </div>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-teal transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted">
          {progress.done} of {progress.total} · skip anything, come back anytime
        </p>
      </header>

      {error && (
        <p className="rounded-card border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </p>
      )}

      <div className={locked ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {stage.kind === "mode_select" && (
          <StepShell
            title="How should we set this up?"
            subtitle="Planning solo, or with someone? You can change this later — nothing here is permanent."
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={locked}
                onClick={() => run(() => setMode("individual"))}
                className="flex-1 rounded-card border border-line bg-sunken px-4 py-3 text-left transition hover:border-teal disabled:opacity-50"
              >
                <div className="font-medium text-fg">Just me</div>
                <div className="mt-1 text-sm text-muted">Plan on your own for now.</div>
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => run(() => setMode("couple"))}
                className="flex-1 rounded-card border border-line bg-sunken px-4 py-3 text-left transition hover:border-teal disabled:opacity-50"
              >
                <div className="font-medium text-fg">Me &amp; a partner</div>
                <div className="mt-1 text-sm text-muted">Plan together, side by side.</div>
              </button>
            </div>
          </StepShell>
        )}

        {stage.kind === "step" && (
          <StepRenderer
            key={stage.step.id}
            step={stage.step}
            answers={props.answers}
            invites={props.invites}
            householdId={props.householdId}
            locked={locked}
            onSave={(field, value) => run(() => saveStep({ [field]: value } as any))}
            onSkip={(stepId) => run(() => skipStep(stepId))}
            onError={setError}
          />
        )}

        {stage.kind === "life_complete" && (
          <StepShell
            title="That's the Life track done."
            subtitle="Nice. Now the money side of the picture — or come back to it whenever."
          >
            <button
              type="button"
              disabled={locked}
              onClick={() => run(() => completeTrack("life"))}
              className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Continue
            </button>
          </StepShell>
        )}

        {stage.kind === "waiting_on_partner" && (
          <StepShell
            title={`Waiting on ${props.partnerName ?? "your partner"}.`}
            subtitle="Once they've finished their Life track you'll both see how your answers compare. No rush — and you don't have to wait if you'd rather keep going."
          >
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={locked}
                onClick={() => startTransition(() => router.refresh())}
                className="rounded-card border border-line px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-muted hover:border-teal hover:text-teal disabled:opacity-50"
              >
                Check again
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => run(() => waivePartnerWait())}
                className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Go on without them
              </button>
            </div>
            <p className="mt-4 text-xs text-muted">
              Linking a bank account and uploading statements are never blocked by
              this — you can do both right now from{" "}
              <a href="/accounts" className="text-teal hover:underline">Accounts</a> or{" "}
              <a href="/records?tab=statements" className="text-teal hover:underline">Statements</a>.
            </p>
          </StepShell>
        )}

        {stage.kind === "comparison" && props.partnerAnswers && (
          <Comparison
            mine={props.answers}
            partner={props.partnerAnswers}
            partnerName={props.partnerName}
            disabled={locked}
            onContinue={() => run(() => markComparisonViewed())}
          />
        )}

        {stage.kind === "money_complete" && (
          <StepShell
            title="Money track done too."
            subtitle="That's everything — your plan now reflects the two of you."
          >
            <button
              type="button"
              disabled={locked}
              onClick={() => run(() => completeTrack("money"))}
              className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Continue
            </button>
          </StepShell>
        )}

        {stage.kind === "done" && (
          <StepShell
            title="You're all set."
            subtitle="Head to your dashboard to see it come together. You can revisit any of this anytime."
          >
            <a
              href="/dashboard"
              className="inline-block rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
            >
              Go to dashboard
            </a>
          </StepShell>
        )}
      </div>

      {/* Mode is changeable after the fact, so an early mis-click is never a trap. */}
      {stage.kind !== "mode_select" && (
        <p className="text-xs text-muted">
          {props.mode === "couple" ? "Planning as a couple." : "Planning solo."}{" "}
          <button
            type="button"
            disabled={locked}
            onClick={() =>
              run(() => setMode(props.mode === "couple" ? "individual" : "couple"))
            }
            className="text-teal hover:underline disabled:opacity-50"
          >
            {props.mode === "couple" ? "Switch to just me" : "Switch to me & a partner"}
          </button>
        </p>
      )}
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-raised p-6">
      <h1 className="font-display text-2xl font-semibold leading-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function SkipLink({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-clay disabled:opacity-50"
    >
      Skip for now
    </button>
  );
}

// --- step renderer -----------------------------------------------------------

function StepRenderer({
  step,
  answers,
  invites,
  householdId,
  locked,
  onSave,
  onSkip,
  onError,
}: {
  step: Step;
  answers: OnboardingAnswers;
  invites: InviteRow[];
  householdId: string;
  locked: boolean;
  onSave: (field: keyof OnboardingAnswers, value: unknown) => Promise<boolean>;
  onSkip: (stepId: string) => Promise<boolean>;
  onError: (msg: string | null) => void;
}) {
  if (step.kind === "partner") {
    return (
      <PartnerStep
        step={step}
        hasPartner={answers.hasPartner}
        invites={invites}
        locked={locked}
        onAnswer={(v) => onSave("hasPartner", v)}
        onSkip={() => onSkip(step.id)}
        onError={onError}
      />
    );
  }
  if (step.kind === "goals") {
    return (
      <GoalsStep
        step={step}
        goals={answers.topGoals}
        locked={locked}
        onSave={(goals) => onSave("topGoals", goals)}
        onSkip={() => onSkip(step.id)}
      />
    );
  }
  if (step.kind === "debt") {
    return (
      <DebtStep
        step={step}
        debts={answers.existingDebt}
        locked={locked}
        onSave={(debts) => onSave("existingDebt", debts)}
        onSkip={() => onSkip(step.id)}
      />
    );
  }
  // Both of these used to be links that navigated away mid-wizard. If anything
  // went wrong over there — a Plaid error, say — you were stranded off-flow with
  // no way back to onboarding. They're inline now, so a failure is just a
  // message on the step and "Skip for now" always gets you past it.
  if (step.kind === "plaid_cta") {
    return (
      <StepShell title={step.title} subtitle={step.subtitle}>
        <PlaidConnect />
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <SkipLink onClick={() => onSkip(step.id)} disabled={locked} />
          <span className="text-xs text-muted">
            Optional — this never blocks the rest of setup.
          </span>
        </div>
      </StepShell>
    );
  }
  if (step.kind === "upload_cta") {
    return (
      <StepShell title={step.title} subtitle={step.subtitle}>
        {householdId ? (
          <Uploader householdId={householdId} />
        ) : (
          <p className="text-sm text-muted">Sign in to upload.</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <SkipLink onClick={() => onSkip(step.id)} disabled={locked} />
          <span className="text-xs text-muted">
            Optional — you can add statements any time from Records.
          </span>
        </div>
      </StepShell>
    );
  }

  const generic = step as Extract<
    Step,
    { kind: "yesno" | "select" | "text" | "textarea" | "number" }
  >;
  return (
    <GenericField
      step={generic}
      value={(answers as any)[generic.field]}
      locked={locked}
      onSave={(v) => onSave(generic.field, v)}
      onSkip={() => onSkip(generic.id)}
    />
  );
}

// Bounds mirror the Zod schema so the common mistakes are caught in the browser
// rather than coming back as a server-side validation error.
const NUMBER_BOUNDS: Record<string, { min: number; max: number; step?: number }> = {
  kidsCount: { min: 0, max: 20, step: 1 },
  kidsTimelineYears: { min: 0, max: 40, step: 1 },
  retirementAge: { min: 30, max: 90, step: 1 },
  currentSavings: { min: 0, max: 1_000_000_000, step: 1 },
};

function GenericField({
  step,
  value,
  locked,
  onSave,
  onSkip,
}: {
  step: Extract<Step, { kind: "yesno" | "select" | "text" | "textarea" | "number" }>;
  value: unknown;
  locked: boolean;
  onSave: (value: unknown) => Promise<boolean>;
  onSkip: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string>(
    value === null || value === undefined ? "" : String(value),
  );

  if (step.kind === "yesno") {
    return (
      <StepShell title={step.title} subtitle={step.subtitle}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={locked}
            onClick={() => onSave(true)}
            className="rounded-card border border-line bg-sunken px-4 py-2.5 font-medium text-fg transition hover:border-teal disabled:opacity-50"
          >
            {step.yesLabel}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => onSave(false)}
            className="rounded-card border border-line bg-sunken px-4 py-2.5 font-medium text-fg transition hover:border-teal disabled:opacity-50"
          >
            {step.noLabel}
          </button>
          <SkipLink onClick={onSkip} disabled={locked} />
        </div>
      </StepShell>
    );
  }

  if (step.kind === "select") {
    return (
      <StepShell title={step.title} subtitle={step.subtitle}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {step.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={locked}
                onClick={() => onSave(opt.value)}
                className="rounded-full border border-line px-4 py-2 text-sm text-fg transition hover:border-teal hover:text-teal disabled:opacity-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <SkipLink onClick={onSkip} disabled={locked} />
        </div>
      </StepShell>
    );
  }

  const isTextarea = step.kind === "textarea";
  const isEmpty = draft.trim() === "";
  const bounds = NUMBER_BOUNDS[step.field as string];

  return (
    <StepShell title={step.title} subtitle={step.subtitle}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          // An empty submit means "no answer" — treat it as an explicit skip so
          // the button always does something rather than silently re-rendering.
          if (isEmpty) {
            onSkip();
            return;
          }
          onSave(step.kind === "number" ? Number(draft) : draft);
        }}
      >
        {isTextarea ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={step.placeholder}
              rows={5}
              maxLength={2000}
              disabled={locked}
              className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal disabled:opacity-60"
            />
            <VoiceButton
              disabled={locked}
              label="Speak your answer"
              onText={(t) => setDraft((d) => appendSpoken(d, t))}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type={step.kind === "number" ? "number" : "text"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={step.placeholder}
              disabled={locked}
              inputMode={step.kind === "number" ? "numeric" : undefined}
              min={bounds?.min}
              max={bounds?.max}
              step={bounds?.step}
              maxLength={step.kind === "number" ? undefined : 120}
              className="flex-1 rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal disabled:opacity-60"
            />
            {step.kind !== "number" && (
              <VoiceButton
                disabled={locked}
                onText={(t) => setDraft((d) => appendSpoken(d, t))}
              />
            )}
          </div>
        )}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={locked}
            className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isEmpty ? "Skip this one" : "Continue"}
          </button>
          {!isEmpty && <SkipLink onClick={onSkip} disabled={locked} />}
        </div>
      </form>
    </StepShell>
  );
}
