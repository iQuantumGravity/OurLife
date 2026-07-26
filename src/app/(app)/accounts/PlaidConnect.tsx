"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";

export function PlaidConnect() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ code?: string; hint?: string } | null>(null);

  async function fetchLinkToken() {
    setBusy(true);
    setMsg(null);
    setDetail(null);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      // An expired session is redirected to /login by the middleware, so the
      // body is HTML rather than JSON — don't let that throw an opaque error.
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setBusy(false);
        setMsg(
          body?.error ??
            (res.status === 401 || res.redirected
              ? "Your session expired — sign in again."
              : "Could not start Plaid Link."),
        );
        if (body?.errorCode || body?.hint) {
          setDetail({ code: body.errorCode, hint: body.hint });
        }
        return;
      }
      setLinkToken(body.link_token);
    } catch {
      setBusy(false);
      setMsg("Network trouble reaching Plaid. Try again?");
    }
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
        {msg && !detail && <span className="text-sm text-muted">{msg}</span>}
      </div>

      {msg && detail && (
        <div className="rounded-card border border-clay/40 bg-clay/10 px-4 py-3 text-sm">
          <div className="font-medium text-clay">{msg}</div>
          {detail.code && (
            <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted">
              {detail.code}
            </div>
          )}
          {detail.hint && <p className="mt-2 text-fg">{detail.hint}</p>}
        </div>
      )}

      <p className="text-xs text-muted">
        Powered by Plaid — supports SoFi and most US banks. Your bank login
        never touches this app; Plaid returns a token we use to sync
        transactions.{" "}
        <span className="text-muted">
          Connecting a bank is optional — you can always skip it and keep going.
        </span>
      </p>
    </div>
  );
}
