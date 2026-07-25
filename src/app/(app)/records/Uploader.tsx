"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordDocument } from "./actions";

const KINDS = [
  { value: "bank_statement", label: "Bank statement" },
  { value: "credit_card_statement", label: "Credit-card statement" },
  { value: "pay_stub", label: "Pay stub (PDF)" },
  { value: "other", label: "Other" },
];

export function Uploader({ householdId }: { householdId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("bank_statement");
  const [label, setLabel] = useState("");
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMsg("Choose a file to upload.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setOk(false);

    const supabase = createClient();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${householdId}/${Date.now()}-${safeName}`;

    const { error: upErr } = await supabase.storage
      .from("statements")
      .upload(path, file, { upsert: false });

    if (upErr) {
      setBusy(false);
      setMsg(upErr.message);
      return;
    }

    const res = await recordDocument({
      kind,
      label: label || null,
      periodLabel: period || null,
      storagePath: path,
    });
    setBusy(false);

    if (res?.error) {
      setMsg(res.error);
      return;
    }
    setOk(true);
    setMsg("Uploaded ✓");
    setLabel("");
    setPeriod("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Type
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-card border border-line bg-raised px-3 py-2 text-fg outline-none focus:border-teal"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Statement period (e.g. &ldquo;Aug 2026&rdquo;)
          </span>
          <input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-card border border-line bg-raised px-3 py-2 text-fg outline-none focus:border-teal"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Label (optional)
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Chase checking"
            className="rounded-card border border-line bg-raised px-3 py-2 text-fg outline-none focus:border-teal"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            File (PDF, CSV, image)
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.csv,.png,.jpg,.jpeg,.webp"
            className="text-sm text-muted file:mr-3 file:rounded-card file:border file:border-line file:bg-sunken file:px-3 file:py-1.5 file:text-fg"
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload statement"}
        </button>
        {msg && (
          <span className={`text-sm ${ok ? "text-teal" : "text-clay"}`}>
            {msg}
          </span>
        )}
      </div>
      <p className="text-xs text-muted">
        Files go to a private, per-household storage bucket. Only you and
        Wednesday can see them.
      </p>
    </form>
  );
}
