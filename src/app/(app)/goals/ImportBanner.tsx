"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importFromOnboarding } from "./actions";

/**
 * Offered when onboarding answers describe goals the household never turned
 * into real ones. Explicit rather than automatic: importing writes rows the
 * user then has to manage, and doing that behind their back is how people end
 * up with a goals page they didn't build.
 */
export function ImportBanner({ names }: { names: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (names.length === 0) return null;

  return (
    <section className="rounded-card border border-teal/40 bg-teal/10 p-4">
      <div className="font-medium text-fg">
        {names.length} thing{names.length === 1 ? "" : "s"} you mentioned in
        onboarding {names.length === 1 ? "isn't" : "aren't"} a goal yet.
      </div>
      <p className="mt-1 text-sm text-muted">
        {names.slice(0, 4).join(", ")}
        {names.length > 4 && ` and ${names.length - 4} more`}. Bring them in and
        they start tracking money and dates like everything else here.
      </p>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await importFromOnboarding();
          setBusy(false);
          if (res?.error) {
            setError(res.error);
            return;
          }
          router.refresh();
        }}
        className="mt-3 rounded-card bg-teal px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add them as goals"}
      </button>
    </section>
  );
}
