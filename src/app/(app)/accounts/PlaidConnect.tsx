"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";

export function PlaidConnect() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function fetchLinkToken() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      setBusy(false);
      setMsg(body.error ?? "Could not start Plaid Link.");
      return;
    }
    setLinkToken(body.link_token);
  }

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (public_token, metadata: PlaidLinkOnSuccessMetadata) => {
      setBusy(true);
      setMsg("Connecting…");
      const res = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token,
          institution_name: metadata.institution?.name ?? null,
          institution_id: metadata.institution?.institution_id ?? null,
        }),
      });
      const body = await res.json();
      setBusy(false);
      setLinkToken(null);
      if (!res.ok) {
        setMsg(body.error ?? "Could not finish connecting.");
        return;
      }
      setMsg("Connected ✓");
      router.refresh();
    },
    onExit: () => {
      setBusy(false);
      setLinkToken(null);
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      setBusy(false);
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={fetchLinkToken}
          className="rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : "Connect a bank account"}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
      <p className="text-xs text-muted">
        Powered by Plaid — supports SoFi and most US banks. Your bank login
        never touches this app; Plaid returns a token we use to sync
        transactions.
      </p>
    </div>
  );
}
