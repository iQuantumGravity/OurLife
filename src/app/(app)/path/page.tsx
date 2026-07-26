import { redirect } from "next/navigation";
import { getContext } from "@/lib/data";
import { getPlanView } from "@/lib/plan";
import { buildLifePath, buildLifePathFromGoals, stageCounts } from "@/lib/model/path";
import { getGoals } from "@/lib/goals/data";
import { getSurplus } from "@/lib/goals/surplus";
import { projectGoals } from "@/lib/goals/project";
import { Elevation } from "@/components/Elevation";
import { PathMap } from "./PathMap";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Life path · OurLife" };

export default async function PathPage() {
  const ctx = await getContext();
  if (!ctx) redirect("/login");

  const [plan, goals, surplus] = await Promise.all([
    getPlanView(ctx.householdId, ctx.userId),
    getGoals(ctx.householdId),
    getSurplus(ctx.householdId),
  ]);
  if (!plan.hasAnything && goals.length === 0) redirect("/onboarding");

  // Real goals win: they carry allocated money and projected dates. The
  // onboarding-derived path is the fallback for households that haven't
  // created goals yet.
  const path =
    goals.length > 0
      ? buildLifePathFromGoals(
          projectGoals({
            goals,
            monthlySurplus: surplus.monthlySurplus,
            liquidUnallocated: 0,
          }),
        )
      : buildLifePath(plan);
  const counts = stageCounts(path);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Life path
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">
          The road, stage by stage.
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Every milestone in order, with how far along each one is. Zoom out for
          the whole arc, in for the detail.
        </p>
      </section>

      {/* overall */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3">
        <Tile
          label="Stages"
          value={String(counts.total)}
          sub={
            counts.undated > 0
              ? `${counts.done} passed · ${counts.undated} undated`
              : `${counts.done} passed`
          }
        />
        <Tile
          label="Saved so far"
          value={path.totalSaved > 0 ? usd(path.totalSaved) : "—"}
          sub={path.totalSaved > 0 ? "liquid today" : "not set yet"}
        />
        {/* Three tiles in a two-column grid leaves a hole on phones, which
            reads as a missing figure rather than an empty cell. */}
        <Tile
          className="col-span-2 sm:col-span-1"
          label="Everything ahead"
          value={path.totalTarget > 0 ? usd(path.totalTarget) : "—"}
          sub={
            path.overall !== null
              ? `${Math.round(path.overall * 100)}% funded on average`
              : "no targets set"
          }
        />
      </section>

      <PathMap path={path} counts={counts} />

      {plan.elevation.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">
            Savings elevation
          </h2>
          <div className="rounded-card border border-line bg-raised p-6">
            <Elevation points={plan.elevation} />
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={"bg-raised p-4 " + (className ?? "")}>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
