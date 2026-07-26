"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GoalProgress } from "@/lib/goals/types";
import { BUCKET_META } from "@/lib/goals/types";
import { usd, monthLabel } from "@/lib/format";
import { contribute, setGoalStatus, removeGoal } from "./actions";

export function GoalCard({
  goal,
  ownerName,
}: {
  goal: GoalProgress;
  ownerName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = goal.progress !== null ? Math.round(goal.progress * 100) : null;
  const achieved = goal.status === "achieved" || (pct !== null && pct >= 100);

  async function run(
    fn: () => Promise<{ error?: string } | Record<string, unknown> | undefined>,
  ) {
    setBusy(true);
    setError(null);
    const res = (await fn()) as { error?: string } | undefined;
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div
      className={
        "rounded-card border bg-raised p-4 transition-colors " +
        (achieved ? "border-teal/50" : "border-line")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {BUCKET_META[goal.bucket].label}
            </span>
            {goal.scope === "individual" && ownerName && (
              <span className="rounded bg-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
                {ownerName}
              </span>
            )}
            {goal.scope === "shared" && (
              <span className="rounded bg-teal/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-teal">
                ours
              </span>
            )}
          </div>
          <h3 className="mt-1 font-display text-base font-semibold leading-snug text-fg">
            {goal.name}
          </h3>
          {goal.note && <p className="mt-1 text-xs text-muted">{goal.note}</p>}
        </div>

        <div className="shrink-0 text-right">
          {goal.targetAmount !== null && (
            <div className="font-mono text-sm tabular text-fg">
              {usd(goal.targetAmount)}
            </div>
          )}
          {goal.targetDate && (
            <div className="font-mono text-[10px] tabular text-muted">
              {monthLabel(goal.targetDate.slice(0, 7))}
            </div>
          )}
        </div>
      </div>

      {/* progress */}
      {pct !== null ? (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-line">
            <div
              className={
                "h-full rounded-full transition-all " +
                (achieved ? "bg-teal" : "bg-gold")
              }
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {usd(goal.savedAmount)} of {usd(goal.targetAmount ?? 0)} · {pct}%
            </span>
            <TimingNote goal={goal} />
          </div>
        </div>
      ) : (
        <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
          No target amount — add one to track progress
        </div>
      )}

      {error && <p className="mt-2 text-xs text-clay">{error}</p>}

      {/* actions */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          className="font-mono text-[10px] uppercase tracking-wider text-teal hover:underline disabled:opacity-50"
        >
          {open ? "Close" : "Put money in"}
        </button>
        {!achieved && (
          <button
            type="button"
            onClick={() => run(() => setGoalStatus(goal.id, "achieved"))}
            disabled={busy}
            className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-teal disabled:opacity-50"
          >
            Mark done
          </button>
        )}
        <button
          type="button"
          onClick={() => run(() => removeGoal(goal.id))}
          disabled={busy}
          className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted hover:text-clay disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      {open && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount.replace(/[^0-9.-]/g, ""));
            if (!Number.isFinite(n) || n === 0) return;
            run(async () => {
              const r = await contribute(goal.id, n, "Manual allocation");
              setAmount("");
              return r;
            });
          }}
        >
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder="Amount"
            className="w-32 rounded-card border border-line bg-sunken px-3 py-2 text-sm text-fg outline-none focus:border-teal"
          />
          <button
            type="submit"
            disabled={busy || !amount.trim()}
            className="rounded-card bg-teal px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
          <span className="text-xs text-muted">
            Use a negative number to take money back out.
          </span>
        </form>
      )}
    </div>
  );
}

/** The line that makes slippage visible — the point of the whole app. */
function TimingNote({ goal }: { goal: GoalProgress }) {
  if (goal.status === "achieved") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-teal">
        Achieved
      </span>
    );
  }
  // Checked before slipMonths: a goal receiving nothing has no projected date
  // to be late against, so it would otherwise render as a blank — the same as
  // a goal that simply hasn't been dated yet.
  if (goal.unfundable) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-clay">
        nothing going in
      </span>
    );
  }
  if (goal.slipMonths === null) {
    if (goal.projectedDate) {
      return (
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          on track for {monthLabel(goal.projectedDate.slice(0, 7))}
        </span>
      );
    }
    return null;
  }
  if (goal.slipMonths <= 0) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-teal">
        {goal.slipMonths === 0
          ? "right on time"
          : `${Math.abs(goal.slipMonths)} mo early`}
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] uppercase tracking-wider text-clay">
      {goal.slipMonths} mo late
    </span>
  );
}
