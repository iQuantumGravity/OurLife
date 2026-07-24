import { getContext, getBaseline, getPayStubs } from "@/lib/data";
import { SAMPLE_BASELINE } from "@/lib/model/sample-baseline";
import { byEarner, stubsByMonth } from "@/lib/model/engine";
import { ConnectBanner } from "@/components/ConnectBanner";
import { PayStubForm } from "./PayStubForm";
import { deletePayStub } from "./actions";
import { usd, dateLabel, monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const ctx = await getContext();
  const baseline = ctx ? await getBaseline(ctx.householdId) : SAMPLE_BASELINE;
  const stubs = ctx ? await getPayStubs(ctx.householdId) : [];
  const totals = byEarner(stubs);
  const months = stubsByMonth(stubs);

  const earners = [baseline.partnerA, baseline.partnerB].filter(Boolean);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Pay-stub console
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Log a paycheck
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Every stub you add updates your real take-home and how you&apos;re
          tracking against the plan. Net (take-home) is the number that matters
          most; the rest is optional detail.
        </p>
      </section>

      {!ctx && <ConnectBanner />}

      <section className="rounded-card border border-line bg-raised p-6">
        <PayStubForm earners={earners} />
      </section>

      {totals.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-3">
          {totals.map((t) => (
            <div key={t.earner} className="rounded-card border border-line bg-raised p-4">
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
          <h2 className="mb-3 font-display text-lg font-semibold">
            By month
          </h2>
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
          <p className="text-muted">
            No paychecks logged yet. Add your first one above.
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
