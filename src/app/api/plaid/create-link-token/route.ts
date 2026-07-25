import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { getContext } from "@/lib/data";
import { plaidClient } from "@/lib/plaid/client";
import { isPlaidConfigured } from "@/lib/config";

export async function POST() {
  if (!isPlaidConfigured) {
    return NextResponse.json({ error: "Plaid not configured" }, { status: 503 });
  }
  const ctx = await getContext();
  if (!ctx) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  try {
    const res = await plaidClient.linkTokenCreate({
      user: { client_user_id: ctx.userId },
      client_name: "OurLife",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "could not create link token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
