"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GOAL_BUCKETS, BUCKET_META, type GoalScope } from "@/lib/goals/types";
import type { Person } from "@/lib/people";
import { VoiceButton, appendSpoken } from "@/components/VoiceInput";
import { addGoal } from "./actions";

export function GoalForm({ people }: { people: Person[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<GoalScope>("shared");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await addGoal(fd);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    formRef.current?.reset();
    setName("");
    setNote("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
      >
        + Add a goal
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="rounded-card border border-line bg-raised p-5"
    >
      <h3 className="font-display text-lg font-semibold">Add a goal</h3>

      {/* scope — the shared/individual split the whole app turns on */}
      <div className="mt-4">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Whose is it?
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          <ScopeChip
            active={scope === "shared"}
            onClick={() => setScope("shared")}
            title="Ours"
            sub="A shared dream"
          />
          <ScopeChip
            active={scope === "individual"}
            onClick={() => setScope("individual")}
            title="Just mine"
            sub="An individual goal"
          />
        </div>
        <input type="hidden" name="scope" value={scope} />
      </div>

      {scope === "individual" && people.length > 1 && (
        <label className="mt-4 flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Whose goal
          </span>
          <select
            name="owner"
            className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
          >
            {people.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.isYou ? "Mine" : p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="mt-4 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Bucket
        </span>
        <select
          name="bucket"
          defaultValue="other"
          className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
        >
          {GOAL_BUCKETS.map((b) => (
            <option key={b} value={b}>
              {BUCKET_META[b].label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          What is it?
        </span>
        <div className="flex items-center gap-2">
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            placeholder="e.g. Deposit on a place with a garden"
            className="flex-1 rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
          />
          <VoiceButton onText={(t) => setName((d) => appendSpoken(d, t))} />
        </div>
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Target amount
          </span>
          <input
            name="targetAmount"
            inputMode="numeric"
            placeholder="e.g. 40000"
            className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            By when
          </span>
          <input
            name="targetMonth"
            type="month"
            className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Or per month
          </span>
          <input
            name="monthlyContribution"
            inputMode="numeric"
            placeholder="e.g. 400"
            className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
          />
        </label>
      </div>

      <label className="mt-4 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Why it matters (optional)
        </span>
        <div className="flex items-start gap-2">
          <textarea
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={280}
            className="flex-1 resize-y rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
          />
          <VoiceButton onText={(t) => setNote((d) => appendSpoken(d, t))} />
        </div>
      </label>

      {error && <p className="mt-3 text-sm text-clay">{error}</p>}

      <div className="mt-5 flex items-center gap-4">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add goal"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ScopeChip({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex-1 rounded-card border px-4 py-2.5 text-left transition-colors " +
        (active
          ? "border-teal bg-teal/10"
          : "border-line bg-sunken hover:border-teal")
      }
    >
      <div className={"font-medium " + (active ? "text-teal" : "text-fg")}>
        {title}
      </div>
      <div className="text-xs text-muted">{sub}</div>
    </button>
  );
}
