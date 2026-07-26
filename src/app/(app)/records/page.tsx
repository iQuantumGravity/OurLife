import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext, getPayStubs, getDocuments } from "@/lib/data";
import { byEarner, stubsByMonth } from "@/lib/model/engine";
import { PayStubForm } from "./PayStubForm";
import { Uploader } from "./Uploader";
import { deletePayStub, deleteDocument } from "./actions";
import { usd, dateLabel, monthLabel } from "@/lib/format";
import { getPeople, parseWho, nameFor } from "@/lib/people";
import { PersonFilter, OwnerTag } from "@/components/PersonFilter";
import type { Person } from "@/lib/people";

export const dynamic = "force-dynamic";

type Tab = "stubs" | "statements";

const KIND_LABEL: Record<string, string> = {
  bank_statement: "Bank statement",
  credit_card_statement: "Credit-card statement",
  pay_stub: "Pay stub",
  other: "Other",
};

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: { tab?: string; who?: string };
}) {
  const ctx = await getContext();
  if (!ctx) redirect("/login");

  const tab: Tab = searchParams.tab === "statements" ? "statements" : "stubs";

  const people = await getPeople(ctx.householdId, ctx.userId);
  const who = parseWho(searchParams.who, people);
  const ownerFilter = who === "all" ? undefined : who;

  const [stubs, docs] = await Promise.all([
    getPayStubs(ctx.householdId, ownerFilter),
    getDocuments(ctx.householdId, ownerFilter),
  ]);

  const totals = byEarner(stubs);
  const months = stubsByMonth(stubs);
  const earners = [...new Set(stubs.map((s) => s.earner))];

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Records
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Paychecks &amp; statements
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Everything you feed the plan lives here. Log a paycheck by hand, or
          upload a statement and have it read in.
        </p>
      </section>

      {/* toggle — plain links, so it works with JS off and survives a refresh */}
      <div
        role="tablist"
        aria-label="Record type"
        className="inline-flex w-full max-w-md gap-1 rounded-card border border-line bg-sunken p-1 sm:w-auto"
      >
        <TabLink
          href="/records?tab=stubs"
          active={tab === "stubs"}
          label="Pay stubs"
          count={stubs.length}
        />
        <TabLink
          href="/records?tab=statements"
          active={tab === "statements"}
          label="Statements"
          count={docs.length}
        />
      </div>

      <PersonFilter
        people={people}
        who={who}
        basePath="/records"
        extraParams={{ tab }}
      />

      {tab === "stubs" ? (
        <StubsPanel
          stubs={stubs}
          totals={totals}
          months={months}
          earners={earners}
          people={people}
        />
      ) : (
        <StatementsPanel
          docs={docs}
          householdId={ctx.householdId}
          people={people}
        />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={
        "flex-1 whitespace-nowrap rounded-card px-4 py-2 text-center font-mono text-xs uppercase tracking-wider transition-colors " +
        (active
          ? "bg-raised text-teal shadow-sm"
          : "text-muted hover:text-fg")
      }
    >
      {label}
      <span className={active ? "ml-1.5 text-teal/70" : "ml-1.5 text-muted"}>
        {count}
      </span>
    </Link>
  );
}

function StubsPanel({
  stubs,
  totals,
  months,
  earners,
  people,
}: {
  stubs: Awaited<ReturnType<typeof getPayStubs>>;
  totals: ReturnType<typeof byEarner>;
  months: ReturnType<typeof stubsByMonth>;
  earners: string[];
  people: Person[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-card border border-line bg-raised p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">
          Log a paycheck
        </h2>
        <PayStubForm earners={earners} />
      </section>

      {totals.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {totals.map((t) => (
            <div
              key={t.earner}
              className="rounded-card border border-line bg-raised p-4"
            >
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                {t.earner} · {t.count} stub{t.count === 1 ? "" : "s"}
              </div>
              <div className="mt-1 font-display text-xl font-semibold">
                {usd(t.net)}
              </div>
              <div className="text-xs text-muted">net logged to date</div>
            </div>
          ))}
        </section>
      )}

      {months.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">By month</h2>
          <div className="flex flex-wrap gap-2">
            {months.map((m) => (
              <div
                key={m.month}
                className="rounded-card border border-line bg-raised px-3 py-2"
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {monthLabel(m.month)}
                </div>
                <div className="font-mono text-sm font-bold text-teal">
                  {usd(m.net)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          All paychecks {stubs.length > 0 && `(${stubs.length})`}
        </h2>
        {stubs.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-raised/50 p-6 text-sm text-muted">
            No paychecks logged yet. Add your first one above and it starts
            feeding the dashboard immediately.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[640px] border-collapse bg-raised text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Earner</th>
                  <th className="px-4 py-3 font-medium">Employer</th>
                  <th className="px-4 py-3 font-medium">Gross</th>
                  <th className="px-4 py-3 font-medium">Net</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {stubs.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-mono tabular text-muted">
                      {dateLabel(s.pay_date)}
                    </td>
                    <td className="px-4 py-3">
                      {s.earner}
                      {people.length > 1 && s.member_user_id && (
                        <OwnerTag
                          name={nameFor(people, s.member_user_id)}
                          isYou={people.find((p) => p.userId === s.member_user_id)?.isYou}
                        />
                      )}
                      {s.is_commission && (
                        <span className="ml-2 rounded bg-clay/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-clay">
                          comm
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{s.employer ?? "—"}</td>
                    <td className="px-4 py-3 font-mono tabular">
                      {usd(Number(s.gross_amount))}
                    </td>
                    <td className="px-4 py-3 font-mono tabular font-semibold text-teal">
                      {usd(Number(s.net_amount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={deletePayStub.bind(null, s.id)}>
                        <button
                          type="submit"
                          className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-clay"
                        >
                          Remove
                        </button>
                      </form>
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

function StatementsPanel({
  docs,
  householdId,
  people,
}: {
  docs: Awaited<ReturnType<typeof getDocuments>>;
  householdId: string;
  people: Person[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-card border border-line bg-raised p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">
          Upload a statement
        </h2>
        <Uploader householdId={householdId} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          Uploaded {docs.length > 0 && `(${docs.length})`}
        </h2>
        {docs.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-raised/50 p-6 text-sm text-muted">
            Nothing uploaded yet. Statements go to a private, per-household
            bucket — only you and anyone you&apos;ve invited can see them.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[600px] border-collapse bg-raised text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Label</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Added</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      {KIND_LABEL[d.kind] ?? d.kind}
                      {people.length > 1 && d.uploaded_by && (
                        <OwnerTag
                          name={nameFor(people, d.uploaded_by)}
                          isYou={people.find((p) => p.userId === d.uploaded_by)?.isYou}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{d.label ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {d.period_label ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono tabular text-muted">
                      {dateLabel(d.created_at.slice(0, 10))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <a
                          href={`/api/statements/${d.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] uppercase tracking-wider text-teal hover:underline"
                        >
                          View
                        </a>
                        <form
                          action={deleteDocument.bind(null, d.id, d.storage_path)}
                        >
                          <button
                            type="submit"
                            className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-clay"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
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
