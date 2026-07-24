"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/data";

export interface RecordInput {
  kind: string;
  label: string | null;
  periodLabel: string | null;
  storagePath: string;
}

export async function recordDocument(input: RecordInput) {
  const ctx = await getContext();
  if (!ctx) return { error: "Backend not connected or not signed in." };
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
  revalidatePath("/uploads");
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
  revalidatePath("/uploads");
}
