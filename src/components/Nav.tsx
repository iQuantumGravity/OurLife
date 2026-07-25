"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Four primary destinations. Everything account-shaped — profile, household,
// setup, onboarding, sign out — lives behind the menu on the right, so the bar
// stays legible on a phone instead of scrolling to eight items.
const PRIMARY = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/records", label: "Records" },
  { href: "/accounts", label: "Accounts" },
  { href: "/assistant", label: "Assistant" },
];

const MENU = [
  { href: "/account", label: "Account & household" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/setup", label: "Setup guide" },
];

export function Nav({
  householdName,
  email,
}: {
  householdName: string;
  email?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Any navigation closes the menu.
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-sunken/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-5">
        <Link
          href="/dashboard"
          className="shrink-0 font-display text-lg font-semibold"
        >
          OurLife
        </Link>

        <nav
          aria-label="Primary"
          className="-mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PRIMARY.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={
                  "shrink-0 whitespace-nowrap rounded-card px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors sm:px-3 " +
                  (active
                    ? "bg-raised text-teal"
                    : "text-muted hover:bg-raised hover:text-fg")
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
            className={
              "flex items-center gap-1.5 rounded-card border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors sm:px-3 " +
              (open
                ? "border-teal text-teal"
                : "border-line text-muted hover:border-teal hover:text-teal")
            }
          >
            <span className="hidden max-w-[10rem] truncate sm:inline">
              {householdName}
            </span>
            <span className="sm:hidden">Menu</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              aria-hidden="true"
              className={"transition-transform " + (open ? "rotate-180" : "")}
            >
              <path
                d="M1 3l4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-card border border-line bg-raised shadow-lg"
            >
              {email && (
                <div className="border-b border-line px-4 py-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Signed in as
                  </div>
                  <div className="mt-0.5 truncate text-sm text-fg">{email}</div>
                </div>
              )}
              {MENU.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  role="menuitem"
                  className={
                    "block px-4 py-2.5 text-sm transition-colors hover:bg-sunken " +
                    (isActive(l.href) ? "text-teal" : "text-fg")
                  }
                >
                  {l.label}
                </Link>
              ))}
              <form
                action="/auth/signout"
                method="post"
                className="border-t border-line"
              >
                <button
                  type="submit"
                  role="menuitem"
                  className="w-full px-4 py-2.5 text-left text-sm text-muted transition-colors hover:bg-sunken hover:text-clay"
                >
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
