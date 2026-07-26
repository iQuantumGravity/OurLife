import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/data";
import { getHouseholdFinances } from "@/lib/finances";
import { usd, dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Finances · OurLife" };

export default async function FinancesPage() {
  const ctx = await getContext();
  if (!ctx) redirect("/login");

  const fin = await getHouseholdFinances(ctx.householdId, ctx.userId);
  const you = fin.people.find((p) => p.person.isYou);
  const others = fin.people.filter((p) => !p.person.isYou);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Finances
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">
          Yours, theirs, and together.
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Each of you logs your own paychecks and statements. This is what each
          side actually contributes, and what the household adds up to.
        </p>
      </section>

      {/* combined */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Together</h2>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
          <Tile
            label="Net logged"
            value={fin.combined.totalNet > 0 ? usd(fin.combined.totalNet) : "—"}
            sub={`${fin.combined.stubCount} paycheck${fin.combined.stubCount === 1 ? "" : "s"}`}
          />
          <Tile
            label="Gross logged"
            value={fin.combined.totalGross > 0 ? usd(fin.combined.totalGross) : "—"}
          />
          <Tile
            label="Avg / month"
            value={
              fin.combined.avgMonthlyNet !== null
                ? usd(fin.combined.avgMonthlyNet)
                : "—"
            }
            sub={
              fin.combined.monthsLogged > 0
                ? `over ${fin.combined.monthsLogged} month${fin.combined.monthsLogged === 1 ? "" : "s"}`
                : "nothing logged"
            }
          />
          <Tile label="People" value={String(fin.people.length)} />
        </div>
      </section>

      {/* you */}
      {you && (
        <PersonPanel
          title="You"
          f={you}
          emptyHint="Log a paycheck and your side of the picture fills in."
        />
      )}

      {/* partner(s) */}
      {others.length > 0 ? (
        others.map((o) => (
          <PersonPanel
            key={o.person.userId}
            title={o.person.name}
            f={o}
            emptyHint={`${o.person.name} hasn't logged anything yet — they add their own records from their own sign-in.`}
          />
        ))
      ) : (
        <section className="rounded-card border border-dashed border-line bg-raised/50 p-6">
          <div className="font-medium text-fg">No partner linked yet.</div>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Add them and you&apos;ll each keep your own paychecks, statements and
            bank connections, with the household total combining both.
          </p>
          <Link
            href="/account"
            className="mt-3 inline-block font-mono text-[11px] uppercase tracking-wider text-teal hover:underline"
          >
            Add a partner →
          </Link>
        </section>
      )}

      {/* split, only meaningful once both have logged something */}
      {fin.hasSplit && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">
            Who brings what
          </h2>
          <div className="rounded-card border border-line bg-raised p-5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-line">
              {fin.people.map((p, i) =>
                p.shareOfNet ? (
                  <div
                    key={p.person.userId}
                    className={i === 0 ? "bg-teal" : "bg-gold"}
                    style={{ width: `${Math.round(p.shareOfNet * 100)}%` }}
                    title={`${p.person.name}: ${Math.round(p.shareOfNet * 100)}%`}
                  />
                ) : null,
              )}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {fin.people.map((p, i) => (
                <li key={p.person.userId} className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      "h-2.5 w-2.5 rounded-full " +
                      (i === 0 ? "bg-teal" : "bg-gold")
                    }
                    aria-hidden
                  />
                  <span className="text-fg">
                    {p.person.isYou ? "You" : p.person.name}
                  </span>
                  <span className="font-mono tabular text-muted">
                    {p.shareOfNet !== null
                      ? `${Math.round(p.shareOfNet * 100)}%`
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Share of net income actually logged — not a judgement about who
              contributes what to the household.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function PersonPanel({
  title,
  f,
  emptyHint,
}: {
  title: string;
  f: import("@/lib/finances").PersonFinances;
  emptyHint: string;
}) {
  const empty = f.stubCount === 0 && f.documentCount === 0 && f.bankCount === 0;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {f.lastPayDate && (
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            last paid {dateLabel(f.lastPayDate)}
          </span>
        )}
      </div>

      {empty ? (
        <p className="rounded-card border border-dashed border-line bg-raised/50 p-5 text-sm text-muted">
          {emptyHint}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
          <Tile
            label="Net logged"
            value={f.totalNet > 0 ? usd(f.totalNet) : "—"}
            sub={`${f.stubCount} paycheck${f.stubCount === 1 ? "" : "s"}`}
          />
          <Tile
            label="Avg / month"
            value={f.avgMonthlyNet !== null ? usd(f.avgMonthlyNet) : "—"}
            sub={
              f.monthsLogged > 0
                ? `over ${f.monthsLogged} month${f.monthsLogged === 1 ? "" : "s"}`
                : undefined
            }
          />
          <Tile label="Statements" value={String(f.documentCount)} />
          <Tile label="Banks linked" value={String(f.bankCount)} />
        </div>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-raised p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-lg font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
