import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase access for the assistant + document pipeline.
 *
 * Everything here runs as the signed-in user, so row-level security is what
 * keeps one household's numbers away from another's. No service-role key is
 * used anywhere in this app.
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function aiSupabase(): SupabaseClient {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll() {
          // Route handlers and server components can't write cookies here;
          // the middleware refreshes the session on navigation instead.
        },
      },
    }
  );
}

export type HouseholdContext = {
  userId: string;
  householdId: string;
};

/**
 * The household the signed-in user belongs to, creating it on first run so a
 * brand-new account has somewhere to put its plan.
 */
export async function currentHousehold(
  supabase: SupabaseClient
): Promise<HouseholdContext | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return null;

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership?.household_id) {
    return { userId: user.id, householdId: membership.household_id as string };
  }

  const { data: household, error } = await supabase
    .from("households")
    .insert({ name: "Our household", created_by: user.id })
    .select("id")
    .single();

  if (error || !household) return null;

  const householdId = household.id as string;

  await supabase.from("household_members").insert({
    household_id: householdId,
    user_id: user.id,
    display_name: user.email ?? null,
  });

  await supabase
    .from("household_baseline")
    .insert({ household_id: householdId, data: {} });

  return { userId: user.id, householdId };
}
