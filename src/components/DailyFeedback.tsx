import Link from "next/link";
import type { SurplusView } from "@/lib/goals/surplus";
import type { GoalProgress } from "@/lib/goals/types";
import { impactOfSpend } from "@/lib/goals/project";
import { usd, dateLabel, monthLabel } from "@/lib/format";

/**
 * The daily read: what's come in, what it cost you in time, and which goals
 * moved. The point is that an ordinary purchase has a visible consequence —
 * stated in months, not vibes.
 */
export function DailyFeedback({
  surplus,
  goals,
}: {
  surplus: SurplusView;
  goals: GoalProgress[];
}) {
  const active = goals.filter((g) => g.status === "active");
  // Goals nothing is going into have no projected date to be "late" against,
  // so they'd fall through the slipping list into a reassurance they've
  // earned least of all.
  const stalled = active.filter((g) => g.unfundable).length;
  const slipping = active
    .filter((g) => !g.unfundable && (g.slipMonths ?? 0) > 0)
    .sort((a, b) => (b.slipMonths ?? 0) - (a.slipMonths ?? 0))
    .slice(0, 3);

  const hasSpending = surplus.source !== "none";

  return (
    <section className="rounded-card border border-line bg-raised p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">
          Since last month
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {surplus.source === "plaid"
            ? "live from your banks"
            : surplus.source === "documents"
              ? "from uploaded statements"
              : "no spending data yet"}
        </span>
      </div>

      {!hasSpending ? (
        <div className="mt-3 text-sm text-muted">
          <p>
            Connect a bank and this updates itself daily — every purchase
            immediately shows what it did to your timelines.{" "}
            <Link href="/accounts" className="text-teal hover:underline">
              Link an account
            </Link>{" "}
            or{" "}
            <Link
              href="/records?tab=statements"
              className="text-teal hover:underline"
            >
              upload a statement
            </Link>{" "}
            instead — both feed the same numbers.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3">
            <Cell
              label="Spent, last 30 days"
              value={usd(surplus.last30Spend)}
            />
            <Cell
              label="Typical month"
              value={
                surplus.monthlySpend !== null ? usd(surplus.monthlySpend) : "—"
              }
              sub={
                surplus.monthsOfSpending > 0
                  ? `over ${surplus.monthsOfSpending} mo`
                  : "not enough history"
              }
            />
            {/* Three cells in a two-column grid leave a hole on phones, which
                reads as a missing figure rather than an empty cell. */}
            <Cell
              className="col-span-2 sm:col-span-1"
              label="Left over / mo"
              value={
                surplus.monthlySurplus !== null
                  ? usd(surplus.monthlySurplus)
                  : "—"
              }
              tone={
                surplus.monthlySurplus !== null && surplus.monthlySurplus < 0
                  ? "warn"
                  : undefined
              }
            />
          </div>

          {/* what moved */}
          {slipping.length > 0 ? (
            <div className="mt-4">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-clay">
                Pushed back
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {slipping.map((g) => (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-card border border-line px-3 py-2 text-sm"
                  >
                    <span className="text-fg">{g.name}</span>
                    <span className="font-mono text-xs text-clay">
                      {g.slipMonths} mo late
                      {g.projectedDate && (
                        <span className="text-muted">
                          {" "}
                          · now {monthLabel(g.projectedDate.slice(0, 7))}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : stalled > 0 ? (
            <p className="mt-4 rounded-card border border-clay/50 bg-clay/10 px-3 py-2 text-sm text-fg">
              Nothing is going into{" "}
              {stalled === active.length
                ? "these goals"
                : `${stalled} of these goals`}{" "}
              at the moment — you&apos;re spending more than you bring in.
            </p>
          ) : active.length > 0 && surplus.monthlySurplus !== null ? (
            <p className="mt-4 rounded-card border border-teal/40 bg-teal/10 px-3 py-2 text-sm text-fg">
              Everything with a date is still on track.
            </p>
          ) : active.length > 0 ? (
            <p className="mt-4 text-sm text-muted">
              Log some income and these goals get real dates to track against.
            </p>
          ) : null}

          {/* the actual purchases */}
          {surplus.recent.length > 0 && (
            <div className="mt-4">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Recent
              </h3>
              <ul className="mt-2 divide-y divide-line">
                {surplus.recent.slice(0, 6).map((r) => {
                  const impact = impactOfSpend(
                    r.amount,
                    surplus.monthlySurplus ?? 0,
                  );
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-fg">
                        {r.name}
                        <span className="ml-2 font-mono text-[10px] text-muted">
                          {dateLabel(r.date)}
                        </span>
                      </span>
                      <span className="font-mono tabular text-fg">
                        {usd(r.amount)}
                      </span>
                      {impact.monthsDelayed >= 0.1 && (
                        <span className="w-full font-mono text-[10px] text-muted sm:w-auto">
                          ≈ {impact.monthsDelayed} mo of saving
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Cell({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
  className?: string;
}) {
  return (
    <div className={"bg-raised p-3 " + (className ?? "")}>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={
          "mt-0.5 font-display text-lg font-semibold " +
          (tone === "warn" ? "text-clay" : "")
        }
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
