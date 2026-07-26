"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceButton, appendSpoken } from "@/components/VoiceInput";
import { lookupPartner, invitePartner, cancelInvite } from "./partnerActions";

type Found =
  | { state: "idle" }
  | { state: "searching" }
  | { state: "has_account"; contact: string }
  | { state: "no_account"; contact: string }
  | { state: "already_member"; contact: string }
  | { state: "error"; message: string };

export interface PendingInvite {
  id: string;
  contact: string;
  url: string;
  expiresAt: string;
}

/**
 * Find a partner and link them. Search first so we can tell you whether they
 * already have an account — which changes what happens next, and was the
 * missing piece: a partner who signs up on their own never joins anything.
 */
export function PartnerLink({
  pending,
  canInvite,
}: {
  pending: PendingInvite[];
  canInvite: boolean;
}) {
  const router = useRouter();
  const [contact, setContact] = useState("");
  const [found, setFound] = useState<Found>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ url: string; matched: boolean } | null>(null);
  const [origin, setOrigin] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const v = contact.trim();
    if (!v) return;
    setFound({ state: "searching" });
    setSent(null);
    const res = await lookupPartner(v);
    if (res.error) {
      setFound({ state: "error", message: res.error });
      return;
    }
    if (res.alreadyMember) {
      setFound({ state: "already_member", contact: v });
    } else if (res.hasAccount) {
      setFound({ state: "has_account", contact: v });
    } else {
      setFound({ state: "no_account", contact: v });
    }
  }

  async function send() {
    const v = contact.trim();
    if (!v) return;
    setBusy(true);
    const isEmail = v.includes("@");
    const res = await invitePartner(isEmail ? { email: v } : { phone: v });
    setBusy(false);
    if (!res.ok) {
      setFound({ state: "error", message: res.error ?? "Could not send that invite." });
      return;
    }
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    setSent({ url: res.inviteUrl, matched: res.matched });
    setContact("");
    setFound({ state: "idle" });
    router.refresh();
  }

  async function cancel(id: string) {
    setBusy(true);
    await cancelInvite(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={contact}
          onChange={(e) => {
            setContact(e.target.value);
            setFound({ state: "idle" });
          }}
          placeholder="Their email or phone number"
          disabled={busy || !canInvite}
          className="flex-1 rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal disabled:opacity-60"
        />
        <VoiceButton
          disabled={busy || !canInvite}
          onText={(t) => setContact((d) => appendSpoken(d, t).replace(/\s+/g, ""))}
        />
        <button
          type="submit"
          disabled={busy || !contact.trim() || !canInvite}
          className="rounded-card border border-line px-4 py-2.5 font-medium text-fg transition hover:border-teal disabled:opacity-50"
        >
          {found.state === "searching" ? "Looking…" : "Search"}
        </button>
      </form>

      {found.state === "error" && (
        <p className="rounded-card border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay">
          {found.message}
        </p>
      )}

      {found.state === "already_member" && (
        <p className="rounded-card border border-teal/40 bg-teal/10 px-4 py-3 text-sm text-fg">
          {found.contact} is already in this household — you&apos;re linked.
        </p>
      )}

      {(found.state === "has_account" || found.state === "no_account") && (
        <div className="rounded-card border border-line bg-sunken px-4 py-3 text-sm">
          {found.state === "has_account" ? (
            <p className="text-fg">
              <span className="font-medium">{found.contact}</span> already has an
              OurLife account. Send the invite and it&apos;ll be waiting for them
              next time they sign in — accepting moves them into this household.
            </p>
          ) : (
            <p className="text-fg">
              No account for{" "}
              <span className="font-medium">{found.contact}</span> yet. Send the
              invite and you&apos;ll get a link for them — creating an account
              from that link joins them here rather than starting their own plan.
            </p>
          )}
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="mt-3 rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
        </div>
      )}

      {sent && (
        <div className="rounded-card border border-teal/40 bg-teal/10 px-4 py-3 text-sm">
          <p className="text-fg">
            {sent.matched
              ? "Invite sent — they'll see it next time they sign in."
              : "Invite created. Send them this link:"}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-teal">
            {origin}
            {sent.url}
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Pending invites
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="rounded-card border border-line px-4 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-fg">{inv.contact}</span>
                  <button
                    type="button"
                    onClick={() => cancel(inv.id)}
                    disabled={busy}
                    className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-clay disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-muted">
                  {origin || ""}
                  {inv.url}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!canInvite && (
        <p className="text-xs text-muted">
          This household already has two people in it.
        </p>
      )}
    </div>
  );
}
