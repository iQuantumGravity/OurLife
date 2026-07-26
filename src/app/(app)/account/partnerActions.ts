"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import {
  createInvite as createInviteRow,
  cancelInvite as cancelInviteRow,
} from "@/lib/onboarding/data";
import { InviteContactSchema } from "@/lib/onboarding/schema";

/**
 * Does this contact already have an account, and are they already here?
 *
 * Returns booleans only — never a user id, and never anything about a person
 * beyond "an account exists". The underlying lookup is a SECURITY DEFINER
 * function that isn't exposed to clients precisely so it can't be used as an
 * account-enumeration oracle; this wrapper keeps that property by requiring a
 * signed-in caller who belongs to a household.
 */
export async function lookupPartner(contact: string): Promise<{
  hasAccount?: boolean;
  alreadyMember?: boolean;
  error?: string;
}> {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };

  const trimmed = contact.trim();
  const isEmail = trimmed.includes("@");
  const parsed = InviteContactSchema.safeParse(
    isEmail ? { email: trimmed } : { phone: trimmed },
  );
  if (!parsed.success) {
    return {
      error: isEmail
        ? "That doesn't look like a valid email address."
        : "Enter a full email address or phone number.",
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("partner_lookup", {
    p_household_id: ctx.householdId,
    p_email: isEmail ? trimmed : null,
    p_phone: isEmail ? null : trimmed,
  });
  if (error) return { error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { has_account: boolean; already_member: boolean }
    | null;
  return {
    hasAccount: Boolean(row?.has_account),
    alreadyMember: Boolean(row?.already_member),
  };
}

export type SendInviteResult =
  | { ok: true; error?: undefined; matched: boolean; inviteUrl: string }
  | { ok?: false; error: string };

export async function invitePartner(input: {
  email?: string;
  phone?: string;
}): Promise<SendInviteResult> {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };

  const parsed = InviteContactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Add an email or phone number." };
  }

  const result = await createInviteRow(ctx.householdId, parsed.data);
  if ("error" in result && result.error) return { error: result.error };
  if (!("token" in result) || !result.token) {
    return { error: "Could not create that invite." };
  }

  revalidatePath("/account");
  revalidatePath("/onboarding");
  return {
    ok: true,
    matched: Boolean(result.matched),
    inviteUrl: `/invite/${result.token}`,
  };
}

export async function cancelInvite(inviteId: string) {
  const ctx = await getContext();
  if (!ctx) return { error: "You've been signed out — sign in and try again." };
  const res = await cancelInviteRow(inviteId);
  revalidatePath("/account");
  revalidatePath("/onboarding");
  return res;
}
