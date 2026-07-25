"use client";

import { useState } from "react";
import type { PartnerStepConfig } from "@/lib/onboarding/steps";
import type { InviteRow } from "@/lib/onboarding/data";
import { invitePartner, cancelInvite } from "./actions";

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
  // Local, not-yet-saved choice -- lets someone say "yes" and stay on this step
  // to search/invite before the wizard advances.
  const [choice, setChoice] = useState<boolean | null>(hasPartner);
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ matched: boolean; url: string } | null>(null);
  const [origin, setOrigin] = useState("");

  const pending = invites.filter((i) => i.status === "pending");
  const hasInvite = pending.length > 0 || sent !== null;

  async function send() {
    const value = contact.trim();
    if (!value) return;
    setBusy(true);
    onError(null);
    const isEmail = value.includes("@");
    const res = await invitePartner(isEmail ? { email: value } : { phone: value });
    setBusy(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    setContact("");
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    setSent({ matched: res.matched, url: res.inviteUrl });
  }

  async function cancel(id: string) {
    setBusy(true);
    onError(null);
    const res = await cancelInvite(id);
    setBusy(false);
    if (res?.error) onError(res.error);
  }

  const disabled = locked || busy;

  return (
    <div className="rounded-card border border-line bg-raised p-6">
      <h1 className="font-display text-2xl font-semibold leading-tight">{step.title}</h1>
      {step.subtitle && <p className="mt-2 text-sm text-muted">{step.subtitle}</p>}

      {choice === null ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setChoice(true)}
            className="rounded-card border border-line bg-sunken px-4 py-2.5 font-medium text-fg transition hover:border-teal disabled:opacity-50"
          >
            {step.yesLabel}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(false)}
            className="rounded-card border border-line bg-sunken px-4 py-2.5 font-medium text-fg transition hover:border-teal disabled:opacity-50"
          >
            {step.noLabel}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={disabled}
            className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-clay disabled:opacity-50"
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
              disabled={disabled}
              className="flex-1 rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal disabled:opacity-60"
            />
            <button
              type="button"
              onClick={send}
              disabled={disabled || !contact.trim()}
              className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send invite"}
            </button>
          </div>

          {sent && (
            <div className="rounded-card border border-teal/40 bg-teal/10 px-3 py-2.5 text-sm">
              {sent.matched ? (
                <span className="text-fg">
                  Found their account — the invite is waiting for them next time
                  they sign in.
                </span>
              ) : (
                <>
                  <span className="text-fg">
                    No account yet — send them this link and they can create one,
                    then accept or decline:
                  </span>
                  <span className="mt-1 block break-all font-mono text-xs text-teal">
                    {origin}
                    {sent.url}
                  </span>
                </>
              )}
            </div>
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
                      disabled={disabled}
                      onClick={() => cancel(inv.id)}
                      className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-clay disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(true)}
              className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Continue
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setChoice(null)}
              className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-teal disabled:opacity-50"
            >
              Back
            </button>
            {!hasInvite && (
              <span className="text-xs text-muted">
                No invite sent yet — that&apos;s fine, you can add them later from
                this page.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
