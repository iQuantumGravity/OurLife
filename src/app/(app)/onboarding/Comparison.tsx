"use client";

import type { OnboardingAnswers } from "@/lib/onboarding/schema";

const ROWS: { field: keyof OnboardingAnswers; label: string; format: (v: unknown) => string }[] = [
  {
    field: "retirementAge",
    label: "Retirement age",
    format: (v) => (v ? `${v}` : "Not answered"),
  },
  {
    field: "kidsStatus",
    label: "Kids",
    format: (v) =>
      v === "has" ? "Already have kids" : v === "wants" ? "Want kids someday" : v === "none" ? "Not planning to" : "Not answered",
  },
  {
    field: "kidsCount",
    label: "How many",
    format: (v) => (v ? `${v}` : "—"),
  },
  {
    field: "riskTolerance",
    label: "Risk tolerance",
    format: (v) =>
      v === "conservative" ? "Play it safe" : v === "moderate" ? "Balanced" : v === "aggressive" ? "Comfortable with ups and downs" : "Not answered",
  },
];

export function Comparison({
  mine,
  partner,
  partnerName,
  onContinue,
}: {
  mine: OnboardingAnswers;
  partner: OnboardingAnswers;
  partnerName: string | null;
  onContinue: () => Promise<void>;
}) {
  return (
    <div className="rounded-card border border-line bg-raised p-6">
      <h1 className="font-display text-2xl font-semibold leading-tight">
        Here's where you two line up.
      </h1>
      <p className="mt-2 text-sm text-muted">
        No right answer — this is just useful to see before the plan takes
        shape. Talk through anything that surprises you.
      </p>

      <div className="mt-6 overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 font-medium"></th>
              <th className="px-3 py-2 font-medium">You</th>
              <th className="px-3 py-2 font-medium">{partnerName ?? "Partner"}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const mineVal = mine[row.field];
              const partnerVal = partner[row.field];
              const differs =
                mineVal != null && partnerVal != null && mineVal !== partnerVal;
              return (
                <tr key={row.field} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 text-muted">{row.label}</td>
                  <td className={"px-3 py-3 " + (differs ? "text-clay" : "text-fg")}>
                    {row.format(mineVal)}
                  </td>
                  <td className={"px-3 py-3 " + (differs ? "text-clay" : "text-fg")}>
                    {row.format(partnerVal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(mine.topGoals.length > 0 || partner.topGoals.length > 0) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Your top goals
            </h2>
            {mine.topGoals.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Not answered</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-fg">
                {mine.topGoals.map((g, i) => (
                  <li key={i}>· {g.note ?? g.type}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">
              {partnerName ?? "Partner"}'s top goals
            </h2>
            {partner.topGoals.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Not answered</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-fg">
                {partner.topGoals.map((g, i) => (
                  <li key={i}>· {g.note ?? g.type}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="mt-6 rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
      >
        Continue to money
      </button>
    </div>
  );
}
