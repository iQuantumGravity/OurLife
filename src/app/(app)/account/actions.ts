"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/data";

export async function saveProfile(input: { phone: string; displayName: string }) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not signed in." };

  const phone = input.phone.trim();
  const displayName = input.displayName.trim();
  if (phone && !/^\+?[0-9()\-.\s]{7,20}$/.test(phone)) {
    return { error: "That doesn't look like a phone number." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: ctx.userId,
      phone: phone || null,
      display_name: displayName || null,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    return {
      error: error.code === "23505" ? "That phone number is already in use." : error.message,
    };
  }
  revalidatePath("/account");
  return { ok: true };
}
