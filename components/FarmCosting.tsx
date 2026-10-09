"use client";

import { Fragment, useState } from "react";
import { useStore } from "@/lib/store";
import { Card, Table, Th, Td, StatCard, Field, TextInput, Select, EmptyState, Button } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, todayLocalISO } from "@/lib/utils";
import { COST_GROUPS, farmCosting } from "@/lib/costing";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const kg0 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return isoOf(d);
}

export default function FarmCosting() {
  const { db } = useStore();
  const today = todayLocalISO();
  const [farmId, setFarmId] = useState(db.farms[0]?.id ?? "");
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);

  const valid = from && to && from <= to;
  const res = farmCosting(db, { farmId, from, to });
  const farm = db.farms.find((f) => f.id === farmId);
  const money = res.profit >= 0;

  // earliest rental start for this farm, for the "since rented" preset
  const rentedSince = db.contracts
    .filter((c) => c.farmId === farmId)
    .map((c) => c.startDate)
    .sort()[0];

  const compare = db.farms.map((f) => ({ f, r: farmCosting(db, { farmId: f.id, from, to }) })).sort((a, b) => b.r.profit - a.r.profit);

  return (
    <div className="space-y-6">
      <Card title="Choose a farm and period">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Farm">
            <Select value={farmId} onChange={(e) => setFarmId(e.target.value)}>
              {db.farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button small variant="ghost" onClick={() => { setFrom(`${today.slice(0, 4)}-01-01`); setTo(today); }}>This year</Button>
          <Button small variant="ghost" onClick={() => { setFrom(monthsAgo(6)); setTo(today); }}>Last 6 months</Button>
          <Button small variant="ghost" onClick={() => { setFrom(monthsAgo(12)); setTo(today); }}>Last 12 months</Button>
          {rentedSince && (
            <Button small variant="ghost" onClick={() => { setFrom(rentedSince); setTo(today); }}>
              Since rented ({fmtDate(rentedSince)})
            </Button>
          )}
        </div>
      </Card>

      {!valid || !farm ? (
        <Card>
          <EmptyState message="Pick a farm and a valid From and To date." />
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
                {farm.name} has no sales between {fmtDate(from)} and {fmtDate(to)}, so profit can&apos;t be worked out yet. Costs over the
                period come to <strong>{fmtRM(res.totalCost)}</strong>.
              </>
            ) : (
              <>
                {farm.name} {money ? "made money" : "lost money"} between {fmtDate(from)} and {fmtDate(to)}:{" "}
                <strong>
                  {money ? "profit" : "loss"} of {fmtRM(Math.abs(res.profit))}
                </strong>{" "}
                ({fmtRM(Math.abs(res.profitPerAcre))} per acre) on {fmtRM(res.revenue)} of sales against {fmtRM(res.totalCost)} of costs.
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total cost" value={fmtRM0(res.totalCost)} sub={`${fmtRM0(res.acres > 0 ? res.totalCost / res.acres : 0)} per acre`} />
            <StatCard label="Revenue (sold)" value={fmtRM0(res.revenue)} sub={`${kg0(res.soldKg)} kg sold`} />
            <StatCard
              label={money ? "Profit" : "Loss"}
              value={res.revenue === 0 ? "—" : fmtRM0(res.profit)}
              tone={res.revenue === 0 ? undefined : money ? "good" : "critical"}
              sub={res.margin === null ? undefined : `${pct(res.margin)} margin`}
            />
            <StatCard
              label="Harvested"
              value={`${kg0(res.harvestedKg)} kg`}
              sub={`${kg0(res.unsoldKg)} in store · ${kg0(res.wastedKg)} written off · cost ${res.harvestedKg > 0 ? fmtRM(res.costPerKg) : "—"}/kg`}
            />
          </div>

          <Card title={`Crops planted on ${farm.name}, ${fmtDate(from)} to ${fmtDate(to)}`}>
            {res.crops.length === 0 ? (
              <EmptyState message="No crop was planted or harvested on this farm in this period." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Crop</Th>
                    <Th>Plots</Th>
                    <Th right>Harvested</Th>
                    <Th right>Sold</Th>
                    <Th right>Revenue</Th>
                    <Th right>Cost</Th>
                    <Th right>Cost / kg</Th>
                    <Th right>Profit / loss</Th>
                  </tr>
                </thead>
                <tbody>
                  {res.crops.map((c) => (
                    <tr key={c.cropId}>
                      <Td className="font-medium text-ink">{db.crops.find((x) => x.id === c.cropId)?.name ?? "—"}</Td>
                      <Td className="text-muted">{c.plots.join(", ") || "—"}</Td>
                      <Td right>{kg0(c.harvestedKg)} kg</Td>
                      <Td right>{kg0(c.soldKg)} kg</Td>
                      <Td right>{fmtRM0(c.revenue)}</Td>
                      <Td right>{fmtRM0(c.cost)}</Td>
                      <Td right>{c.harvestedKg > 0 ? fmtRM(c.costPerKg) : "—"}</Td>
                      <Td right className={c.profit >= 0 ? "text-good" : "text-critical"}>{fmtRM0(c.profit)}</Td>
                    </tr>
                  ))}
                  {Math.abs(res.idleCost) >= 0.5 && (
                    <tr>
                      <Td className="text-muted">Land not under a crop</Td>
                      <Td className="text-muted">Fallow, between crops, undated cycles</Td>
                      <Td right />
                      <Td right />
                      <Td right />
                      <Td right>{fmtRM0(res.idleCost)}</Td>
                      <Td right />
                      <Td right className="text-critical">{fmtRM0(-res.idleCost)}</Td>
                    </tr>
                  )}
                  <tr>
                    <Td className="font-semibold">Farm total</Td>
                    <Td />
                    <Td right className="font-semibold">{kg0(res.harvestedKg)} kg</Td>
                    <Td right className="font-semibold">{kg0(res.soldKg)} kg</Td>
                    <Td right className="font-semibold">{fmtRM0(res.revenue)}</Td>
                    <Td right className="font-semibold">{fmtRM0(res.totalCost)}</Td>
                    <Td right className="font-semibold">{res.harvestedKg > 0 ? fmtRM(res.costPerKg) : "—"}</Td>
                    <Td right className={`font-semibold ${money ? "text-good" : "text-critical"}`}>{fmtRM0(res.profit)}</Td>
                  </tr>
                </tbody>
              </Table>
            )}
            <p className="mt-3 text-xs text-muted">
              Each crop carries the cost of the plot-seasons it ran in. Land rent also covers acreage with nothing planted, which
              is why the farm total can be lower than the crops added up. Click Costing by Crop for one season in detail.
            </p>
          </Card>

          <Card title="Where the money went — cost breakdown">
            <Table>
              <thead>
                <tr>
                  <Th>Cost</Th>
                  <Th right>Amount</Th>
                  <Th right>Per kg</Th>
                  <Th right>Per acre</Th>
                  <Th right>% of cost</Th>
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
                        <Td right className="font-semibold">{res.harvestedKg > 0 ? fmtRM(sub / res.harvestedKg) : "—"}</Td>
                        <Td right className="font-semibold">{res.acres > 0 ? fmtRM(sub / res.acres) : "—"}</Td>
                        <Td right className="font-semibold">{res.totalCost > 0 ? pct(sub / res.totalCost) : "—"}</Td>
                      </tr>
                      {lines.map((l) => (
                        <tr key={l.label}>
                          <Td className="pl-6">{l.label}</Td>
                          <Td right>{fmtRM(l.amount)}</Td>
                          <Td right>{res.harvestedKg > 0 ? fmtRM(l.amount / res.harvestedKg) : "—"}</Td>
                          <Td right>{res.acres > 0 ? fmtRM(l.amount / res.acres) : "—"}</Td>
                          <Td right>{res.totalCost > 0 ? pct(l.amount / res.totalCost) : "—"}</Td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                <tr>
                  <Td className="font-semibold">Total cost</Td>
                  <Td right className="font-semibold">{fmtRM(res.totalCost)}</Td>
                  <Td right className="font-semibold">{res.harvestedKg > 0 ? fmtRM(res.costPerKg) : "—"}</Td>
                  <Td right className="font-semibold">{res.acres > 0 ? fmtRM(res.totalCost / res.acres) : "—"}</Td>
                  <Td right className="font-semibold">100%</Td>
                </tr>
              </tbody>
            </Table>
            <p className="mt-3 text-xs text-muted">
              Loan installments and set-up projects are not counted. Worker advances are already inside salary and commission.
            </p>
          </Card>
        </>
      )}

      <Card title={`All farms compared — ${valid ? `${fmtDate(from)} to ${fmtDate(to)}` : "pick a period"}`}>
        <Table>
          <thead>
            <tr>
              <Th>Farm</Th>
              <Th right>Acres</Th>
              <Th right>Harvested</Th>
              <Th right>Revenue</Th>
              <Th right>Cost</Th>
              <Th right>Profit / loss</Th>
              <Th right>Margin</Th>
              <Th right>Profit / acre</Th>
            </tr>
          </thead>
          <tbody>
            {compare.map(({ f, r }) => (
              <tr key={f.id} onClick={() => setFarmId(f.id)} className={`cursor-pointer hover:bg-surface-2 ${f.id === farmId ? "bg-surface-2" : ""}`}>
                <Td className="font-medium text-ink">{f.name}</Td>
                <Td right>{r.acres}</Td>
                <Td right>{kg0(r.harvestedKg)} kg</Td>
                <Td right>{fmtRM0(r.revenue)}</Td>
                <Td right>{fmtRM0(r.totalCost)}</Td>
                <Td right className={r.profit >= 0 ? "text-good" : "text-critical"}>{fmtRM0(r.profit)}</Td>
                <Td right>{r.margin === null ? "—" : pct(r.margin)}</Td>
                <Td right>{fmtRM0(r.profitPerAcre)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-3 text-xs text-muted">Ranked by profit. Click a farm to see its full breakdown above.</p>
      </Card>
    </div>
  );
}
