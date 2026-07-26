import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/config";
import type { Baseline, PayStub } from "@/lib/model/types";

export interface HouseholdContext {
  userId: string;
  email: string;
  householdId: string;
  displayName: string | null;
}

/**
 * Resolve the signed-in user and their household, creating one on first login.
 * Returns null when the backend isn't configured or no one is signed in.
 */
export async function getContext(): Promise<HouseholdContext | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("household_members")
    .select("household_id, display_name")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let householdId = existing?.household_id as string | undefined;
  let displayName = existing?.display_name as string | null | undefined;

  if (!householdId) {
    // Bootstrap through a SECURITY DEFINER function rather than inserting here.
    // Doing `insert(households).select("id").single()` from the client looks
    // right but always fails: PostgREST turns .select() into RETURNING, and
    // RETURNING is filtered by the SELECT policy `id in (user_household_ids())`
    // — which the caller does not satisfy until the membership row exists on
    // the next statement. The row got created and came back empty, so every
    // signed-in user silently read as signed-out. See 0007_bootstrap_household.
    const { data: newId, error } = await supabase.rpc("bootstrap_household", {
      p_name: "Our household",
    });
    if (error || !newId) return null;
    householdId = newId as string;
    displayName = user.email?.split("@")[0] ?? null;
  }

  if (!householdId) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    householdId,
    displayName: displayName ?? null,
  };
}

/**
 * The household's real plan baseline, or null when nothing has been written
 * yet. Deliberately does NOT fall back to a sample: showing a fictional plan
 * as though it were yours makes every number on the dashboard a lie.
 */
export async function getBaseline(
  householdId: string,
): Promise<Baseline | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("household_baseline")
    .select("data")
    .eq("household_id", householdId)
    .maybeSingle();

  const stored = data?.data as Partial<Baseline> | undefined;
  if (!stored || Object.keys(stored).length === 0) return null;
  return stored as Baseline;
}

export async function getPayStubs(
  householdId: string,
  ownerUserId?: string,
): Promise<PayStub[]> {
  const supabase = createClient();
  let q = supabase
    .from("pay_stubs")
    .select(
      "id, earner, employer, pay_date, gross_amount, net_amount, taxes, retirement_contrib, other_deductions, is_commission, notes, member_user_id",
    )
    .eq("household_id", householdId);
  if (ownerUserId) q = q.eq("member_user_id", ownerUserId);
  const { data } = await q.order("pay_date", { ascending: false });
  return (data ?? []) as PayStub[];
}

export interface DocumentRow {
  id: string;
  kind: string;
  label: string | null;
  period_label: string | null;
  storage_path: string;
  status: string;
  created_at: string;
  uploaded_by: string | null;
}

export async function getDocuments(
  householdId: string,
  ownerUserId?: string,
): Promise<DocumentRow[]> {
  const supabase = createClient();
  let q = supabase
    .from("documents")
    .select(
      "id, kind, label, period_label, storage_path, status, created_at, uploaded_by",
    )
    .eq("household_id", householdId);
  if (ownerUserId) q = q.eq("uploaded_by", ownerUserId);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as DocumentRow[];
}

export interface PlaidConnection {
  id: string;
  institution_name: string | null;
  created_at: string;
  owner_user_id: string | null;
}

/** Linked Plaid bank connections. Uses the admin client — plaid_items has no
 * RLS policies for regular users, since it holds live bank access tokens.
 *
 * Returns [] when the service-role key isn't configured rather than throwing:
 * a missing env var should degrade the bank-connection feature, not 500 every
 * page that happens to show a connection count. */
export async function getPlaidConnections(
  householdId: string,
): Promise<PlaidConnection[]> {
  if (!isServiceRoleConfigured) return [];
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("plaid_items")
      .select("id, institution_name, created_at, owner_user_id")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });
    return (data ?? []) as PlaidConnection[];
  } catch {
    return [];
  }
}

export interface TransactionRow {
  id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  pending: boolean;
  category: string | null;
}

export async function getTransactions(
  householdId: string,
  limit = 100,
): Promise<TransactionRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("transactions")
    .select("id, name, merchant_name, amount, date, pending, category")
    .eq("household_id", householdId)
    .order("date", { ascending: false })
    .limit(limit);
  return (data ?? []) as TransactionRow[];
}
