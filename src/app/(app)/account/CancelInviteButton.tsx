"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelInvite } from "@/app/(app)/onboarding/actions";

export function CancelInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await cancelInvite(inviteId);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-clay">{error}</span>}
      <button
        type="button"
        onClick={cancel}
        disabled={busy || pending}
        className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-clay disabled:opacity-50"
      >
        {busy ? "…" : "Cancel"}
      </button>
    </div>
  );
}
