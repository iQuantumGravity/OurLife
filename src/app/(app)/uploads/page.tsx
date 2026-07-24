import { getContext, getDocuments } from "@/lib/data";
import { ConnectBanner } from "@/components/ConnectBanner";
import { Uploader } from "./Uploader";
import { deleteDocument } from "./actions";
import { dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  bank_statement: "Bank statement",
  credit_card_statement: "Credit-card statement",
  pay_stub: "Pay stub",
  other: "Other",
};

export default async function UploadsPage() {
  const ctx = await getContext();
  const docs = ctx ? await getDocuments(ctx.householdId) : [];

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Statements
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Upload bank &amp; credit-card statements
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Keep every statement in one private place. For now, add the key figure
          (like the ending balance) in the label; automated parsing of PDFs is
          the next build.
        </p>
      </section>

      {!ctx ? (
        <ConnectBanner />
      ) : (
        <section className="rounded-card border border-line bg-raised p-6">
          <Uploader householdId={ctx.householdId} />
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          Uploaded {docs.length > 0 && `(${docs.length})`}
        </h2>
        {docs.length === 0 ? (
          <p className="text-muted">Nothing uploaded yet.</p>
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
                        <form action={deleteDocument.bind(null, d.id, d.storage_path)}>
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
