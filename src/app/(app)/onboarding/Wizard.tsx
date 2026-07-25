"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingAnswers, OnboardingMode } from "@/lib/onboarding/schema";
import { deriveStage, overallProgress } from "@/lib/onboarding/progress";
import type { Step } from "@/lib/onboarding/steps";
import type { InviteRow } from "@/lib/onboarding/data";
import { saveStep, skipField, setMode, completeTrack, markComparisonViewed } from "./actions";
import { PartnerStep } from "./PartnerStep";
import { GoalsStep } from "./GoalsStep";
import { DebtStep } from "./DebtStep";
import { Comparison } from "./Comparison";

interface Props {
  mode: OnboardingMode;
  stateExists: boolean;
  answers: OnboardingAnswers;
  partnerAnswers: OnboardingAnswers | null;
  partnerName: string | null;
  comparisonViewed: boolean;
  hasPlaidConnection: boolean;
  hasDocument: boolean;
  invites: InviteRow[];
}

export function Wizard(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const extra = {
    stateExists: props.stateExists,
    hasPlaidConnection: props.hasPlaidConnection,
    hasDocument: props.hasDocument,
  };
  const stage = deriveStage(
    props.answers,
    props.mode,
    extra,
    Boolean(props.partnerAnswers?.lifeTrackCompletedAt),
    props.comparisonViewed,
  );
  const progress = overallProgress(props.answers, props.mode, extra, props.comparisonViewed);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleModeSelect(m: OnboardingMode) {
    await setMode(m);
    refresh();
  }

  async function handleSave(field: keyof OnboardingAnswers, value: unknown) {
    await saveStep({ [field]: value } as any);
    refresh();
  }

  async function handleSkip(stepId: string) {
    await skipField(stepId);
    refresh();
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <header>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Onboarding
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-teal transition-all"
            style={{
              width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
            }}
          />
        </div>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted">
          {progress.done} of {progress.total} · always skippable, never blocks connecting a bank or uploading a statement
        </p>
      </header>

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {stage.kind === "mode_select" && (
          <StepShell title="How should we set this up?" subtitle="Planning solo, or with someone? You can add a partner later too.">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleModeSelect("individual")}
                className="flex-1 rounded-card border border-line bg-raised px-4 py-3 text-left transition hover:border-teal"
              >
                <div className="font-medium text-fg">Just me</div>
                <div className="mt-1 text-sm text-muted">Plan on your own for now.</div>
              </button>
              <button
                type="button"
                onClick={() => handleModeSelect("couple")}
                className="flex-1 rounded-card border border-line bg-raised px-4 py-3 text-left transition hover:border-teal"
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
            onSave={handleSave}
            onSkip={handleSkip}
            onAdvance={refresh}
          />
        )}

        {stage.kind === "life_complete" && (
          <StepShell title="That's the Life track done." subtitle="Nice. Now let's get the money side of the picture.">
            <ContinueButton
              onClick={async () => {
                await completeTrack("life");
                refresh();
              }}
            />
          </StepShell>
        )}

        {stage.kind === "waiting_on_partner" && (
          <StepShell
            title={`Waiting on ${props.partnerName ?? "your partner"}.`}
            subtitle="Once they've finished their Life track, you'll both see how your answers compare. Feel free to come back later — nothing here is blocking you from connecting a bank account or uploading a statement in the meantime."
          >
            <button
              type="button"
              onClick={refresh}
              className="rounded-card border border-line px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-muted hover:border-teal hover:text-teal"
            >
              Check again
            </button>
          </StepShell>
        )}

        {stage.kind === "comparison" && props.partnerAnswers && (
          <Comparison
            mine={props.answers}
            partner={props.partnerAnswers}
            partnerName={props.partnerName}
            onContinue={async () => {
              await markComparisonViewed();
              refresh();
            }}
          />
        )}

        {stage.kind === "money_complete" && (
          <StepShell title="Money track done too." subtitle="That's everything — your plan now reflects the two of you.">
            <ContinueButton
              onClick={async () => {
                await completeTrack("money");
                refresh();
              }}
            />
          </StepShell>
        )}

        {stage.kind === "done" && (
          <StepShell title="You're all set." subtitle="Head to your dashboard to see it come together. You can revisit any of this anytime.">
            <a
              href="/dashboard"
              className="inline-block rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
            >
              Go to dashboard
            </a>
          </StepShell>
        )}
      </div>
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

function ContinueButton({ onClick, label = "Continue" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
    >
      {label}
    </button>
  );
}

function SkipLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-clay"
    >
      Skip for now
    </button>
  );
}

// --- generic + custom step renderer -----------------------------------------

function StepRenderer({
  step,
  answers,
  invites,
  onSave,
  onSkip,
  onAdvance,
}: {
  step: Step;
  answers: OnboardingAnswers;
  invites: InviteRow[];
  onSave: (field: keyof OnboardingAnswers, value: unknown) => Promise<void>;
  onSkip: (stepId: string) => Promise<void>;
  onAdvance: () => void;
}) {
  if (step.kind === "partner") {
    return (
      <PartnerStep
        step={step}
        hasPartner={answers.hasPartner}
        invites={invites}
        onAnswer={async (v) => onSave("hasPartner", v)}
        onSkip={() => onSkip(step.id)}
      />
    );
  }
  if (step.kind === "goals") {
    return (
      <GoalsStep
        step={step}
        goals={answers.topGoals}
        onSave={async (goals) => onSave("topGoals", goals)}
        onSkip={() => onSkip(step.id)}
      />
    );
  }
  if (step.kind === "debt") {
    return (
      <DebtStep
        step={step}
        debts={answers.existingDebt}
        onSave={async (debts) => onSave("existingDebt", debts)}
        onSkip={() => onSkip(step.id)}
      />
    );
  }
  if (step.kind === "plaid_cta") {
    return (
      <StepShell title={step.title} subtitle={step.subtitle}>
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/accounts"
            className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
          >
            Go connect a bank
          </a>
          <SkipLink onClick={() => onSkip(step.id)} />
        </div>
      </StepShell>
    );
  }
  if (step.kind === "upload_cta") {
    return (
      <StepShell title={step.title} subtitle={step.subtitle}>
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/uploads"
            className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
          >
            Go upload something
          </a>
          <SkipLink onClick={() => onSkip(step.id)} />
        </div>
      </StepShell>
    );
  }

  // yesno / select / text / textarea / number
  const genericStep = step as Extract<Step, { kind: "yesno" | "select" | "text" | "textarea" | "number" }>;
  return (
    <GenericField
      step={genericStep}
      value={(answers as any)[genericStep.field]}
      onSave={(v) => onSave(genericStep.field, v)}
      onSkip={() => onSkip(genericStep.id)}
    />
  );
}

function GenericField({
  step,
  value,
  onSave,
  onSkip,
}: {
  step: Extract<Step, { kind: "yesno" | "select" | "text" | "textarea" | "number" }>;
  value: unknown;
  onSave: (value: unknown) => Promise<void>;
  onSkip: () => Promise<void>;
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
            onClick={() => onSave(true)}
            className="rounded-card border border-line bg-sunken px-4 py-2.5 font-medium text-fg transition hover:border-teal"
          >
            {step.yesLabel}
          </button>
          <button
            type="button"
            onClick={() => onSave(false)}
            className="rounded-card border border-line bg-sunken px-4 py-2.5 font-medium text-fg transition hover:border-teal"
          >
            {step.noLabel}
          </button>
          <SkipLink onClick={onSkip} />
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
                onClick={() => onSave(opt.value)}
                className="rounded-full border border-line px-4 py-2 text-sm text-fg transition hover:border-teal hover:text-teal"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <SkipLink onClick={onSkip} />
        </div>
      </StepShell>
    );
  }

  const isTextarea = step.kind === "textarea";
  const inputType = step.kind === "number" ? "number" : "text";

  return (
    <StepShell title={step.title} subtitle={step.subtitle}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const v = step.kind === "number" ? (draft === "" ? null : Number(draft)) : draft || null;
          onSave(v);
        }}
      >
        {isTextarea ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={step.placeholder}
            rows={5}
            className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
          />
        ) : (
          <input
            type={inputType}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={step.placeholder}
            className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
          />
        )}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
          >
            Continue
          </button>
          <SkipLink onClick={onSkip} />
        </div>
      </form>
    </StepShell>
  );
}
