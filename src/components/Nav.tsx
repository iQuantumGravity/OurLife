import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/console", label: "Pay stubs" },
  { href: "/uploads", label: "Statements" },
  { href: "/accounts", label: "Accounts" },
  { href: "/assistant", label: "Assistant" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/account", label: "Account" },
  { href: "/setup", label: "Setup guide" },
];

export function Nav({
  householdName,
  email,
}: {
  householdName: string;
  email?: string | null;
}) {
  return (
    <header className="border-b border-line bg-sunken">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <Link
          href="/dashboard"
          className="shrink-0 font-display text-lg font-semibold"
        >
          OurLife
        </Link>
        <nav className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="shrink-0 whitespace-nowrap rounded-card px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:bg-raised hover:text-teal"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden font-mono text-[11px] uppercase tracking-wider text-muted md:inline">
            {householdName}
            {email ? ` · ${email}` : ""}
          </span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="shrink-0 rounded-card border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted hover:border-clay hover:text-clay"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
