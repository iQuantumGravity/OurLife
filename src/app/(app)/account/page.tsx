import { getContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ConnectBanner } from "@/components/ConnectBanner";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const ctx = await getContext();

  if (!ctx) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
            Account
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold">Your account</h1>
        </header>
        <ConnectBanner />
      </div>
    );
  }

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("phone, display_name")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Account
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold">Your account</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {ctx.email} · Add a phone number here so a partner can find and
          invite you by phone instead of email.
        </p>
      </header>

      <section className="max-w-md rounded-card border border-line bg-raised p-6">
        <ProfileForm
          initialPhone={(profile?.phone as string | null) ?? ""}
          initialDisplayName={
            (profile?.display_name as string | null) ?? ctx.displayName ?? ""
          }
        />
      </section>
    </div>
  );
}
