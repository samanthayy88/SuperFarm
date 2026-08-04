"use client";

import { useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
  detail?: string;
}

/** Single-series vertical bar chart (sequential blue), with per-bar hover tooltip. */
/** Axis ticks stay short so they never crowd the plot: 12,400 → 12.4k */
function compact(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return v.toFixed(0);
}

export default function BarChart({
  data,
  height = 200,
  formatValue,
}: {
  data: BarDatum[];
  height?: number;
  formatValue: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const padTop = 16;
  const padBottom = 24;
  const plotH = height - padTop - padBottom;
  const n = data.length;
  const ticks = [0, 0.5, 1];

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 600 ${height}`} className="w-full" role="img" aria-label="Bar chart">
        {/* gridlines */}
        {ticks.map((t) => {
          const y = padTop + plotH * (1 - t);
          return (
            <g key={t}>
              <line x1={36} x2={596} y1={y} y2={y} stroke="#2c2c2a" strokeWidth={1} />
              <text x={32} y={y + 3} textAnchor="end" fontSize={9} fill="#898781">
                {t === 0 ? "0" : compact(max * t)}
              </text>
            </g>
          );
        })}
        {/* bars */}
        {data.map((d, i) => {
          const slot = (600 - 44) / n;
          const barW = Math.min(40, slot * 0.55);
          const x = 40 + slot * i + (slot - barW) / 2;
          const h = (d.value / max) * plotH;
          const y = padTop + plotH - h;
          return (
            <g key={d.label}>
              {/* invisible hit target wider than the bar */}
              <rect
                x={40 + slot * i}
                y={padTop}
                width={slot}
                height={plotH + padBottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, d.value > 0 ? 2 : 0)}
                rx={4}
                fill={hover === i ? "#5598e7" : "#3987e5"}
                style={{ pointerEvents: "none" }}
              />
              {/* baseline-anchored: square off bottom corners */}
              {h > 4 && (
                <rect x={x} y={padTop + plotH - 4} width={barW} height={4} fill={hover === i ? "#5598e7" : "#3987e5"} style={{ pointerEvents: "none" }} />
              )}
              <text
                x={x + barW / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize={10}
                fill={hover === i ? "#c3c2b7" : "#898781"}
              >
                {d.label}
              </text>
            </g>
          );
        })}
        <line x1={36} x2={596} y1={padTop + plotH} y2={padTop + plotH} stroke="#383835" strokeWidth={1} />
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded border border-hairline bg-surface-2 px-3 py-1.5 text-xs shadow-lg">
          <span className="font-medium">{data[hover].label}</span>
          <span className="mx-1.5 text-muted">·</span>
          <span className="tnum">{formatValue(data[hover].value)}</span>
          {data[hover].detail && <span className="ml-1.5 text-muted">{data[hover].detail}</span>}
        </div>
      )}
    </div>
  );
}
