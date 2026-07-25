import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext, getPayStubs, getDocuments, getPlaidConnections } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { listInvites, getOnboardingState } from "@/lib/onboarding/data";
import { ProfileForm } from "./ProfileForm";
import { CancelInviteButton } from "./CancelInviteButton";
import { dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const ctx = await getContext();
  if (!ctx) redirect("/login");

  const supabase = createClient();

  const [profileRes, membersRes, householdRes, invites, stateRes, stubs, docs, connections] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("phone, display_name")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      supabase
        .from("household_members")
        .select("user_id, display_name, role, created_at")
        .eq("household_id", ctx.householdId)
        .order("created_at", { ascending: true }),
      supabase
        .from("households")
        .select("name, created_at")
        .eq("id", ctx.householdId)
        .maybeSingle(),
      listInvites(ctx.householdId),
      getOnboardingState(ctx.householdId),
      getPayStubs(ctx.householdId),
      getDocuments(ctx.householdId),
      getPlaidConnections(ctx.householdId),
    ]);

  const profile = profileRes.data;
  const members = membersRes.data ?? [];
  const household = householdRes.data;
  const pending = invites.filter((i) => i.status === "pending");

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Account
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          You &amp; your household
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Your details, who you&apos;re planning with, and what&apos;s in the
          plan so far.
        </p>
      </section>

      {/* at-a-glance */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4">
        <Stat label="Members" value={String(members.length)} />
        <Stat
          label="Pay stubs"
          value={String(stubs.length)}
          href="/records?tab=stubs"
        />
        <Stat
          label="Statements"
          value={String(docs.length)}
          href="/records?tab=statements"
        />
        <Stat
          label="Banks linked"
          value={String(connections.length)}
          href="/accounts"
        />
      </section>

      {/* your profile */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Your details</h2>
        <div className="max-w-md rounded-card border border-line bg-raised p-5 sm:p-6">
          <div className="mb-4 border-b border-line pb-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Email
            </div>
            <div className="mt-0.5 break-all text-sm text-fg">{ctx.email}</div>
            <div className="mt-1 text-xs text-muted">
              Set at sign-up and used to sign in — not editable here.
            </div>
          </div>
          <ProfileForm
            initialPhone={(profile?.phone as string | null) ?? ""}
            initialDisplayName={
              (profile?.display_name as string | null) ?? ctx.displayName ?? ""
            }
          />
        </div>
      </section>

      {/* household */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Household</h2>
        <div className="rounded-card border border-line bg-raised p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="font-display text-lg font-semibold">
                {household?.name ?? "Our household"}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {household?.created_at
                  ? `Created ${dateLabel(household.created_at.slice(0, 10))}`
                  : ""}
                {" · "}
                Planning {stateRes.state.mode === "couple" ? "as a couple" : "solo"}
              </div>
            </div>
            <Link
              href="/onboarding"
              className="font-mono text-[11px] uppercase tracking-wider text-teal hover:underline"
            >
              Change in onboarding →
            </Link>
          </div>

          <ul className="mt-5 flex flex-col gap-2">
            {members.map((m: any) => (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line px-4 py-3 text-sm"
              >
                <div>
                  <span className="text-fg">
                    {m.display_name ?? "Member"}
                    {m.user_id === ctx.userId && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-teal">
                        you
                      </span>
                    )}
                  </span>
                  <div className="text-xs text-muted">
                    {m.role ?? "partner"} · joined{" "}
                    {dateLabel(String(m.created_at).slice(0, 10))}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {pending.length > 0 && (
            <>
              <h3 className="mt-6 font-mono text-[11px] uppercase tracking-wider text-muted">
                Pending invites
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {pending.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line px-4 py-2.5 text-sm"
                  >
                    <div>
                      <span className="text-fg">
                        {inv.invitee_email ?? inv.invitee_phone}
                      </span>
                      <div className="text-xs text-muted">
                        expires {dateLabel(inv.expires_at.slice(0, 10))}
                      </div>
                    </div>
                    <CancelInviteButton inviteId={inv.id} />
                  </li>
                ))}
              </ul>
            </>
          )}

          {members.length === 1 && pending.length === 0 && (
            <p className="mt-5 rounded-card border border-dashed border-line p-4 text-sm text-muted">
              It&apos;s just you right now.{" "}
              <Link href="/onboarding" className="text-teal hover:underline">
                Invite a partner
              </Link>{" "}
              to plan together — they&apos;ll get their own login and see the
              same plan.
            </p>
          )}
        </div>
      </section>

      {/* connections & config */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          Connections
        </h2>
        <div className="flex flex-col gap-2">
          <RowLink
            href="/accounts"
            title="Bank accounts"
            detail={
              connections.length > 0
                ? `${connections.length} linked via Plaid`
                : "None linked yet"
            }
          />
          <RowLink
            href="/setup"
            title="Setup guide"
            detail="Check which services are connected in this deployment"
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
    </>
  );
  return href ? (
    <Link href={href} className="bg-raised p-4 transition-colors hover:bg-sunken">
      {inner}
    </Link>
  ) : (
    <div className="bg-raised p-4">{inner}</div>
  );
}

function RowLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-card border border-line bg-raised px-4 py-3 transition-colors hover:border-teal"
    >
      <div>
        <div className="text-sm font-medium text-fg">{title}</div>
        <div className="text-xs text-muted">{detail}</div>
      </div>
      <span className="font-mono text-teal">→</span>
    </Link>
  );
}
