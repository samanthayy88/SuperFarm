"use client";

import { useState } from "react";

export interface GroupedBarDatum {
  label: string;
  values: number[]; // one value per series, same order as `seriesNames`
}

/** Axis ticks stay short so they never crowd the plot: 12,400 → 12.4k */
function compact(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return v.toFixed(0);
}

const SERIES_COLORS = [
  { fill: "var(--chart-1)", hover: "var(--chart-1-hover)" },
  { fill: "var(--chart-2)", hover: "var(--chart-2-hover)" },
];

/**
 * Two-series vertical grouped bar chart (e.g. Target vs Actual per worker),
 * with a legend and a per-category hover tooltip showing both values.
 * Colours reference theme CSS variables directly, so it follows light/dark.
 */
export default function GroupedBarChart({
  data,
  seriesNames,
  height = 220,
  formatValue,
}: {
  data: GroupedBarDatum[];
  seriesNames: [string, string];
  height?: number;
  formatValue: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const padTop = 16;
  const padBottom = 24;
  const plotH = height - padTop - padBottom;
  const n = data.length;
  const ticks = [0, 0.5, 1];

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-4">
        {seriesNames.map((name, i) => (
          <span key={name} className="flex items-center gap-1.5 text-xs text-muted">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: SERIES_COLORS[i].fill }}
              aria-hidden
            />
            {name}
          </span>
        ))}
      </div>
      <div className="relative w-full">
        <svg viewBox={`0 0 600 ${height}`} className="w-full" role="img" aria-label="Grouped bar chart">
          {ticks.map((t) => {
            const y = padTop + plotH * (1 - t);
            return (
              <g key={t}>
                <line x1={36} x2={596} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
                <text x={32} y={y + 3} textAnchor="end" fontSize={9} fill="var(--muted)">
                  {t === 0 ? "0" : compact(max * t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const slot = (600 - 44) / n;
            const groupW = Math.min(52, slot * 0.7);
            const barW = groupW / 2 - 2;
            const groupX = 40 + slot * i + (slot - groupW) / 2;
            return (
              <g key={d.label}>
                <rect
                  x={40 + slot * i}
                  y={padTop}
                  width={slot}
                  height={plotH + padBottom}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
                {d.values.map((v, si) => {
                  const h = (v / max) * plotH;
                  const y = padTop + plotH - h;
                  const x = groupX + si * (barW + 4);
                  const fill = hover === i ? SERIES_COLORS[si].hover : SERIES_COLORS[si].fill;
                  return (
                    <rect
                      key={si}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(h, v > 0 ? 2 : 0)}
                      rx={3}
                      fill={fill}
                      style={{ pointerEvents: "none" }}
                    />
                  );
                })}
                <text
                  x={groupX + groupW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill={hover === i ? "var(--ink-2)" : "var(--muted)"}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
          <line
            x1={36}
            x2={596}
            y1={padTop + plotH}
            y2={padTop + plotH}
            stroke="var(--chart-axis)"
            strokeWidth={1}
          />
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs shadow-pop">
            <span className="font-medium text-ink">{data[hover].label}</span>
            {seriesNames.map((name, si) => (
              <span key={name} className="ml-2">
                <span className="text-muted">{name}:</span>{" "}
                <span className="tnum text-ink-2">{formatValue(data[hover].values[si] ?? 0)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
