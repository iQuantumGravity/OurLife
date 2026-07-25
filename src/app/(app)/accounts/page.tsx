import {
  getContext,
  getPlaidConnections,
  getTransactions,
} from "@/lib/data";
import { ConnectBanner } from "@/components/ConnectBanner";
import { isPlaidConfigured } from "@/lib/config";
import { dateLabel, usd } from "@/lib/format";
import { PlaidConnect } from "./PlaidConnect";
import { SyncButton } from "./SyncButton";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const ctx = await getContext();
  const connections = ctx ? await getPlaidConnections(ctx.householdId) : [];
  const transactions = ctx ? await getTransactions(ctx.householdId) : [];

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Accounts
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Connected bank accounts
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Link a bank — SoFi and most US institutions — via Plaid to pull
          transactions in automatically instead of uploading statements by
          hand.
        </p>
      </section>

      {!ctx ? (
        <ConnectBanner />
      ) : !isPlaidConfigured ? (
        <div className="rounded-card border border-clay/50 bg-clay/10 px-5 py-4 text-sm">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-clay">
            Plaid not connected
          </div>
          <p className="text-fg">
            Add <code className="font-mono text-xs">PLAID_CLIENT_ID</code> and{" "}
            <code className="font-mono text-xs">PLAID_SECRET</code> to your
            environment to enable bank connections.
          </p>
        </div>
      ) : (
        <section className="rounded-card border border-line bg-raised p-6">
          <PlaidConnect />
          {connections.length > 0 && (
            <>
              <ul className="mt-6 flex flex-col gap-2">
                {connections.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-card border border-line px-4 py-2.5 text-sm"
                  >
                    <span>{c.institution_name ?? "Connected account"}</span>
                    <span className="font-mono text-[11px] text-muted">
                      linked {dateLabel(c.created_at.slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <SyncButton />
              </div>
            </>
          )}
        </section>
      )}

      {ctx && connections.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">
            Recent transactions{" "}
            {transactions.length > 0 && `(${transactions.length})`}
          </h2>
          {transactions.length === 0 ? (
            <p className="text-muted">No transactions synced yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="w-full min-w-[600px] border-collapse bg-raised text-sm">
                <thead>
                  <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-4 py-3 font-mono tabular text-muted">
                        {dateLabel(t.date)}
                      </td>
                      <td className="px-4 py-3">
                        {t.merchant_name ?? t.name}
                        {t.pending && (
                          <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-clay">
                            pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {t.category ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular">
                        {usd(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
