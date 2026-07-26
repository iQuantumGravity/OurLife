import Link from "next/link";
import type { Person, WhoFilter } from "@/lib/people";

/**
 * "Everyone / You / Partner" chips. Plain links carrying `?who=`, so the
 * choice survives a refresh, is shareable, and needs no client JS — the same
 * reasoning as the Records tab toggle.
 */
export function PersonFilter({
  people,
  who,
  basePath,
  extraParams = {},
}: {
  people: Person[];
  who: WhoFilter;
  basePath: string;
  extraParams?: Record<string, string | undefined>;
}) {
  // With nobody to compare against, a filter is just noise.
  if (people.length < 2) return null;

  const href = (value: string) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams)) if (v) params.set(k, v);
    if (value !== "all") params.set("who", value);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const chip = (active: boolean) =>
    "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors " +
    (active
      ? "border-teal bg-teal/10 text-teal"
      : "border-line text-muted hover:border-teal hover:text-teal");

  return (
    <div
      className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Filter by person"
    >
      <Link href={href("all")} className={chip(who === "all")}>
        Everyone
      </Link>
      {people.map((p) => (
        <Link
          key={p.userId}
          href={href(p.userId)}
          className={chip(who === p.userId)}
        >
          {p.isYou ? "You" : p.name}
        </Link>
      ))}
    </div>
  );
}

/** Small "whose is this" tag for a row in a shared list. */
export function OwnerTag({ name, isYou }: { name: string; isYou?: boolean }) {
  return (
    <span
      className={
        "ml-2 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider " +
        (isYou ? "bg-teal/15 text-teal" : "bg-line text-muted")
      }
    >
      {isYou ? "you" : name}
    </span>
  );
}
