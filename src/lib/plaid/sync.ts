import "server-only";
import { plaidClient } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

// Pulls new/changed/removed transactions for every Plaid item linked to a
// household, using Plaid's incremental `/transactions/sync` cursor so repeat
// calls only fetch what's changed since the last sync.
export async function syncHouseholdTransactions(householdId: string) {
  const admin = createAdminClient();
  const { data: items } = await admin
    .from("plaid_items")
    .select("id, access_token, cursor")
    .eq("household_id", householdId);

  for (const item of items ?? []) {
    let cursor = item.cursor as string | null;
    let hasMore = true;
    const added: any[] = [];
    const modified: any[] = [];
    const removedIds: string[] = [];

    while (hasMore) {
      const res = await plaidClient.transactionsSync({
        access_token: item.access_token as string,
        cursor: cursor ?? undefined,
      });
      added.push(...res.data.added);
      modified.push(...res.data.modified);
      removedIds.push(...res.data.removed.map((r) => r.transaction_id as string));
      hasMore = res.data.has_more;
      cursor = res.data.next_cursor;
    }

    const upserts = [...added, ...modified].map((t: any) => ({
      household_id: householdId,
      plaid_item_id: item.id,
      plaid_transaction_id: t.transaction_id,
      account_id: t.account_id,
      name: t.name,
      merchant_name: t.merchant_name ?? null,
      amount: t.amount,
      iso_currency_code: t.iso_currency_code ?? "USD",
      date: t.date,
      pending: t.pending,
      category: t.personal_finance_category?.primary ?? t.category?.[0] ?? null,
      raw: t,
    }));

    if (upserts.length > 0) {
      await admin
        .from("transactions")
        .upsert(upserts, { onConflict: "plaid_transaction_id" });
    }
    if (removedIds.length > 0) {
      await admin
        .from("transactions")
        .delete()
        .in("plaid_transaction_id", removedIds);
    }
    await admin.from("plaid_items").update({ cursor }).eq("id", item.id);
  }
}
