"use client";

import { useState } from "react";
import type { PartnerStepConfig } from "@/lib/onboarding/steps";
import type { InviteRow } from "@/lib/onboarding/data";
import { PartnerLink } from "@/app/(app)/account/PartnerLink";

export function PartnerStep({
  step,
  hasPartner,
  invites,
  locked,
  onAnswer,
  onSkip,
  onError,
}: {
  step: PartnerStepConfig;
  hasPartner: boolean | null;
  invites: InviteRow[];
  locked: boolean;
  onAnswer: (value: boolean) => Promise<boolean>;
  onSkip: () => Promise<boolean>;
  onError: (msg: string | null) => void;
}) {
  // Local, not-yet-saved choice — say "yes" and stay here to search and invite
  // before the wizard moves on.
  const [choice, setChoice] = useState<boolean | null>(hasPartner);

  const pending = invites.filter((i) => i.status === "pending");

  return (
    <div className="rounded-card border border-line bg-raised p-6">
      <h1 className="font-display text-2xl font-semibold leading-tight">
        {step.title}
      </h1>
      {step.subtitle && <p className="mt-2 text-sm text-muted">{step.subtitle}</p>}

      {choice === null ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={locked}
            onClick={() => setChoice(true)}
            className="rounded-card border border-line bg-sunken px-4 py-2.5 font-medium text-fg transition hover:border-teal disabled:opacity-50"
          >
            {step.yesLabel}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => onAnswer(false)}
            className="rounded-card border border-line bg-sunken px-4 py-2.5 font-medium text-fg transition hover:border-teal disabled:opacity-50"
          >
            {step.noLabel}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={locked}
            className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-clay disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          <PartnerLink
            canInvite
            pending={pending.map((i) => ({
              id: i.id,
              contact: i.invitee_email ?? i.invitee_phone ?? "someone",
              url: `/invite/${i.token}`,
              expiresAt: i.expires_at,
            }))}
          />

          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
            <button
              type="button"
              disabled={locked}
              onClick={() => onAnswer(true)}
              className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Continue
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => setChoice(null)}
              className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-teal disabled:opacity-50"
            >
              Back
            </button>
            <span className="text-xs text-muted">
              You can add them later from Account &amp; household too.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
