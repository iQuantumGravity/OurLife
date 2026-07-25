"use client";

import { useState } from "react";
import { saveProfile } from "./actions";

export function ProfileForm({
  initialPhone,
  initialDisplayName,
}: {
  initialPhone: string;
  initialDisplayName: string;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await saveProfile({ phone, displayName });
    setBusy(false);
    if (res?.error) {
      setOk(false);
      setMsg(res.error);
      return;
    }
    setOk(true);
    setMsg("Saved ✓");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Display name
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="What should we call you?"
          className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Phone number
        </span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. +1 555 123 4567"
          className="rounded-card border border-line bg-sunken px-3 py-2 text-fg outline-none focus:border-teal"
        />
        <span className="text-xs text-muted">
          Only used so a partner can find you by phone when inviting you.
        </span>
      </label>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {msg && (
          <span className={`text-sm ${ok ? "text-teal" : "text-clay"}`}>{msg}</span>
        )}
      </div>
    </form>
  );
}
