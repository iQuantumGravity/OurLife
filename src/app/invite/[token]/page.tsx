import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import { getInviteByToken } from "@/lib/onboarding/data";
import { InviteResponse } from "./InviteResponse";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const invite = isSupabaseConfigured
    ? await getInviteByToken(params.token)
    : null;

  const signedIn = isSupabaseConfigured
    ? Boolean((await createClient().auth.getUser()).data.user)
    : false;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 font-mono text-xs uppercase tracking-[0.14em] text-muted">
          OurLife
        </div>

        {!invite ? (
          <>
            <h1 className="font-display text-2xl font-semibold">
              This invite link isn't valid.
            </h1>
            <p className="mt-2 text-sm text-muted">
              It may have been cancelled, or the link is mistyped. Ask
              whoever sent it to send a fresh one.
            </p>
          </>
        ) : invite.status !== "pending" ? (
          <>
            <h1 className="font-display text-2xl font-semibold">
              {invite.status === "accepted"
                ? "This invite has already been accepted."
                : "This invite was already declined."}
            </h1>
            <p className="mt-2 text-sm text-muted">
              Nothing more to do here.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold leading-tight">
              {invite.inviterName ?? "Someone"} wants to plan{" "}
              {invite.householdName} together with you.
            </h1>
            <p className="mt-3 text-sm text-muted">
              Accepting means you'll both see the same plan — goals, pay
              stubs, statements, all of it. You can decline if this isn't the
              right time; nothing happens until you choose.
            </p>

            <InviteResponse token={params.token} signedIn={signedIn} />
          </>
        )}
      </div>
    </main>
  );
}
