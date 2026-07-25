"use client";

import { useState } from "react";
import type { PartnerStepConfig } from "@/lib/onboarding/steps";
import type { InviteRow } from "@/lib/onboarding/data";
import { invitePartner, cancelInvite } from "./actions";

export function PartnerStep({
  step,
  hasPartner,
  invites,
  onAnswer,
  onSkip,
}: {
  step: PartnerStepConfig;
  hasPartner: boolean | null;
  invites: InviteRow[];
  onAnswer: (value: boolean) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  // Local, not-yet-saved choice -- lets someone say "yes" and still stay on
  // this step to search/invite before the wizard advances.
  const [choice, setChoice] = useState<boolean | null>(hasPartner);
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string; matched?: boolean; inviteUrl?: string } | null>(null);

  const pending = invites.filter((i) => i.status === "pending");

  async function send() {
    setBusy(true);
    setResult(null);
    const isEmail = contact.includes("@");
    const res = await invitePartner(isEmail ? { email: contact } : { phone: contact });
    setBusy(false);
    setContact("");
    setResult(res);
  }

  return (
    <div className="rounded-card border border-line bg-raised p-6">
      <h1 className="font-display text-2xl font-semibold leading-tight">{step.title}</h1>
      {step.subtitle && <p className="mt-2 text-sm text-muted">{step.subtitle}</p>}

      {choice === null ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setChoice(true)}
            className="rounded-card border border-line bg-sunken px-4 py-2.5 font-medium text-fg transition hover:border-teal"
          >
            {step.yesLabel}
          </button>
          <button
            type="button"
            onClick={() => onAnswer(false)}
            className="rounded-card border border-line bg-sunken px-4 py-2.5 font-medium text-fg transition hover:border-teal"
          >
            {step.noLabel}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-clay"
          >
            Skip for now
          </button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email or phone number"
              className="flex-1 rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !contact.trim()}
              className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send invite"}
            </button>
          </div>

          {result?.error && <p className="text-sm text-clay">{result.error}</p>}
          {result?.ok && (
            <p className="text-sm text-teal">
              {result.matched
                ? "Found their account — invite sent. They'll see it next time they sign in."
                : "No account yet — share this link so they can create one and accept:"}
              {!result.matched && result.inviteUrl && (
                <span className="mt-1 block break-all font-mono text-xs text-fg">
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  {result.inviteUrl}
                </span>
              )}
            </p>
          )}

          {pending.length > 0 && (
            <ul className="flex flex-col gap-2">
              {pending.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-card border border-line px-3 py-2 text-sm"
                >
                  <span className="text-fg">{inv.invitee_email ?? inv.invitee_phone}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-gold">
                      Pending
                    </span>
                    <button
                      type="button"
                      onClick={() => cancelInvite(inv.id)}
                      className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-clay"
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-4 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => onAnswer(true)}
              className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setChoice(null)}
              className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-teal"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
