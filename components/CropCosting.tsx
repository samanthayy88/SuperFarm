"use client";

import { Fragment, useState } from "react";
import { useStore } from "@/lib/store";
import { Card, Table, Th, Td, StatCard, Field, TextInput, Select, EmptyState, Badge } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate } from "@/lib/utils";
import { COST_GROUPS, PlotSeason, SeasonResult, plotSeasons, seasonCosting } from "@/lib/costing";
import { DB } from "@/lib/types";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function plotLabel(db: DB, plotId: string) {
  const p = db.plots.find((x) => x.id === plotId);
  const f = db.farms.find((x) => x.id === p?.farmId);
  return p ? `${f?.name ?? "—"} › ${p.name}` : "—";
}

function resultFor(db: DB, s: PlotSeason): SeasonResult {
  return seasonCosting(db, { plotId: s.plotId, cropId: s.cropId, from: s.start, to: s.end, workerIds: s.workerIds });
}

export default function CropCosting() {
  const { db } = useStore();
  const seasons = plotSeasons(db);

  // open on the most recent season that actually has harvests, else the most recent one
  const [sel, setSel] = useState(() => {
    const first = seasons.find((s) => resultFor(db, s).harvestedKg > 0) ?? seasons[0];
    return first
      ? { plotId: first.plotId, cropId: first.cropId, from: first.start, to: first.end }
      : { plotId: db.plots[0]?.id ?? "", cropId: db.plots[0]?.cropId ?? "", from: "", to: "" };
  });

  const matching = seasons.find(
    (s) => s.plotId === sel.plotId && s.cropId === sel.cropId && s.start === sel.from && s.end === sel.to
  );
  const res = seasonCosting(db, { ...sel, workerIds: matching?.workerIds });
  const cropName = db.crops.find((c) => c.id === sel.cropId)?.name ?? "—";
  const harvested = res.harvestedKg;

  const pickSeason = (key: string) => {
    const s = seasons.find((x) => x.key === key);
    if (s) setSel({ plotId: s.plotId, cropId: s.cropId, from: s.start, to: s.end });
  };
  const pickPlot = (plotId: string) => {
    const p = db.plots.find((x) => x.id === plotId);
    setSel({ ...sel, plotId, cropId: p?.cropId ?? sel.cropId });
  };

  const money = res.profit >= 0;
  const unsold = res.unsoldKg > 0.5;

  // every season, grouped by crop, for the comparison table
  const rows = seasons
    .map((s) => ({ s, r: resultFor(db, s) }))
    .sort((a, b) => (db.crops.find((c) => c.id === a.s.cropId)?.name ?? "").localeCompare(db.crops.find((c) => c.id === b.s.cropId)?.name ?? "") || b.s.start.localeCompare(a.s.start));
  const cropGroups = [...new Set(rows.map((x) => x.s.cropId))];

  return (
    <div className="space-y-6">
      <Card title="Choose a crop season">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-5">
            <Field label="Quick pick — a season already on record">
              <Select value={matching?.key ?? ""} onChange={(e) => pickSeason(e.target.value)}>
                <option value="">Custom (set plot, crop and dates below)</option>
                {seasons.map((s) => (
                  <option key={s.key} value={s.key}>
                    {db.crops.find((c) => c.id === s.cropId)?.name}
                    {s.variety ? ` (${s.variety})` : ""} — {plotLabel(db, s.plotId)} — {fmtDate(s.start)} to {fmtDate(s.end)}
                    {s.ongoing ? " (ongoing)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="lg:col-span-2">
            <Field label="Farm › Plot">
              <Select value={sel.plotId} onChange={(e) => pickPlot(e.target.value)}>
                {db.plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {plotLabel(db, p.id)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Crop">
            <Select value={sel.cropId} onChange={(e) => setSel({ ...sel, cropId: e.target.value })}>
              {db.crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <TextInput type="date" value={sel.from} onChange={(e) => setSel({ ...sel, from: e.target.value })} />
          </Field>
          <Field label="To">
            <TextInput type="date" value={sel.to} onChange={(e) => setSel({ ...sel, to: e.target.value })} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">
          Costs and harvests are counted between these dates. If you sell after the season ends, move “To” later so those
          sales are included.
        </p>
      </Card>

      {!sel.from || !sel.to || sel.from > sel.to ? (
        <Card>
          <EmptyState message="Pick a season, or set a valid From and To date." />
        </Card>
      ) : (
        <>
          <div
            className={`rounded-card border p-4 text-sm ${
              res.revenue === 0
                ? "border-hairline bg-surface-2 text-ink-2"
                : money
                  ? "border-good bg-good-soft text-good"
                  : "border-critical bg-critical-soft text-critical"
            }`}
          >
            {res.revenue === 0 ? (
              <>
                No sales of {cropName} recorded in this period yet, so profit can&apos;t be worked out. Production cost so far is{" "}
                <strong>{fmtRM(res.costPerKg)}/kg</strong>.
              </>
            ) : (
              <>
                {money ? "You made money" : "You lost money"} on {cropName} in {plotLabel(db, sel.plotId)}:{" "}
                <strong>
                  {money ? "profit" : "loss"} of {fmtRM(Math.abs(res.profit))}
                </strong>{" "}
                ({fmtRM(Math.abs(res.profitPerKg))}/kg {money ? "profit" : "loss"}) after all expenses. It cost{" "}
                <strong>{fmtRM(res.costPerKg)}</strong> to produce each kg and you sold at an average{" "}
                <strong>{fmtRM(res.avgPrice)}/kg</strong>.
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total production cost" value={fmtRM0(res.totalCost)} sub="Workers + rent + utilities + inputs" />
            <StatCard label="Harvested" value={`${harvested.toLocaleString()} kg`} sub={`${res.soldKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg sold`} />
            <StatCard label={`Production cost per kg ${cropName}`} value={harvested > 0 ? fmtRM(res.costPerKg) : "—"} sub="Total cost ÷ kg harvested" />
            <StatCard label="Revenue (sold)" value={fmtRM0(res.revenue)} sub={res.avgPrice > 0 ? `Avg ${fmtRM(res.avgPrice)}/kg` : "No sales in period"} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={money ? "Profit" : "Loss"}
              value={res.revenue === 0 ? "—" : fmtRM0(res.profit)}
              tone={res.revenue === 0 ? undefined : money ? "good" : "critical"}
              sub="Revenue − total cost"
            />
            <StatCard
              label="Profit per kg"
              value={res.revenue === 0 || harvested === 0 ? "—" : fmtRM(res.profitPerKg)}
              tone={res.revenue === 0 ? undefined : money ? "good" : "critical"}
            />
            <StatCard label="Profit margin" value={res.margin === null ? "—" : pct(res.margin)} sub="Profit ÷ revenue" />
            <StatCard
              label="Unsold stock"
              value={`${res.unsoldKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`}
              tone={unsold ? "warning" : undefined}
              sub={unsold && res.unsoldValue > 0 ? `≈ ${fmtRM0(res.unsoldValue)} more at avg price` : "Not yet in revenue"}
            />
          </div>

          <Card title={`Cost breakdown — ${cropName}, ${plotLabel(db, sel.plotId)}, ${fmtDate(sel.from)} to ${fmtDate(sel.to)}`}>
            <Table>
              <thead>
                <tr>
                  <Th>Cost</Th>
                  <Th right>Amount</Th>
                  <Th right>Per kg</Th>
                  <Th right>% of cost</Th>
                  <Th>How it was charged</Th>
                </tr>
              </thead>
              <tbody>
                {COST_GROUPS.map((g) => {
                  const lines = res.lines.filter((l) => l.group === g);
                  const sub = lines.reduce((s, l) => s + l.amount, 0);
                  return (
                    <Fragment key={g}>
                      <tr className="bg-surface-2">
                        <Td className="font-semibold text-ink">{g}</Td>
                        <Td right className="font-semibold">{fmtRM(sub)}</Td>
                        <Td right className="font-semibold">{harvested > 0 ? fmtRM(sub / harvested) : "—"}</Td>
                        <Td right className="font-semibold">{res.totalCost > 0 ? pct(sub / res.totalCost) : "—"}</Td>
                        <Td />
                      </tr>
                      {lines.map((l) => (
                        <tr key={l.label}>
                          <Td className="pl-6">{l.label}</Td>
                          <Td right>{fmtRM(l.amount)}</Td>
                          <Td right>{harvested > 0 ? fmtRM(l.amount / harvested) : "—"}</Td>
                          <Td right>{res.totalCost > 0 ? pct(l.amount / res.totalCost) : "—"}</Td>
                          <Td className="text-xs text-muted">{l.basis}</Td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                <tr>
                  <Td className="font-semibold">Total production cost</Td>
                  <Td right className="font-semibold">{fmtRM(res.totalCost)}</Td>
                  <Td right className="font-semibold">{harvested > 0 ? fmtRM(res.costPerKg) : "—"}</Td>
                  <Td right className="font-semibold">100%</Td>
                  <Td />
                </tr>
                <tr>
                  <Td className="font-semibold">Revenue from sales</Td>
                  <Td right className="font-semibold">{fmtRM(res.revenue)}</Td>
                  <Td right className="font-semibold">{harvested > 0 ? fmtRM(res.revenue / harvested) : "—"}</Td>
                  <Td />
                  <Td className="text-xs text-muted">Farm&apos;s sales of this crop, shared between plots by kg harvested</Td>
                </tr>
                <tr>
                  <Td className="font-semibold">{money ? "Profit" : "Loss"}</Td>
                  <Td right className={`font-semibold ${money ? "text-good" : "text-critical"}`}>{fmtRM(res.profit)}</Td>
                  <Td right className={`font-semibold ${money ? "text-good" : "text-critical"}`}>{harvested > 0 ? fmtRM(res.profitPerKg) : "—"}</Td>
                  <Td />
                  <Td />
                </tr>
              </tbody>
            </Table>
            <p className="mt-3 text-xs text-muted">
              Loan installments and set-up projects are not counted as production cost. Worker advances and deductions are
              already inside base salary and commission, so they are not counted twice. Dates {matching ? "come from the plot's crop cycle." : "were set by you."}
            </p>
          </Card>
        </>
      )}

      <Card title="All seasons by crop">
        {rows.length === 0 ? (
          <EmptyState message="No crop cycles with dates yet. Add cycle dates to a plot under Farms & Plots." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Crop / season</Th>
                <Th>Period</Th>
                <Th right>Harvested</Th>
                <Th right>Total cost</Th>
                <Th right>Cost / kg</Th>
                <Th right>Revenue</Th>
                <Th right>Profit / loss</Th>
              </tr>
            </thead>
            <tbody>
              {cropGroups.map((cid) => {
                const group = rows.filter((x) => x.s.cropId === cid);
                const kg = group.reduce((s, x) => s + x.r.harvestedKg, 0);
                const cost = group.reduce((s, x) => s + x.r.totalCost, 0);
                const rev = group.reduce((s, x) => s + x.r.revenue, 0);
                return (
                  <Fragment key={cid}>
                    <tr className="bg-surface-2">
                      <Td className="font-semibold text-ink">{db.crops.find((c) => c.id === cid)?.name}</Td>
                      <Td className="text-xs text-muted">{group.length} season(s)</Td>
                      <Td right className="font-semibold">{kg.toLocaleString()} kg</Td>
                      <Td right className="font-semibold">{fmtRM0(cost)}</Td>
                      <Td right className="font-semibold">{kg > 0 ? fmtRM(cost / kg) : "—"}</Td>
                      <Td right className="font-semibold">{fmtRM0(rev)}</Td>
                      <Td right className={`font-semibold ${rev - cost >= 0 ? "text-good" : "text-critical"}`}>{fmtRM0(rev - cost)}</Td>
                    </tr>
                    {group.map(({ s, r }) => (
                      <tr
                        key={s.key}
                        onClick={() => setSel({ plotId: s.plotId, cropId: s.cropId, from: s.start, to: s.end })}
                        className="cursor-pointer hover:bg-surface-2"
                      >
                        <Td className="pl-6">
                          {plotLabel(db, s.plotId)}
                          {s.variety ? <span className="text-muted"> · {s.variety}</span> : null}
                          {s.ongoing && (
                            <>
                              {" "}
                              <Badge tone="accent">ongoing</Badge>
                            </>
                          )}
                        </Td>
                        <Td className="text-xs">
                          {fmtDate(s.start)} – {fmtDate(s.end)}
                        </Td>
                        <Td right>{r.harvestedKg.toLocaleString()} kg</Td>
                        <Td right>{fmtRM0(r.totalCost)}</Td>
                        <Td right>{r.harvestedKg > 0 ? fmtRM(r.costPerKg) : "—"}</Td>
                        <Td right>{fmtRM0(r.revenue)}</Td>
                        <Td right className={r.profit >= 0 ? "text-good" : "text-critical"}>{fmtRM0(r.profit)}</Td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        )}
        <p className="mt-3 text-xs text-muted">Click a season to open its full breakdown above.</p>
      </Card>
    </div>
  );
}
