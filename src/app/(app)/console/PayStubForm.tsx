"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addPayStub, type ActionResult } from "./actions";

const initial: ActionResult = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Add paycheck"}
    </button>
  );
}

export function PayStubForm({ earners }: { earners: string[] }) {
  const [state, formAction] = useFormState(
    async (_prev: ActionResult, fd: FormData) => addPayStub(fd),
    initial,
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Earner" required>
          <input
            name="earner"
            list="earner-options"
            required
            placeholder="e.g. Daniel"
            className={inputCls}
          />
          <datalist id="earner-options">
            {earners.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </Field>
        <Field label="Employer">
          <input name="employer" className={inputCls} />
        </Field>
        <Field label="Pay date" required>
          <input name="pay_date" type="date" required className={inputCls} />
        </Field>
        <Field label="Gross ($)">
          <input name="gross_amount" type="number" step="0.01" min="0" className={inputCls} />
        </Field>
        <Field label="Net / take-home ($)" required>
          <input name="net_amount" type="number" step="0.01" min="0" required className={inputCls} />
        </Field>
        <Field label="Taxes ($)">
          <input name="taxes" type="number" step="0.01" min="0" className={inputCls} />
        </Field>
        <Field label="Retirement ($)">
          <input name="retirement_contrib" type="number" step="0.01" min="0" className={inputCls} />
        </Field>
        <Field label="Other deductions ($)">
          <input name="other_deductions" type="number" step="0.01" min="0" className={inputCls} />
        </Field>
        <Field label="Notes">
          <input name="notes" className={inputCls} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input name="is_commission" type="checkbox" className="accent-clay" />
        This paycheck is mostly commission (variable)
      </label>

      <div className="flex items-center gap-4">
        <SubmitButton />
        {state.error && <span className="text-sm text-clay">{state.error}</span>}
        {state.ok && <span className="text-sm text-teal">Added ✓</span>}
      </div>
    </form>
  );
}

const inputCls =
  "rounded-card border border-line bg-raised px-3 py-2 text-fg outline-none focus:border-teal";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
