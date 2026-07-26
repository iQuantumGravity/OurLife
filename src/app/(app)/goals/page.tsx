import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/data";
import { getPeople, nameFor } from "@/lib/people";
import { getGoals } from "@/lib/goals/data";
import { getSurplus } from "@/lib/goals/surplus";
import { projectGoals } from "@/lib/goals/project";
import { BUCKET_META, GOAL_BUCKETS, type GoalBucket } from "@/lib/goals/types";
import { pendingOnboardingGoals } from "@/lib/goals/import";
import { GoalForm } from "./GoalForm";
import { GoalCard } from "./GoalCard";
import { ImportBanner } from "./ImportBanner";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Goals · OurLife" };

type View = "all" | "shared" | "mine";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const ctx = await getContext();
  if (!ctx) redirect("/login");

  const view: View =
    searchParams.view === "shared"
      ? "shared"
      : searchParams.view === "mine"
        ? "mine"
        : "all";

  const [people, goals, surplus, pending] = await Promise.all([
    getPeople(ctx.householdId, ctx.userId),
    getGoals(ctx.householdId),
    getSurplus(ctx.householdId),
    pendingOnboardingGoals(ctx.householdId, ctx.userId),
  ]);

  const projected = projectGoals({
    goals,
    monthlySurplus: surplus.monthlySurplus ?? 0,
    liquidUnallocated: 0,
  });

  const visible = projected.filter((g) => {
    if (g.status === "dropped") return false;
    if (view === "shared") return g.scope === "shared";
    if (view === "mine")
      return g.scope === "individual" && g.ownerUserId === ctx.userId;
    return true;
  });

  // Group into buckets, keeping a sensible near→far order.
  const order: GoalBucket[] = [...GOAL_BUCKETS].sort((a, b) => {
    const rank = { near: 0, mid: 1, far: 2 };
    return rank[BUCKET_META[a].horizon] - rank[BUCKET_META[b].horizon];
  });
  const byBucket = order
    .map((b) => ({ bucket: b, goals: visible.filter((g) => g.bucket === b) }))
    .filter((g) => g.goals.length > 0);

  const active = visible.filter((g) => g.status === "active");
  const late = active.filter((g) => (g.slipMonths ?? 0) > 0).length;
  const totalTarget = active.reduce((s, g) => s + (g.targetAmount ?? 0), 0);
  const totalSaved = active.reduce((s, g) => s + g.savedAmount, 0);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Goals
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">
          The picture you&apos;re painting.
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Shared dreams and individual ones, in buckets. Each carries its own
          money and its own timing, so you can see what&apos;s on track and
          what&apos;s slipping.
        </p>
      </section>

      {/* headline */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
        <Tile label="Active goals" value={String(active.length)} />
        <Tile
          label="Set aside"
          value={totalSaved > 0 ? usd(totalSaved) : "—"}
          sub={totalTarget > 0 ? `of ${usd(totalTarget)}` : undefined}
        />
        <Tile
          label="Monthly surplus"
          value={
            surplus.monthlySurplus !== null ? usd(surplus.monthlySurplus) : "—"
          }
          sub={
            surplus.monthlySurplus === null
              ? "needs income + spending"
              : surplus.source === "plaid"
                ? "from linked banks"
                : surplus.source === "documents"
                  ? "from uploads"
                  : undefined
          }
        />
        {/* Without a surplus there is nothing to project from, so claiming
            "all on time" would be a false reassurance rather than a fact. */}
        <Tile
          label="Slipping"
          value={surplus.monthlySurplus === null ? "—" : String(late)}
          sub={
            surplus.monthlySurplus === null
              ? "can't tell yet"
              : late > 0
                ? "behind their date"
                : "all on time"
          }
          tone={late > 0 ? "warn" : undefined}
        />
      </section>

      <ImportBanner names={pending.map((p) => p.name)} />

      {surplus.monthlySurplus === null && (
        <section className="rounded-card border border-gold/40 bg-gold/10 p-4 text-sm">
          <div className="font-medium text-fg">
            Timelines need a monthly surplus to project from.
          </div>
          <p className="mt-1 text-muted">
            That means income and spending. Log a paycheck or two in{" "}
            <Link href="/records" className="text-teal hover:underline">
              Records
            </Link>
            , then either{" "}
            <Link href="/accounts" className="text-teal hover:underline">
              link a bank
            </Link>{" "}
            for continuous feedback or upload a statement. Until then goals
            still track money, just not dates.
          </p>
        </section>
      )}

      {/* view filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-card border border-line bg-sunken p-1">
          {(
            [
              ["all", "Everything"],
              ["shared", "Ours"],
              ["mine", "Just mine"],
            ] as const
          ).map(([v, label]) => (
            <Link
              key={v}
              href={v === "all" ? "/goals" : `/goals?view=${v}`}
              className={
                "rounded-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors " +
                (view === v ? "bg-raised text-teal" : "text-muted hover:text-fg")
              }
            >
              {label}
            </Link>
          ))}
        </div>
        <GoalForm people={people} />
      </div>

      {/* buckets */}
      {byBucket.length === 0 ? (
        <section className="rounded-card border border-dashed border-line bg-raised/50 p-8 text-center">
          <div className="font-display text-lg font-semibold">
            {view === "mine"
              ? "No individual goals yet."
              : view === "shared"
                ? "No shared goals yet."
                : "Nothing here yet."}
          </div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Start with anything — a trip, a deposit, clearing a card, retiring
            at sixty. Big and small both belong here.
          </p>
        </section>
      ) : (
        byBucket.map(({ bucket, goals: list }) => (
          <section key={bucket}>
            <div className="mb-3">
              <h2 className="font-display text-lg font-semibold">
                {BUCKET_META[bucket].label}
              </h2>
              <p className="text-xs text-muted">{BUCKET_META[bucket].blurb}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  ownerName={
                    g.ownerUserId
                      ? g.ownerUserId === ctx.userId
                        ? "mine"
                        : nameFor(people, g.ownerUserId)
                      : null
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
}) {
  return (
    <div className="bg-raised p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={
          "mt-1 font-display text-xl font-semibold " +
          (tone === "warn" ? "text-clay" : "")
        }
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
