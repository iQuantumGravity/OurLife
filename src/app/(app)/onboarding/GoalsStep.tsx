"use client";

import { useState } from "react";
import type { GoalsStepConfig } from "@/lib/onboarding/steps";
import type { OnboardingGoal } from "@/lib/onboarding/schema";

const CATEGORIES: { value: OnboardingGoal["type"]; label: string }[] = [
  { value: "milestone", label: "Milestone" },
  { value: "home", label: "Home" },
  { value: "travel", label: "Travel" },
  { value: "debt", label: "Pay off debt" },
  { value: "family", label: "Family" },
  { value: "invest", label: "Invest" },
];

export function GoalsStep({
  step,
  goals,
  onSave,
  onSkip,
}: {
  step: GoalsStepConfig;
  goals: OnboardingGoal[];
  onSave: (goals: OnboardingGoal[]) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const [list, setList] = useState<OnboardingGoal[]>(goals);
  const [type, setType] = useState<OnboardingGoal["type"]>("milestone");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");

  function add() {
    if (!note.trim()) return;
    const next = [
      ...list,
      {
        type,
        note: note.trim(),
        targetAmount: amount ? Number(amount) : null,
        targetDate: null,
        priority: list.length + 1,
      },
    ];
    setList(next);
    setNote("");
    setAmount("");
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
          {list.map((g, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-card border border-line px-3 py-2 text-sm"
            >
              <span className="text-fg">
                {g.note}
                {g.targetAmount ? ` · $${g.targetAmount.toLocaleString()}` : ""}
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
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setType(c.value)}
              className={
                "rounded-full border px-3 py-1.5 text-xs transition " +
                (type === c.value
                  ? "border-teal text-teal"
                  : "border-line text-muted hover:border-teal hover:text-teal")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Down payment on a house"
            className="flex-1 rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Amount (optional)"
            inputMode="numeric"
            className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal sm:w-40"
          />
          <button
            type="button"
            onClick={add}
            disabled={!note.trim()}
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
          disabled={list.length === 0}
          className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-clay"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
