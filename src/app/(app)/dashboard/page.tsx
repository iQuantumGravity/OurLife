import { redirect } from "next/navigation";
import Link from "next/link";
import { getContext } from "@/lib/data";
import { getPlanView } from "@/lib/plan";
import { Elevation } from "@/components/Elevation";
import { usd, usdK, monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getContext();

  // Not signed in -> the middleware already handles this, but be explicit
  // rather than rendering a hollow shell.
  if (!ctx) redirect("/login");

  const plan = await getPlanView(ctx.householdId, ctx.userId);

  // Nothing real to show yet. Send them somewhere useful instead of rendering
  // a dashboard full of blanks (or, worse, someone else's sample numbers).
  if (!plan.hasAnything) redirect("/onboarding");

  const nowMonth = new Date().toISOString().slice(0, 7);
  const dated = plan.goals.filter((g) => g.targetMonth);
  const nextGoal =
    dated.find((g) => (g.targetMonth as string) >= nowMonth) ??
    dated[0] ??
    plan.goals[0] ??
    null;

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {plan.householdName ?? "Your household"}
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">
          Where you actually are.
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Every figure below comes from something you entered — a logged
          paycheck, an onboarding answer, or a change you asked the assistant
          to make. Nothing here is estimated on your behalf.
        </p>
      </section>

      {/* snapshot tiles */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4">
        <Tile
          label="Savings today"
          value={plan.startingSavings !== null ? usd(plan.startingSavings) : "—"}
          sub={
            plan.savingsSource === "onboarding"
              ? "from onboarding"
              : plan.savingsSource === "baseline"
                ? "from your plan"
                : "not set yet"
          }
          href={plan.startingSavings === null ? "/onboarding" : undefined}
        />
        <Tile
          label="Take-home / mo"
          value={plan.monthlyTakeHome !== null ? usd(plan.monthlyTakeHome) : "—"}
          sub={
            plan.takeHomeSource === "stubs"
              ? `avg of ${plan.monthsLogged} month${plan.monthsLogged === 1 ? "" : "s"}`
              : plan.takeHomeSource === "baseline"
                ? "planned, not yet logged"
                : "log a paycheck"
          }
          href={plan.takeHomeSource === null ? "/records" : undefined}
        />
        <Tile
          label="Next milestone"
          value={nextGoal ? nextGoal.name : "—"}
          sub={
            nextGoal
              ? [
                  nextGoal.targetMonth ? monthLabel(nextGoal.targetMonth) : null,
                  nextGoal.cost !== null ? usd(nextGoal.cost) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "no date set"
              : "add a goal"
          }
          href={nextGoal ? undefined : "/onboarding"}
        />
        <Tile
          label="Paychecks logged"
          value={String(plan.stubs.length)}
          sub={
            plan.stubs.length > 0
              ? `${usd(plan.totalNetLogged)} net to date`
              : "add your first"
          }
          href={plan.stubs.length === 0 ? "/records" : undefined}
        />
      </section>

      {/* per-earner, only when there is real data */}
      {plan.earners.length > 0 && (
        <section>
          <SubHead>Who earned what</SubHead>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plan.earners.map((e) => (
              <div
                key={e.earner}
                className="rounded-card border border-line bg-raised p-4"
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {e.earner} · {e.count} stub{e.count === 1 ? "" : "s"}
                </div>
                <div className="mt-1 font-display text-xl font-semibold">
                  {usd(e.net)}
                </div>
                <div className="text-xs text-muted">net logged to date</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* elevation — only from a real authored plan */}
      <section>
        <SubHead>Savings elevation</SubHead>
        {plan.elevation.length > 0 ? (
          <div className="rounded-card border border-line bg-raised p-6">
            <Elevation points={plan.elevation} />
          </div>
        ) : (
          <EmptyState
            title="No projection yet."
            body="Once your plan has milestones with dates and amounts, the savings curve is drawn here. Ask the assistant to build one from what you've entered."
            cta={{ href: "/assistant", label: "Ask the assistant" }}
          />
        )}
      </section>

      {/* phases — only from a real authored plan */}
      {plan.phases.length > 0 && (
        <section>
          <SubHead>The phases — save &amp; spend targets</SubHead>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plan.phases.map((p) => (
              <div
                key={p.id}
                className="flex flex-col rounded-card border border-line border-t-2 border-t-clay bg-raised p-5"
              >
                <div className="font-mono text-[11px] uppercase tracking-wider text-clay">
                  {p.id} · {p.span}
                </div>
                <div className="mt-1 font-display text-lg font-semibold">
                  {p.name}
                </div>
                <p className="mt-2 text-sm text-muted">{p.focus}</p>
                <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-line bg-line text-center">
                  <Metric label="Net/mo" value={usdK(p.monthlyNet)} />
                  <Metric label="Save/mo" value={usdK(p.monthlySave)} accent />
                  <Metric label="Cap/mo" value={usdK(p.monthlySpendCap)} />
                </div>
                <div className="mt-3 text-sm text-muted">
                  Ends at{" "}
                  <span className="font-mono font-bold text-teal">
                    {usdK(p.endBalance)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* goals */}
      <section>
        <SubHead>
          Milestones{" "}
          {plan.goalsSource === "onboarding" && (
            <span className="font-body text-sm font-normal text-muted">
              — from your onboarding answers
            </span>
          )}
        </SubHead>
        {plan.goals.length === 0 ? (
          <EmptyState
            title="No milestones yet."
            body="Add what you're working toward and they'll show up here with their cost and timing."
            cta={{ href: "/onboarding", label: "Add goals" }}
          />
        ) : (
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[520px] border-collapse bg-raised text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Goal</th>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="px-4 py-3 font-medium">Funded from</th>
                </tr>
              </thead>
              <tbody>
                {plan.goals.map((g) => (
                  <tr key={g.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">{g.name}</td>
                    <td className="px-4 py-3 font-mono tabular text-muted">
                      {g.targetMonth ? monthLabel(g.targetMonth) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono tabular">
                      {g.cost !== null ? usd(g.cost) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {g.fundedFrom ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-display text-xl font-semibold">{children}</h2>;
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-card border border-dashed border-line bg-raised/50 p-6">
      <div className="font-medium text-fg">{title}</div>
      <p className="mt-1 max-w-xl text-sm text-muted">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-3 inline-block font-mono text-[11px] uppercase tracking-wider text-teal hover:underline"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="bg-raised p-4 transition-colors hover:bg-sunken">
        {inner}
      </Link>
    );
  }
  return <div className="bg-raised p-4">{inner}</div>;
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "bg-clay/10 p-2.5" : "bg-raised p-2.5"}>
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className={`font-mono text-sm font-bold ${accent ? "text-clay" : ""}`}>
        {value}
      </div>
    </div>
  );
}
