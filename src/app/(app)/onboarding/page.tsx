import { getContext, getDocuments, getPlaidConnections } from "@/lib/data";
import { ConnectBanner } from "@/components/ConnectBanner";
import {
  getOnboardingState,
  getOnboardingAnswers,
  getHouseholdAnswers,
  listInvites,
} from "@/lib/onboarding/data";
import { Wizard } from "./Wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getContext();

  if (!ctx) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
            Onboarding
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            Let's set up your plan.
          </h1>
        </header>
        <ConnectBanner />
      </div>
    );
  }

  const [{ state, exists }, answers, householdAnswers, invites, connections, documents] =
    await Promise.all([
      getOnboardingState(ctx.householdId),
      getOnboardingAnswers(ctx.householdId, ctx.userId),
      getHouseholdAnswers(ctx.householdId),
      listInvites(ctx.householdId),
      getPlaidConnections(ctx.householdId),
      getDocuments(ctx.householdId),
    ]);

  const partner = householdAnswers.find((m) => m.userId !== ctx.userId) ?? null;

  return (
    <Wizard
      mode={state.mode}
      stateExists={exists}
      answers={answers}
      partnerAnswers={partner?.answers ?? null}
      partnerName={partner?.displayName ?? null}
      comparisonViewed={Boolean(state.comparisonViewedAt)}
      hasPlaidConnection={connections.length > 0}
      hasDocument={documents.length > 0}
      invites={invites}
    />
  );
}
