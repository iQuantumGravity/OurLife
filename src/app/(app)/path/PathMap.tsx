"use client";

import { useMemo, useRef, useState } from "react";
import type { LifePath, PathStage } from "@/lib/model/path";
import { usd, monthLabel } from "@/lib/format";

// ===========================================================================
// The interactive life map.
//
// Zoom is a CSS scale on a track of stage cards rather than an SVG transform:
// the content stays real DOM, so it remains selectable, focusable and
// screen-reader navigable at every zoom level, and touch scrolling is the
// browser's own rather than something reimplemented badly.
// ===========================================================================

const ZOOMS = [
  { id: "far", label: "Overview", scale: 0.62 },
  { id: "mid", label: "Stages", scale: 1 },
  { id: "near", label: "Detail", scale: 1.45 },
] as const;

type ZoomId = (typeof ZOOMS)[number]["id"];

const STATUS_STYLE: Record<PathStage["status"], { dot: string; ring: string; label: string }> = {
  done: { dot: "bg-teal", ring: "border-teal/60", label: "Passed" },
  current: { dot: "bg-clay", ring: "border-clay", label: "Now" },
  upcoming: { dot: "bg-line", ring: "border-line", label: "Ahead" },
  undated: { dot: "bg-line", ring: "border-line border-dashed", label: "No date" },
};

export function PathMap({ path }: { path: LifePath }) {
  const [zoom, setZoom] = useState<ZoomId>("mid");
  const [openId, setOpenId] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const scale = ZOOMS.find((z) => z.id === zoom)!.scale;

  const { done, total } = useMemo(() => {
    const dated = path.stages.filter((s) => s.status !== "undated");
    return {
      done: dated.filter((s) => s.status === "done").length,
      total: dated.length,
    };
  }, [path.stages]);

  if (path.stages.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-raised/50 p-8 text-center">
        <div className="font-display text-lg font-semibold">
          No path to draw yet.
        </div>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Add a few goals with dates and amounts — in onboarding, or by telling
          the assistant — and they&apos;ll appear here as stages you can walk
          through.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <a
            href="/onboarding"
            className="rounded-card bg-teal px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Add goals
          </a>
          <a
            href="/assistant"
            className="rounded-card border border-line px-4 py-2.5 text-sm text-muted hover:border-teal hover:text-teal"
          >
            Ask the assistant
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Zoom
          </span>
          <div className="inline-flex rounded-card border border-line bg-sunken p-1">
            {ZOOMS.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => setZoom(z.id)}
                aria-pressed={zoom === z.id}
                className={
                  "rounded-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors " +
                  (zoom === z.id
                    ? "bg-raised text-teal"
                    : "text-muted hover:text-fg")
                }
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>
        {total > 0 && (
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            {done} of {total} stages passed
          </span>
        )}
      </div>

      {/* the track */}
      <div
        ref={trackRef}
        className="overflow-x-auto rounded-card border border-line bg-raised p-4 [scrollbar-width:thin]"
      >
        <div
          className="origin-left transition-transform duration-200"
          style={{ transform: `scale(${scale})`, width: `${100 / scale}%` }}
        >
          <ol className="relative flex min-w-max items-stretch gap-4 pb-2">
            {/* the road */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 top-[1.6rem] h-0.5 bg-line"
            />
            {path.stages.map((s) => (
              <StageCard
                key={s.id}
                stage={s}
                open={openId === s.id}
                onToggle={() => setOpenId(openId === s.id ? null : s.id)}
              />
            ))}
          </ol>
        </div>
      </div>

      <p className="text-xs text-muted">
        Tap a stage for detail. Progress is computed from what you&apos;ve
        actually logged — a stage with no target amount shows no percentage
        rather than a made-up one.
      </p>
    </div>
  );
}

function StageCard({
  stage,
  open,
  onToggle,
}: {
  stage: PathStage;
  open: boolean;
  onToggle: () => void;
}) {
  const style = STATUS_STYLE[stage.status];
  const pct = stage.progress !== null ? Math.round(stage.progress * 100) : null;

  return (
    <li className="relative flex w-56 shrink-0 flex-col">
      {/* node on the road */}
      <div className="flex h-14 items-center justify-center">
        <span
          className={`relative z-10 h-3.5 w-3.5 rounded-full ring-4 ring-raised ${style.dot}`}
          aria-hidden
        />
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex flex-1 flex-col rounded-card border bg-sunken p-3 text-left transition-colors hover:border-teal ${style.ring}`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {stage.kind === "phase" ? "Phase" : style.label}
          </span>
          {stage.month && (
            <span className="font-mono text-[10px] tabular text-muted">
              {monthLabel(stage.month)}
            </span>
          )}
        </div>

        <div className="mt-1 font-display text-sm font-semibold leading-snug text-fg">
          {stage.name}
        </div>

        {stage.target !== null && (
          <div className="mt-1 font-mono text-xs tabular text-muted">
            {usd(stage.target)}
          </div>
        )}

        {/* progress meter */}
        {pct !== null ? (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className={
                  "h-full rounded-full transition-all " +
                  (pct >= 100 ? "bg-teal" : "bg-gold")
                }
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
              {pct}% funded
            </div>
          </div>
        ) : (
          <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
            No target set
          </div>
        )}

        {open && (
          <div className="mt-3 border-t border-line pt-2 text-xs text-muted">
            {stage.detail && <p>{stage.detail}</p>}
            {stage.saved !== null && stage.target !== null && (
              <p className="mt-1 font-mono tabular">
                {usd(stage.saved)} of {usd(stage.target)}
              </p>
            )}
            {!stage.detail && stage.saved === null && (
              <p>Nothing logged against this yet.</p>
            )}
          </div>
        )}
      </button>
    </li>
  );
}
