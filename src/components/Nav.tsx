import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/console", label: "Pay stubs" },
  { href: "/uploads", label: "Statements" },
  { href: "/accounts", label: "Accounts" },
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
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <Link href="/dashboard" className="font-display text-lg font-semibold">
          OurLife
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-card px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:bg-raised hover:text-teal"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-[11px] uppercase tracking-wider text-muted sm:inline">
            {householdName}
            {email ? ` · ${email}` : ""}
          </span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-card border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted hover:border-clay hover:text-clay"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
