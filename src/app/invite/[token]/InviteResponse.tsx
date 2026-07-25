"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respond } from "./actions";

export function InviteResponse({
  token,
  signedIn,
}: {
  token: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accept" | "decline" | null>(null);

  if (!signedIn) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <p className="text-sm text-muted">
          Create an account or sign in first — you'll land right back here.
        </p>
        <a
          href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="rounded-card bg-teal px-4 py-2.5 text-center font-medium text-white transition-opacity hover:opacity-90"
        >
          Continue to sign in
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <p className="mt-6 text-sm text-teal">
        {done === "accept"
          ? "You're in — head to your dashboard to see the plan."
          : "Declined. No hard feelings — you can be invited again anytime."}
      </p>
    );
  }

  async function act(action: "accept" | "decline") {
    setBusy(action);
    setError(null);
    const res = await respond(token, action);
    setBusy(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setDone(action);
    if (action === "accept") {
      setTimeout(() => router.push("/dashboard"), 900);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => act("accept")}
          disabled={busy !== null}
          className="flex-1 rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy === "accept" ? "Joining…" : "Accept & join"}
        </button>
        <button
          type="button"
          onClick={() => act("decline")}
          disabled={busy !== null}
          className="flex-1 rounded-card border border-line px-4 py-2.5 font-medium text-muted transition-opacity hover:border-clay hover:text-clay disabled:opacity-50"
        >
          {busy === "decline" ? "…" : "Decline"}
        </button>
      </div>
      {error && <p className="text-sm text-clay">{error}</p>}
    </div>
  );
}
