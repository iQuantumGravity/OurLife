"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    await fetch("/api/plaid/sync", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={sync}
      disabled={busy}
      className="font-mono text-[11px] uppercase tracking-wider text-teal hover:underline disabled:opacity-50"
    >
      {busy ? "Syncing…" : "Sync transactions now"}
    </button>
  );
}
