import { NextResponse } from "next/server";
import { getContext } from "@/lib/data";
import { isPlaidConfigured } from "@/lib/config";
import { syncHouseholdTransactions } from "@/lib/plaid/sync";

export async function POST() {
  if (!isPlaidConfigured) {
    return NextResponse.json({ error: "Plaid not configured" }, { status: 503 });
  }
  const ctx = await getContext();
  if (!ctx) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    await syncHouseholdTransactions(ctx.householdId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
