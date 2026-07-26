import { NextResponse } from "next/server";
import { getContext } from "@/lib/data";
import { plaidClient } from "@/lib/plaid/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlaidConfigured, isServiceRoleConfigured } from "@/lib/config";
import { syncHouseholdTransactions } from "@/lib/plaid/sync";

export async function POST(request: Request) {
  if (!isPlaidConfigured) {
    return NextResponse.json({ error: "Plaid not configured" }, { status: 503 });
  }
  if (!isServiceRoleConfigured) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set in this deployment." },
      { status: 503 },
    );
  }
  const ctx = await getContext();
  if (!ctx) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const publicToken = body?.public_token as string | undefined;
  if (!publicToken) {
    return NextResponse.json({ error: "missing public_token" }, { status: 400 });
  }
  const institutionName = (body?.institution_name as string | undefined) ?? null;
  const institutionId = (body?.institution_id as string | undefined) ?? null;

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const admin = createAdminClient();
    const { error } = await admin.from("plaid_items").insert({
      household_id: ctx.householdId,
      item_id: exchange.data.item_id,
      access_token: exchange.data.access_token,
      institution_id: institutionId,
      institution_name: institutionName,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await syncHouseholdTransactions(ctx.householdId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "could not link account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
