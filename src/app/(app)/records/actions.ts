"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/data";

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

function num(fd: FormData, key: string): number {
  const v = parseFloat(String(fd.get(key) ?? ""));
  return Number.isFinite(v) ? v : 0;
}
function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  const s = v ? String(v).trim() : "";
  return s.length ? s : null;
}

/** Both tabs live on one route now, so one revalidate covers the lot. */
function revalidateRecords() {
  revalidatePath("/records");
  revalidatePath("/dashboard");
}

// --- pay stubs --------------------------------------------------------------

export async function addPayStub(fd: FormData): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };

  const pay_date = String(fd.get("pay_date") ?? "");
  if (!pay_date) return { error: "Pay date is required." };

  const supabase = createClient();
  const { error } = await supabase.from("pay_stubs").insert({
    household_id: ctx.householdId,
    member_user_id: ctx.userId,
    created_by: ctx.userId,
    earner: (str(fd, "earner") ?? "Unknown").slice(0, 60),
    employer: str(fd, "employer"),
    pay_date,
    period_start: str(fd, "period_start"),
    period_end: str(fd, "period_end"),
    gross_amount: num(fd, "gross_amount"),
    net_amount: num(fd, "net_amount"),
    taxes: num(fd, "taxes"),
    retirement_contrib: num(fd, "retirement_contrib"),
    other_deductions: num(fd, "other_deductions"),
    is_commission: fd.get("is_commission") === "on",
    notes: str(fd, "notes"),
  });

  if (error) return { error: error.message };
  revalidateRecords();
  return { ok: true };
}

export async function deletePayStub(id: string): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const supabase = createClient();
  await supabase
    .from("pay_stubs")
    .delete()
    .eq("id", id)
    .eq("household_id", ctx.householdId);
  revalidateRecords();
}

// --- statements / documents -------------------------------------------------

export interface RecordInput {
  kind: string;
  label: string | null;
  periodLabel: string | null;
  storagePath: string;
}

export async function recordDocument(input: RecordInput) {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };
  const supabase = createClient();
  const { error } = await supabase.from("documents").insert({
    household_id: ctx.householdId,
    uploaded_by: ctx.userId,
    kind: input.kind,
    label: input.label,
    period_label: input.periodLabel,
    storage_path: input.storagePath,
  });
  if (error) return { error: error.message };
  revalidateRecords();
  return { ok: true };
}

export async function deleteDocument(id: string, storagePath: string) {
  const ctx = await getContext();
  if (!ctx) return;
  const supabase = createClient();
  await supabase.storage.from("statements").remove([storagePath]);
  await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("household_id", ctx.householdId);
  revalidateRecords();
}
