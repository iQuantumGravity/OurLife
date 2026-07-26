import Link from "next/link";
import type { GoalProgress } from "@/lib/goals/types";
import { BUCKET_META, type GoalBucket } from "@/lib/goals/types";
import { usd } from "@/lib/format";

/**
 * The dashboard's view of the goals page: one row per bucket, funded against
 * targeted. Deliberately a summary — the detail, and every control, lives on
 * /goals, so there is exactly one place where a goal can be changed.
 */
export function GoalsRollup({ goals }: { goals: GoalProgress[] }) {
  const active = goals.filter(
    (g) => g.status === "active" || g.status === "achieved",
  );
  if (active.length === 0) return null;

  const rank = { near: 0, mid: 1, far: 2 };
  const buckets = new Map<GoalBucket, GoalProgress[]>();
  for (const g of active) {
    const list = buckets.get(g.bucket) ?? [];
    list.push(g);
    buckets.set(g.bucket, list);
  }

  const rows = [...buckets.entries()]
    .map(([bucket, list]) => {
      // Targets can be null — a goal without one still belongs to the bucket,
      // it just can't contribute to a percentage.
      const target = list.reduce((s, g) => s + (g.targetAmount ?? 0), 0);
      const saved = list.reduce(
        (s, g) =>
          s +
          (g.targetAmount !== null
            ? Math.min(g.savedAmount, g.targetAmount)
            : 0),
        0,
      );
      return {
        bucket,
        count: list.length,
        target,
        saved,
        progress: target > 0 ? saved / target : null,
        untargeted: list.filter((g) => g.targetAmount === null).length,
      };
    })
    .sort(
      (a, b) =>
        rank[BUCKET_META[a.bucket].horizon] -
        rank[BUCKET_META[b.bucket].horizon],
    );

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">Your goals</h2>
        <Link
          href="/goals"
          className="font-mono text-[11px] uppercase tracking-wider text-teal hover:underline"
        >
          Open goals →
        </Link>
      </div>

      <div className="flex flex-col gap-px overflow-hidden rounded-card border border-line bg-line">
        {rows.map((r) => {
          const pct = r.progress !== null ? Math.round(r.progress * 100) : null;
          return (
            <Link
              key={r.bucket}
              href="/goals"
              className="bg-raised p-4 transition-colors hover:bg-sunken"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display font-semibold text-fg">
                  {BUCKET_META[r.bucket].label}
                  <span className="ml-2 font-body text-xs font-normal text-muted">
                    {r.count} goal{r.count === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="font-mono text-xs tabular text-muted">
                  {r.target > 0 ? `${usd(r.saved)} of ${usd(r.target)}` : "no target set"}
                </span>
              </div>
              {pct !== null && (
                <div className="mt-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className={
                        "h-full rounded-full " +
                        (pct >= 100 ? "bg-teal" : "bg-gold")
                      }
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                    {pct}% funded
                    {r.untargeted > 0 &&
                      ` · ${r.untargeted} without a target amount`}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
