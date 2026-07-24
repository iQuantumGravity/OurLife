import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import { SAMPLE_BASELINE } from "@/lib/model/sample-baseline";
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
    const fallbackName = user.email?.split("@")[0] ?? null;
    const { data: hh } = await supabase
      .from("households")
      .insert({ name: "Our household", created_by: user.id })
      .select("id")
      .single();
    if (!hh) return null;
    householdId = hh.id;
    await supabase.from("household_members").insert({
      household_id: hh.id,
      user_id: user.id,
      display_name: fallbackName,
    });
    await supabase.from("household_baseline").insert({
      household_id: hh.id,
      data: {},
    });
    displayName = fallbackName;
  }

  if (!householdId) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    householdId,
    displayName: displayName ?? null,
  };
}

/** The household's plan baseline, falling back to the sample template. */
export async function getBaseline(householdId: string): Promise<Baseline> {
  const supabase = createClient();
  const { data } = await supabase
    .from("household_baseline")
    .select("data")
    .eq("household_id", householdId)
    .maybeSingle();

  const stored = data?.data as Partial<Baseline> | undefined;
  if (stored && Object.keys(stored).length > 0) {
    return { ...SAMPLE_BASELINE, ...stored, isSample: false } as Baseline;
  }
  return SAMPLE_BASELINE;
}

export async function getPayStubs(householdId: string): Promise<PayStub[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("pay_stubs")
    .select(
      "id, earner, employer, pay_date, gross_amount, net_amount, taxes, retirement_contrib, other_deductions, is_commission, notes",
    )
    .eq("household_id", householdId)
    .order("pay_date", { ascending: false });
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
}

export async function getDocuments(
  householdId: string,
): Promise<DocumentRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, kind, label, period_label, storage_path, status, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  return (data ?? []) as DocumentRow[];
}
