import { getContext, getBaseline, getPayStubs } from "@/lib/data";
import { SAMPLE_BASELINE } from "@/lib/model/sample-baseline";
import { savingsProgress } from "@/lib/model/engine";
import { Elevation } from "@/components/Elevation";
import { ConnectBanner } from "@/components/ConnectBanner";
import { usd, usdK, monthLabel } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getContext();
  const baseline = ctx ? await getBaseline(ctx.householdId) : SAMPLE_BASELINE;
  const stubs = ctx ? await getPayStubs(ctx.householdId) : [];
  const progress = savingsProgress(baseline, stubs);

  const nowMonth = new Date().toISOString().slice(0, 7);
  const nextGoal =
    baseline.goals.find((g) => g.targetMonth >= nowMonth) ?? baseline.goals[0];

  return (
    <div className="flex flex-col gap-10">
      {baseline.isSample && <ConnectBanner />}

      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {baseline.householdName}
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">
          The plan, and where you actually are.
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          {baseline.partnerA} &amp; {baseline.partnerB} — the living version of
          your ten-year map. Log each paycheck in{" "}
          <Link href="/console" className="text-teal underline">
            Pay stubs
          </Link>{" "}
          and it folds into the numbers below.
        </p>
      </section>

      {/* snapshot tiles */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4">
        <Tile label="House seed today" value={usd(baseline.startingSavings)} />
        <Tile label="Take-home / mo" value={usd(baseline.monthlyTakeHome)} />
        <Tile
          label="Next milestone"
          value={nextGoal ? nextGoal.name : "—"}
          sub={nextGoal ? `${monthLabel(nextGoal.targetMonth)} · ${usd(nextGoal.cost)}` : ""}
        />
        <Tile
          label="Paychecks logged"
          value={String(stubs.length)}
          sub={
            progress.monthsLogged > 0
              ? `${usd(progress.actualSaved)} banked so far`
              : "add your first"
          }
        />
      </section>

      {/* elevation */}
      <section>
        <SubHead>Savings elevation — the trail ahead</SubHead>
        <div className="rounded-card border border-line bg-raised p-6">
          <Elevation points={baseline.elevation} />
          <p className="mt-3 text-sm text-muted">
            Projected liquid savings at each milestone. The{" "}
            <span className="text-clay">clay dip</span> is the tightest year —
            home plus first child.
          </p>
        </div>
      </section>

      {/* tracking vs plan */}
      {progress.monthsLogged > 0 && (
        <section>
          <SubHead>How you&apos;re tracking</SubHead>
          <div className="grid gap-4 sm:grid-cols-3">
            <Tile label="Months logged" value={String(progress.monthsLogged)} boxed />
            <Tile label="Actually banked" value={usd(progress.actualSaved)} boxed />
            <Tile
              label="Plan target"
              value={usd(progress.targetSaved)}
              sub={
                progress.actualSaved >= progress.targetSaved
                  ? "ahead of plan ✓"
                  : "behind — sweep extra"
              }
              boxed
            />
          </div>
        </section>
      )}

      {/* phases */}
      <section>
        <SubHead>The phases — save &amp; spend targets</SubHead>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {baseline.phases.map((p) => (
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

      {/* goals */}
      <section>
        <SubHead>Every milestone, and when it&apos;s due</SubHead>
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
              {baseline.goals.map((g) => (
                <tr key={g.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{g.name}</td>
                  <td className="px-4 py-3 font-mono tabular text-muted">
                    {monthLabel(g.targetMonth)}
                  </td>
                  <td className="px-4 py-3 font-mono tabular">{usd(g.cost)}</td>
                  <td className="px-4 py-3 text-muted">{g.fundedFrom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-display text-xl font-semibold">{children}</h2>
  );
}

function Tile({
  label,
  value,
  sub,
  boxed,
}: {
  label: string;
  value: string;
  sub?: string;
  boxed?: boolean;
}) {
  return (
    <div
      className={
        boxed
          ? "rounded-card border border-line bg-raised p-4"
          : "bg-raised p-4"
      }
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
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
      <div
        className={`font-mono text-sm font-bold ${accent ? "text-clay" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
