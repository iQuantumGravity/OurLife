"use client";

import { useState } from "react";
import type { DebtStepConfig } from "@/lib/onboarding/steps";
import type { DebtItem } from "@/lib/onboarding/schema";

const TYPES: { value: DebtItem["type"]; label: string }[] = [
  { value: "credit_card", label: "Credit card" },
  { value: "student_loan", label: "Student loan" },
  { value: "auto_loan", label: "Auto loan" },
  { value: "personal_loan", label: "Personal loan" },
  { value: "medical", label: "Medical" },
  { value: "other", label: "Other" },
];

export function DebtStep({
  step,
  debts,
  locked,
  onSave,
  onSkip,
}: {
  step: DebtStepConfig;
  debts: DebtItem[];
  locked: boolean;
  onSave: (debts: DebtItem[]) => Promise<boolean>;
  onSkip: () => Promise<boolean>;
}) {
  const [list, setList] = useState<DebtItem[]>(debts);
  const [type, setType] = useState<DebtItem["type"]>("credit_card");
  const [balance, setBalance] = useState("");

  function add() {
    if (!balance) return;
    setList([...list, { type, balance: Number(balance) }]);
    setBalance("");
  }

  function remove(i: number) {
    setList(list.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-card border border-line bg-raised p-6">
      <h1 className="font-display text-2xl font-semibold leading-tight">{step.title}</h1>
      {step.subtitle && <p className="mt-2 text-sm text-muted">{step.subtitle}</p>}

      {list.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2">
          {list.map((d, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-card border border-line px-3 py-2 text-sm"
            >
              <span className="text-fg">
                {TYPES.find((t) => t.value === d.type)?.label} · $
                {d.balance.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-clay"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={
                "rounded-full border px-3 py-1.5 text-xs transition " +
                (type === t.value
                  ? "border-teal text-teal"
                  : "border-line text-muted hover:border-teal hover:text-teal")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={balance}
            onChange={(e) => setBalance(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Balance"
            inputMode="numeric"
            className="flex-1 rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
          />
          <button
            type="button"
            onClick={add}
            disabled={locked || !balance || list.length >= 20}
            className="rounded-card border border-line px-4 py-2 font-medium text-fg transition hover:border-teal disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => onSave(list)}
          disabled={locked || list.length === 0}
          className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={locked}
          className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-clay disabled:opacity-50"
        >
          {list.length === 0 ? "No debt to add" : "Skip for now"}
        </button>
      </div>
    </div>
  );
}
