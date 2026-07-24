"use client";

import type { ElevationPoint } from "@/lib/model/types";
import { usdK } from "@/lib/format";

// The "savings elevation profile" — the plan's balance over time, read like a
// hike's elevation chart. The valley point is the tightest moment.
export function Elevation({ points }: { points: ElevationPoint[] }) {
  if (points.length < 2) return null;

  const W = 760;
  const H = 300;
  const padL = 54;
  const padR = 24;
  const padT = 28;
  const padB = 52;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxV = Math.max(...points.map((p) => p.value)) * 1.12;
  const x = (i: number) => padL + (innerW * i) / (points.length - 1);
  const y = (v: number) => padT + innerH * (1 - v / maxV);

  const teal = "rgb(var(--teal))";
  const clay = "rgb(var(--clay))";
  const muted = "rgb(var(--fg-muted))";
  const fg = "rgb(var(--fg))";
  const raised = "rgb(var(--bg-raised))";

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
  const area = `${line} L ${x(points.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;

  const grid = Array.from({ length: 5 }, (_, i) => (maxV / 4) * i);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Projected savings balance over time"
    >
      {grid.map((gv, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(gv)}
            y2={y(gv)}
            style={{ stroke: muted, strokeOpacity: 0.25 }}
            strokeWidth={1}
          />
          <text
            x={padL - 10}
            y={y(gv) + 4}
            textAnchor="end"
            style={{ fill: muted, fontSize: 11, fontFamily: "var(--font-mono)" }}
          >
            {usdK(gv)}
          </text>
        </g>
      ))}

      <path d={area} style={{ fill: teal, fillOpacity: 0.12 }} />
      <path
        d={line}
        fill="none"
        style={{ stroke: teal }}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((p, i) => {
        const isEnd = i === points.length - 1;
        const anchor = i === 0 ? "start" : isEnd ? "end" : "middle";
        return (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={p.valley || isEnd ? 5.5 : 4}
              style={{
                fill: p.valley ? clay : isEnd ? teal : raised,
                stroke: p.valley ? clay : teal,
              }}
              strokeWidth={2}
            />
            <text
              x={x(i)}
              y={p.valley ? y(p.value) + 22 : y(p.value) - 12}
              textAnchor={anchor}
              style={{
                fill: p.valley ? clay : fg,
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
              }}
            >
              {usdK(p.value)}
            </text>
            <text
              x={x(i)}
              y={H - padB + 22}
              textAnchor={anchor}
              style={{ fill: muted, fontSize: 11, fontFamily: "var(--font-mono)" }}
            >
              {p.label}
            </text>
            <text
              x={x(i)}
              y={H - padB + 37}
              textAnchor={anchor}
              style={{ fill: muted, fontSize: 9.5, opacity: 0.8, fontFamily: "var(--font-body)" }}
            >
              {p.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
