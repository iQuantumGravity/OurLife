"use server";

import { respondToInvite } from "@/lib/onboarding/data";
import { InviteResponseActionSchema } from "@/lib/onboarding/schema";

export async function respond(token: string, action: "accept" | "decline") {
  const parsed = InviteResponseActionSchema.safeParse(action);
  if (!parsed.success) return { error: "Invalid action." };
  return respondToInvite(token, parsed.data);
}
