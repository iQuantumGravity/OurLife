import "server-only";
import { createClient } from "@/lib/supabase/server";

// ===========================================================================
// Who is in this household, and how records get attributed to them.
//
// The model is "shared, attributed, filterable": both partners see every
// record and totals always combine, but each row knows whose it is so the UI
// can narrow to one person without ever hiding data from the other.
// ===========================================================================

export interface Person {
  userId: string;
  name: string;
  isYou: boolean;
}

export async function getPeople(
  householdId: string,
  currentUserId: string,
): Promise<Person[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("household_people")
    .select("user_id, name, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((r: any) => ({
    userId: r.user_id as string,
    name: (r.name as string) ?? "Member",
    isYou: r.user_id === currentUserId,
  }));
}

/** The `?who=` filter: a user id, or "all". */
export type WhoFilter = string | "all";

export function parseWho(raw: string | undefined, people: Person[]): WhoFilter {
  if (!raw || raw === "all") return "all";
  return people.some((p) => p.userId === raw) ? raw : "all";
}

export function nameFor(people: Person[], userId: string | null): string {
  if (!userId) return "Unassigned";
  return people.find((p) => p.userId === userId)?.name ?? "Someone";
}

/** Short label for the filter chips — "You", "Wednesday", "Both". */
export function labelFor(people: Person[], who: WhoFilter): string {
  if (who === "all") return people.length > 1 ? "Everyone" : "All";
  const p = people.find((x) => x.userId === who);
  if (!p) return "All";
  return p.isYou ? "You" : p.name;
}
