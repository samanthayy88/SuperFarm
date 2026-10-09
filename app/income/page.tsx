"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import {
  PageHeader,
  Card,
  Badge,
  Table,
  Th,
  Td,
  Button,
  Modal,
  Field,
  TextInput,
  Select,
  StatCard,
  Tabs,
  EmptyState,
  ConfirmDialog,
} from "@/components/ui";
import {
  fmtRM,
  fmtRM0,
  fmtDate,
  commissionRateFor,
  commissionSourceFor,
  currentMonthKey,
  monthLabel,
  lastNMonthKeys,
  saleTotal,
  saleKg,
  saleDueDate,
  saleOverdueDays,
  pendingStockKg,
  totalHarvestedKg,
  totalSoldKg,
  totalWastedKg,
  stockLedger,
  todayLocalISO,
  TODAY,
} from "@/lib/utils";
import { HarvestRecord, SaleRecord, SaleGradeLine, WasteRecord, WasteReason } from "@/lib/types";
import VarietySelect from "@/components/VarietySelect";

export default function IncomePage() {
  const { db, update } = useStore();
  const [tab, setTab] = useState("Harvest Records");

  // ---- Harvest Records ----
  const months = lastNMonthKeys(6).reverse();
  const [month, setMonth] = useState(
    () => months.find((m) => db.harvests.some((h) => h.date.startsWith(m))) ?? currentMonthKey()
  );
  const [harvestForm, setHarvestForm] = useState<{ mode: "add" } | { mode: "edit"; harvest: HarvestRecord } | null>(null);
  const [deleteHarvest, setDeleteHarvest] = useState<HarvestRecord | null>(null);

  const rows = db.harvests.filter((h) => h.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const totalKg = rows.reduce((s, h) => s + h.quantityKg, 0);
  const totalCommission = rows.reduce((s, h) => s + h.quantityKg * h.commissionRate, 0);

  const doDeleteHarvest = (h: HarvestRecord) => {
    update("harvests", (list) => list.filter((x) => x.id !== h.id));
    setDeleteHarvest(null);
  };

  // ---- Sales ----
  const [saleForm, setSaleForm] = useState<{ cropId?: string; farmId?: string } | null>(null);
  const year = String(TODAY.getFullYear());
  const pending = db.sales.filter((s) => s.paymentStatus === "Pending");
  const receivables = pending.reduce((s, x) => s + saleTotal(x), 0);
  const yearSales = db.sales.filter((s) => s.date.startsWith(year));
  const yearRevenue = yearSales.reduce((s, x) => s + saleTotal(x), 0);
  const yearKg = yearSales.reduce((s, x) => s + saleKg(x), 0);
  const overdue = pending.filter((s) => {
    const col = db.collectors.find((c) => c.id === s.collectorId);
    return col ? saleOverdueDays(s, col.paymentTermDays) > 0 : false;
  });

  const markReceived = (id: string) => {
    update("sales", (list) =>
      list.map((s) =>
        s.id === id
          ? s.paymentStatus === "Received"
            ? { ...s, paymentStatus: "Pending" as const, paymentReceivedDate: undefined }
            : { ...s, paymentStatus: "Received" as const, paymentReceivedDate: TODAY.toISOString().slice(0, 10) }
          : s
      )
    );
  };

  // ---- Wastage ----
  const [wasteForm, setWasteForm] = useState<
    { mode: "add"; cropId?: string; quantityKg?: number } | { mode: "edit"; waste: WasteRecord } | null
  >(null);
  const [deleteWaste, setDeleteWaste] = useState<WasteRecord | null>(null);

  // ---- Volume overview: every crop ever harvested, all time ----
  const volumeRows = db.crops
    .map((c) => {
      const harvested = totalHarvestedKg(db, c.id);
      const sold = totalSoldKg(db, c.id);
      const wasted = totalWastedKg(db, c.id);
      return { crop: c, harvested, sold, wasted, inStock: harvested - sold - wasted };
    })
    .filter((r) => r.harvested > 0 || r.sold > 0 || r.wasted > 0);
  const vol = volumeRows.reduce(
    (t, r) => ({
      harvested: t.harvested + r.harvested,
      sold: t.sold + r.sold,
      wasted: t.wasted + r.wasted,
      inStock: t.inStock + r.inStock,
    }),
    { harvested: 0, sold: 0, wasted: 0, inStock: 0 }
  );
  const unsold = vol.harvested - vol.sold; // everything not sold: still in store + written off
  const pctOf = (n: number) => (vol.harvested > 0 ? `${((n / vol.harvested) * 100).toFixed(1)}% of harvest` : "—");

  // ---- Daily stock: movement and running balance, straight from the records ----
  const today = todayLocalISO();
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [stockCrop, setStockCrop] = useState("");
  const [stockFrom, setStockFrom] = useState(() => daysAgo(30));
  const [stockTo, setStockTo] = useState(today);
  const ledger = stockLedger(db, stockFrom, stockTo, stockCrop || undefined);
  const todayMoves = stockLedger(db, today, today, stockCrop || undefined).rows;
  const todayHarvested = todayMoves.reduce((s, r) => s + r.harvestedKg, 0);
  const todaySold = todayMoves.reduce((s, r) => s + r.soldKg, 0);
  const balanceNow = db.crops
    .filter((c) => !stockCrop || c.id === stockCrop)
    .reduce((s, c) => s + pendingStockKg(db, c.id), 0);
  const allToday = stockLedger(db, today, today).rows;

  const doDeleteWaste = (w: WasteRecord) => {
    update("wastage", (list) => list.filter((x) => x.id !== w.id));
    setDeleteWaste(null);
  };
  const wasteRows = [...(db.wastage ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader
        title="Harvest & Sales"
        subtitle="Record what's picked, then sell it to a collector — kg harvested and kg sold stay linked so nothing is entered twice"
        actions={
          tab === "Harvest Records" ? (
            <>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
              <Button onClick={() => setHarvestForm({ mode: "add" })}>+ Record Harvest</Button>
            </>
          ) : tab === "Sales" ? (
            <Button onClick={() => setSaleForm({})}>+ Record Sale</Button>
          ) : tab === "Wastage" ? (
            <Button onClick={() => setWasteForm({ mode: "add" })}>+ Record Wastage</Button>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total harvested" value={`${vol.harvested.toLocaleString()} kg`} sub="All time, all crops" />
        <StatCard label="Total sold" value={`${vol.sold.toLocaleString()} kg`} sub={pctOf(vol.sold)} tone="good" />
        <StatCard
          label="Total unsold"
          value={`${unsold.toLocaleString()} kg`}
          sub={`${vol.inStock.toLocaleString()} kg in store · ${vol.wasted.toLocaleString()} kg written off`}
          tone={unsold > 0 ? "warning" : undefined}
        />
        <StatCard label="Written off (rotten / lost)" value={`${vol.wasted.toLocaleString()} kg`} sub={`${pctOf(vol.wasted)} — cost absorbed by the farm`} tone={vol.wasted > 0 ? "critical" : undefined} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Harvested — ${monthLabel(month)}`} value={`${totalKg.toLocaleString()} kg`} sub={`${fmtRM(totalCommission)} commission`} />
        <StatCard label={`Revenue ${year}`} value={fmtRM0(yearRevenue)} sub={`${yearKg.toLocaleString()} kg sold`} />
        <StatCard label="Outstanding receivables" value={fmtRM0(receivables)} sub={`${pending.length} sale(s) unpaid`} tone={receivables > 0 ? "warning" : "good"} />
        <StatCard label="Overdue payments" value={String(overdue.length)} tone={overdue.length > 0 ? "critical" : "good"} sub="Past collector payment term" />
      </div>

      <Card title="Volume overview by crop — all time" className="mb-6">
        {volumeRows.length === 0 ? (
          <EmptyState message="No harvests recorded yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Crop</Th>
                <Th right>Harvested</Th>
                <Th right>Sold</Th>
                <Th right>Unsold</Th>
                <Th right>In store</Th>
                <Th right>Written off</Th>
                <Th right>% sold</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {volumeRows.map((r) => (
                <tr key={r.crop.id}>
                  <Td className="font-medium text-ink">{r.crop.name}</Td>
                  <Td right>{r.harvested.toLocaleString()} kg</Td>
                  <Td right>{r.sold.toLocaleString()} kg</Td>
                  <Td right>{(r.harvested - r.sold).toLocaleString()} kg</Td>
                  <Td right>
                    {r.inStock < 0 ? (
                      <Badge tone="critical">{r.inStock.toLocaleString()} kg oversold</Badge>
                    ) : (
                      <span className={r.inStock > 0 ? "text-warning" : ""}>{r.inStock.toLocaleString()} kg</span>
                    )}
                  </Td>
                  <Td right>{r.wasted > 0 ? <span className="text-critical">{r.wasted.toLocaleString()} kg</span> : "—"}</Td>
                  <Td right>{r.harvested > 0 ? `${((r.sold / r.harvested) * 100).toFixed(0)}%` : "—"}</Td>
                  <Td>
                    {r.inStock > 0 && (
                      <button
                        onClick={() => {
                          setWasteForm({ mode: "add", cropId: r.crop.id, quantityKg: r.inStock });
                          setTab("Wastage");
                        }}
                        className="rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        Write off
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="font-semibold">Total</Td>
                <Td right className="font-semibold">{vol.harvested.toLocaleString()} kg</Td>
                <Td right className="font-semibold">{vol.sold.toLocaleString()} kg</Td>
                <Td right className="font-semibold">{unsold.toLocaleString()} kg</Td>
                <Td right className="font-semibold">{vol.inStock.toLocaleString()} kg</Td>
                <Td right className="font-semibold">{vol.wasted.toLocaleString()} kg</Td>
                <Td right className="font-semibold">{vol.harvested > 0 ? `${((vol.sold / vol.harvested) * 100).toFixed(0)}%` : "—"}</Td>
                <Td />
              </tr>
            </tbody>
          </Table>
        )}
        <p className="mt-3 text-sm text-ink-2">
          <span className="font-medium text-ink">Today ({fmtDate(today)}):</span>{" "}
          {allToday.reduce((s, r) => s + r.harvestedKg, 0).toLocaleString()} kg harvested ·{" "}
          {allToday.reduce((s, r) => s + r.soldKg, 0).toLocaleString()} kg sold · {vol.inStock.toLocaleString()} kg balance in store
          <button onClick={() => setTab("Daily Stock")} className="ml-2 text-accent hover:underline">
            See daily stock
          </button>
        </p>
        <p className="mt-2 text-xs text-muted">
          Unsold = harvested − sold. It is either still in the store or written off (rotten, damaged, given away). Written-off
          produce earns no income but its growing cost stays in the farm&apos;s books — see Data &amp; Analysis › Costing by Crop.
        </p>
      </Card>

      <Tabs tabs={["Harvest Records", "Sales", "Daily Stock", "Wastage", "Average Price by Crop", "Collector Payments"]} active={tab} onChange={setTab} />

      {tab === "Harvest Records" && (
        <Card title={`Harvest records — ${monthLabel(month)}`}>
          {rows.length === 0 ? (
            <EmptyState message="No harvest recorded for this month." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Worker</Th>
                  <Th>Farm / Plot</Th>
                  <Th>Crop</Th>
                  <Th>Variety</Th>
                  <Th right>Quantity</Th>
                  <Th right>Rate/kg</Th>
                  <Th right>Commission</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => {
                  const worker = db.workers.find((w) => w.id === h.workerId)?.name ?? "—";
                  const plot = db.plots.find((p) => p.id === h.plotId);
                  const farm = db.farms.find((f) => f.id === plot?.farmId);
                  const crop = db.crops.find((c) => c.id === h.cropId);
                  const rate = h.commissionRate;
                  return (
                    <tr key={h.id}>
                      <Td>{fmtDate(h.date)}</Td>
                      <Td>{worker}</Td>
                      <Td>{farm?.name ?? "—"} · {plot?.name ?? "—"}</Td>
                      <Td>{crop?.name ?? "—"}</Td>
                      <Td>{h.variety || <span className="text-muted">—</span>}</Td>
                      <Td right>{h.quantityKg.toLocaleString()} kg</Td>
                      <Td right>RM {rate.toFixed(2)}</Td>
                      <Td right>{fmtRM(h.quantityKg * rate)}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setSaleForm({ cropId: h.cropId, farmId: farm?.id });
                              setTab("Sales");
                            }}
                            className="rounded-md border border-hairline px-2 py-1 text-xs text-accent transition-colors hover:bg-surface-2"
                          >
                            Sell
                          </button>
                          <button
                            onClick={() => setHarvestForm({ mode: "edit", harvest: h })}
                            className="rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteHarvest(h)}
                            className="rounded-md px-2 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
                          >
                            Delete
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "Daily Stock" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label={`Harvested today — ${fmtDate(today)}`} value={`${todayHarvested.toLocaleString()} kg`} />
            <StatCard label="Sold today" value={`${todaySold.toLocaleString()} kg`} tone={todaySold > 0 ? "good" : undefined} />
            <StatCard
              label="Balance in store now"
              value={`${balanceNow.toLocaleString()} kg`}
              tone={balanceNow < 0 ? "critical" : balanceNow > 0 ? "warning" : "good"}
              sub="Harvested − sold − written off"
            />
          </div>
          <Card title="Daily harvested, sold and balance">
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Field label="Crop">
                <Select value={stockCrop} onChange={(e) => setStockCrop(e.target.value)}>
                  <option value="">All crops</option>
                  {db.crops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="From">
                <TextInput type="date" value={stockFrom} onChange={(e) => setStockFrom(e.target.value)} />
              </Field>
              <Field label="To">
                <TextInput type="date" value={stockTo} onChange={(e) => setStockTo(e.target.value)} />
              </Field>
              <div className="flex items-end gap-2">
                <Button small variant="ghost" onClick={() => { setStockFrom(daysAgo(7)); setStockTo(today); }}>7 days</Button>
                <Button small variant="ghost" onClick={() => { setStockFrom(daysAgo(30)); setStockTo(today); }}>30 days</Button>
                <Button small variant="ghost" onClick={() => { setStockFrom(daysAgo(90)); setStockTo(today); }}>90 days</Button>
              </div>
            </div>
            {ledger.rows.length === 0 ? (
              <EmptyState message="No harvests, sales or write-offs in this period." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Crop</Th>
                    <Th right>Harvested</Th>
                    <Th right>Sold</Th>
                    <Th right>Written off</Th>
                    <Th right>Balance in store</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map((r) => (
                    <tr key={`${r.date}-${r.cropId}`}>
                      <Td>{fmtDate(r.date)}{r.date === today && <span className="ml-2 text-xs text-accent">today</span>}</Td>
                      <Td>{db.crops.find((c) => c.id === r.cropId)?.name ?? "—"}</Td>
                      <Td right>{r.harvestedKg ? `${r.harvestedKg.toLocaleString()} kg` : "—"}</Td>
                      <Td right>{r.soldKg ? `${r.soldKg.toLocaleString()} kg` : "—"}</Td>
                      <Td right>{r.wastedKg ? <span className="text-critical">{r.wastedKg.toLocaleString()} kg</span> : "—"}</Td>
                      <Td right className={`font-medium ${r.balanceKg < 0 ? "text-critical" : ""}`}>{r.balanceKg.toLocaleString()} kg</Td>
                    </tr>
                  ))}
                  <tr>
                    <Td className="font-semibold">Period total</Td>
                    <Td />
                    <Td right className="font-semibold">{ledger.rows.reduce((s, r) => s + r.harvestedKg, 0).toLocaleString()} kg</Td>
                    <Td right className="font-semibold">{ledger.rows.reduce((s, r) => s + r.soldKg, 0).toLocaleString()} kg</Td>
                    <Td right className="font-semibold">{ledger.rows.reduce((s, r) => s + r.wastedKg, 0).toLocaleString()} kg</Td>
                    <Td />
                  </tr>
                </tbody>
              </Table>
            )}
            <p className="mt-3 text-xs text-muted">
              Only days with a harvest, sale or write-off are listed. The balance is per crop and carries over from earlier
              days (stock before {fmtDate(stockFrom)}: {ledger.opening.toLocaleString()} kg). It updates the moment you save a
              record.
            </p>
          </Card>
        </div>
      )}

      {tab === "Wastage" && (
        <Card title="Wastage — harvested produce that was not sold">
          {wasteRows.length === 0 ? (
            <EmptyState message="Nothing written off. Use “+ Record Wastage” when produce rots, is rejected or is left over for good." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Farm / Plot</Th>
                  <Th>Crop</Th>
                  <Th right>Quantity</Th>
                  <Th>Reason</Th>
                  <Th>Notes</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {wasteRows.map((w) => {
                  const plot = db.plots.find((p) => p.id === w.plotId);
                  const farm = db.farms.find((f) => f.id === plot?.farmId);
                  return (
                    <tr key={w.id}>
                      <Td>{fmtDate(w.date)}</Td>
                      <Td>{farm?.name ?? "—"} · {plot?.name ?? "—"}</Td>
                      <Td>{db.crops.find((c) => c.id === w.cropId)?.name ?? "—"}</Td>
                      <Td right>{w.quantityKg.toLocaleString()} kg</Td>
                      <Td><Badge tone="critical">{w.reason}</Badge></Td>
                      <Td className="text-muted">{w.notes || "—"}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setWasteForm({ mode: "edit", waste: w })}
                            className="rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteWaste(w)}
                            className="rounded-md px-2 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
                          >
                            Delete
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "Sales" && (
        <Card title="All sales">
          <Table>
            <thead>
              <tr>
                <Th>Sale date</Th>
                <Th>Collector</Th>
                <Th>Crop / Farm</Th>
                <Th right>Total kg</Th>
                <Th right>Amount</Th>
                <Th>Payment due</Th>
                <Th>Status</Th>
                <Th>Grading & price</Th>
              </tr>
            </thead>
            <tbody>
              {[...db.sales].sort((a, b) => b.date.localeCompare(a.date)).map((s) => {
                const col = db.collectors.find((c) => c.id === s.collectorId);
                const crop = db.crops.find((c) => c.id === s.cropId)?.name ?? "—";
                const farm = db.farms.find((f) => f.id === s.farmId)?.name ?? "—";
                const od = col ? saleOverdueDays(s, col.paymentTermDays) : 0;
                return (
                  <tr key={s.id}>
                    <Td>{fmtDate(s.date)}</Td>
                    <Td>
                      {col?.name ?? "—"}
                      <p className="text-xs text-muted">{col?.paymentTermDays}-day term</p>
                    </Td>
                    <Td>
                      {crop}
                      <p className="text-xs text-muted">{farm}</p>
                    </Td>
                    <Td right>{saleKg(s).toLocaleString()}</Td>
                    <Td right className="font-medium">{fmtRM(saleTotal(s))}</Td>
                    <Td>
                      {s.paymentStatus === "Received" ? (
                        <span className="text-xs text-muted">received {s.paymentReceivedDate ? fmtDate(s.paymentReceivedDate) : ""}</span>
                      ) : (
                        <span className={`text-xs ${od > 0 ? "text-critical" : "text-ink-2"}`}>
                          {col ? fmtDate(saleDueDate(s, col.paymentTermDays).toISOString().slice(0, 10)) : "—"}
                          {od > 0 && ` (${od}d late)`}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <button onClick={() => markReceived(s.id)} title="Click to toggle">
                        <Badge tone={s.paymentStatus === "Received" ? "good" : od > 0 ? "critical" : "warning"}>
                          {s.paymentStatus === "Received" ? "Paid ✓" : od > 0 ? "Overdue" : "Pending"}
                        </Badge>
                      </button>
                    </Td>
                    <Td>
                      {s.grades.map((g) => (
                        <p key={g.grade} className="text-xs text-ink-2">
                          Grade {g.grade}: {g.quantityKg.toLocaleString()} kg × RM {g.pricePerKg.toFixed(2)} = {fmtRM(g.quantityKg * g.pricePerKg)}
                        </p>
                      ))}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "Average Price by Crop" && (
        <div className="space-y-4">
          {db.crops.map((crop) => {
            const cropSales = db.sales.filter((s) => s.cropId === crop.id && s.date.startsWith(year));
            if (cropSales.length === 0) return null;
            const totalKgC = cropSales.reduce((s, x) => s + saleKg(x), 0);
            const totalRevC = cropSales.reduce((s, x) => s + saleTotal(x), 0);
            const gradeMap = new Map<string, { kg: number; rev: number }>();
            for (const s of cropSales)
              for (const g of s.grades) {
                const cur = gradeMap.get(g.grade) ?? { kg: 0, rev: 0 };
                gradeMap.set(g.grade, { kg: cur.kg + g.quantityKg, rev: cur.rev + g.quantityKg * g.pricePerKg });
              }
            const colMap = new Map<string, { kg: number; rev: number }>();
            for (const s of cropSales) {
              const cur = colMap.get(s.collectorId) ?? { kg: 0, rev: 0 };
              colMap.set(s.collectorId, { kg: cur.kg + saleKg(s), rev: cur.rev + saleTotal(s) });
            }
            return (
              <Card key={crop.id} title={`${crop.name} — ${year} average selling price: RM ${(totalRevC / totalKgC).toFixed(2)}/kg`}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">By grade</p>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Grade</Th>
                          <Th right>Total kg</Th>
                          <Th right>Revenue</Th>
                          <Th right>Avg price/kg</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...gradeMap.entries()].sort().map(([g, v]) => (
                          <tr key={g}>
                            <Td>Grade {g}</Td>
                            <Td right>{v.kg.toLocaleString()}</Td>
                            <Td right>{fmtRM(v.rev)}</Td>
                            <Td right className="font-medium">RM {(v.rev / v.kg).toFixed(2)}</Td>
                          </tr>
                        ))}
                        <tr>
                          <Td className="font-semibold">All grades</Td>
                          <Td right className="font-semibold">{totalKgC.toLocaleString()}</Td>
                          <Td right className="font-semibold">{fmtRM(totalRevC)}</Td>
                          <Td right className="font-semibold">RM {(totalRevC / totalKgC).toFixed(2)}</Td>
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">By collector</p>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Collector</Th>
                          <Th right>Total kg</Th>
                          <Th right>Revenue</Th>
                          <Th right>Avg price/kg</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...colMap.entries()].map(([cid, v]) => (
                          <tr key={cid}>
                            <Td>{db.collectors.find((c) => c.id === cid)?.name ?? "—"}</Td>
                            <Td right>{v.kg.toLocaleString()}</Td>
                            <Td right>{fmtRM(v.rev)}</Td>
                            <Td right className="font-medium">RM {(v.rev / v.kg).toFixed(2)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "Collector Payments" && (
        <Card title="Collectors">
          <Table>
            <thead>
              <tr>
                <Th>Collector</Th>
                <Th>Phone</Th>
                <Th right>Payment term</Th>
                <Th right>Sales {year}</Th>
                <Th right>Total bought</Th>
                <Th right>Still owing</Th>
                <Th>Payment record</Th>
              </tr>
            </thead>
            <tbody>
              {db.collectors.map((c) => {
                const theirSales = db.sales.filter((s) => s.collectorId === c.id);
                const yearTheirs = theirSales.filter((s) => s.date.startsWith(year));
                const owing = theirSales.filter((s) => s.paymentStatus === "Pending").reduce((s, x) => s + saleTotal(x), 0);
                const paidSales = theirSales.filter((s) => s.paymentStatus === "Received" && s.paymentReceivedDate);
                const avgDays =
                  paidSales.length > 0
                    ? paidSales.reduce(
                        (s, x) => s + Math.round((new Date(x.paymentReceivedDate!).getTime() - new Date(x.date).getTime()) / 86400000),
                        0
                      ) / paidSales.length
                    : null;
                return (
                  <tr key={c.id}>
                    <Td className="font-medium">{c.name}</Td>
                    <Td>{c.phone}</Td>
                    <Td right>{c.paymentTermDays} days</Td>
                    <Td right>{yearTheirs.length}</Td>
                    <Td right>{fmtRM0(yearTheirs.reduce((s, x) => s + saleTotal(x), 0))}</Td>
                    <Td right className={owing > 0 ? "text-warning" : ""}>{owing > 0 ? fmtRM(owing) : "—"}</Td>
                    <Td>
                      {avgDays === null ? (
                        <span className="text-muted">No completed payments</span>
                      ) : (
                        <Badge tone={avgDays <= c.paymentTermDays ? "good" : "serious"}>
                          Pays in {avgDays.toFixed(1)} days avg
                        </Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {harvestForm && (
        <HarvestForm harvest={harvestForm.mode === "edit" ? harvestForm.harvest : undefined} onClose={() => setHarvestForm(null)} />
      )}
      {deleteHarvest && (
        <ConfirmDialog
          title="Delete this harvest record?"
          message={`This ${deleteHarvest.quantityKg.toLocaleString()} kg record from ${fmtDate(deleteHarvest.date)} will be permanently removed, along with the commission it accrued.`}
          confirmLabel="Delete record"
          onConfirm={() => doDeleteHarvest(deleteHarvest)}
          onClose={() => setDeleteHarvest(null)}
        />
      )}
      {saleForm && <SaleForm initial={saleForm} onClose={() => setSaleForm(null)} />}
      {wasteForm && <WasteForm initial={wasteForm} onClose={() => setWasteForm(null)} />}
      {deleteWaste && (
        <ConfirmDialog
          title="Delete this wastage record?"
          message={`${deleteWaste.quantityKg.toLocaleString()} kg will go back into stock.`}
          confirmLabel="Delete wastage"
          onConfirm={() => doDeleteWaste(deleteWaste)}
          onClose={() => setDeleteWaste(null)}
        />
      )}
    </div>
  );
}

function HarvestForm({ harvest, onClose }: { harvest?: HarvestRecord; onClose: () => void }) {
  const { db, update } = useStore();
  const editing = Boolean(harvest);
  const firstPlot = db.plots.find((p) => p.id === harvest?.plotId) ?? db.plots[0];
  const [form, setForm] = useState({
    date: harvest?.date ?? new Date().toISOString().slice(0, 10),
    plotId: firstPlot?.id ?? "",
    workerId: harvest?.workerId ?? firstPlot?.workerIds[0] ?? "",
    variety: harvest?.variety ?? firstPlot?.variety ?? "",
    quantityKg: harvest ? String(harvest.quantityKg) : "",
    commissionRate:
      harvest !== undefined
        ? String(harvest.commissionRate)
        : firstPlot
          ? String(commissionRateFor(db, firstPlot.workerIds[0] ?? "", firstPlot.cropId, firstPlot.variety))
          : "",
  });

  const plot = db.plots.find((p) => p.id === form.plotId);
  const crop = db.crops.find((c) => c.id === plot?.cropId);
  const worker = db.workers.find((w) => w.id === form.workerId);
  // the plot's workers; an existing harvest keeps its worker even if they've since left the plot
  const plotWorkers = db.workers.filter((w) => plot?.workerIds.includes(w.id) || w.id === harvest?.workerId);
  const qty = Number(form.quantityKg) || 0;
  const rate = Number(form.commissionRate) || 0;
  const commission = qty * rate;
  const source = worker && crop ? commissionSourceFor(db, worker.id, crop.id, form.variety || undefined) : null;
  const currentSettingRate = source?.rate ?? 0;

  // plot/variety changing means the worker and/or crop may have changed too, so refresh the suggested
  // rate to match — but this never touches an existing harvest's rate unless the user then saves
  const setPlot = (plotId: string) => {
    const p = db.plots.find((x) => x.id === plotId);
    const workerId = p?.workerIds[0] ?? "";
    const suggested = p ? commissionRateFor(db, workerId, p.cropId, p.variety) : 0;
    setForm({ ...form, plotId, workerId, variety: p?.variety ?? "", commissionRate: String(suggested) });
  };

  // a different worker may have a different rate for the same crop
  const setWorker = (workerId: string) => {
    const suggested = plot ? commissionRateFor(db, workerId, plot.cropId, form.variety || undefined) : 0;
    setForm({ ...form, workerId, commissionRate: String(suggested) });
  };

  const setVariety = (variety: string) => {
    const suggested = worker && crop ? commissionRateFor(db, worker.id, crop.id, variety || undefined) : 0;
    setForm({ ...form, variety, commissionRate: String(suggested) });
  };

  const submit = () => {
    if (!plot || !qty) return;
    const payload = {
      date: form.date,
      plotId: plot.id,
      workerId: form.workerId,
      cropId: plot.cropId,
      variety: form.variety.trim() || undefined,
      quantityKg: qty,
      commissionRate: rate,
    };
    if (harvest) {
      update("harvests", (list) => list.map((h) => (h.id === harvest.id ? { ...h, ...payload } : h)));
    } else {
      const h: HarvestRecord = { id: newId("h"), ...payload };
      update("harvests", (list) => [...list, h]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? "Edit Harvest Record" : "Record Harvest"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Quantity harvested (kg)">
            <TextInput type="number" value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} />
          </Field>
        </div>
        <Field label="Plot">
          <Select value={form.plotId} onChange={(e) => setPlot(e.target.value)}>
            {db.plots.map((p) => {
              const f = db.farms.find((x) => x.id === p.farmId)?.name;
              const c = db.crops.find((x) => x.id === p.cropId)?.name;
              return (
                <option key={p.id} value={p.id}>
                  {f} — {p.name} ({c})
                </option>
              );
            })}
          </Select>
        </Field>
        <Field label="Variety">
          <VarietySelect
            cropId={plot?.cropId ?? ""}
            varieties={db.varieties}
            value={form.variety}
            onChange={setVariety}
            anyLabel="No variety"
          />
        </Field>
        <Field label="Worker who harvested">
          <Select value={form.workerId} onChange={(e) => setWorker(e.target.value)}>
            {plotWorkers.length === 0 && <option value="">No worker assigned to this plot</option>}
            {plotWorkers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="rounded border border-hairline bg-surface-2 p-3 text-sm">
          <p className="text-ink-2">Crop: <span className="font-medium">{crop?.name ?? "—"}</span></p>
        </div>
        <Field label="Commission rate (RM/kg) — locked in for this harvest">
          <TextInput
            type="number"
            step="0.01"
            value={form.commissionRate}
            onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
          />
        </Field>
        {source && (
          <p className={`text-xs ${source.setting ? "text-good" : "text-warning"}`}>
            {source.setting ? (
              <>
                ✓ Linked to Commission Settings — {worker?.name} · {crop?.name} · {source.setting.variety || "any variety"}: RM{" "}
                {source.rate.toFixed(2)}/kg
              </>
            ) : (
              <>
                No Commission Setting for {worker?.name} on {crop?.name}
                {form.variety ? ` (${form.variety})` : ""} — using the crop&apos;s default RM {source.rate.toFixed(2)}/kg. Add one
                under My Workers › Commission Settings.
              </>
            )}
          </p>
        )}
        {Math.abs(rate - currentSettingRate) > 0.001 && (
          <p className="text-xs text-muted">
            This differs from the {source?.setting ? "Commission Setting" : "default"} rate of RM {currentSettingRate.toFixed(2)}/kg.{" "}
            <button
              type="button"
              onClick={() => setForm({ ...form, commissionRate: String(currentSettingRate) })}
              className="text-accent hover:underline"
            >
              Use current rate
            </button>
          </p>
        )}
        <div className="rounded border border-hairline bg-surface-2 p-3 text-sm">
          <p className="text-ink">Commission for this harvest: <span className="font-semibold">{fmtRM(commission)}</span></p>
        </div>
        <p className="text-xs text-muted">
          This rate is saved with the harvest — later changes to Commission Settings won&apos;t change it, or any commission,
          payroll or payslip figures already calculated from it.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Save Harvest"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function SaleForm({ initial, onClose }: { initial: { cropId?: string; farmId?: string }; onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    date: TODAY.toISOString().slice(0, 10),
    collectorId: db.collectors[0]?.id ?? "",
    cropId: initial.cropId ?? db.crops[0]?.id ?? "",
    farmId: initial.farmId ?? db.farms[0]?.id ?? "",
  });
  const [grades, setGrades] = useState<SaleGradeLine[]>([
    { grade: "A", quantityKg: 0, pricePerKg: 0 },
    { grade: "B", quantityKg: 0, pricePerKg: 0 },
  ]);

  const available = pendingStockKg(db, form.cropId);

  const setGrade = (i: number, patch: Partial<SaleGradeLine>) =>
    setGrades((g) => g.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const total = grades.reduce((s, g) => s + g.quantityKg * g.pricePerKg, 0);
  const totalKg = grades.reduce((s, g) => s + g.quantityKg, 0);

  const submit = () => {
    const valid = grades.filter((g) => g.quantityKg > 0);
    if (valid.length === 0) return;
    const s: SaleRecord = {
      id: newId("s"),
      date: form.date,
      collectorId: form.collectorId,
      cropId: form.cropId,
      farmId: form.farmId,
      grades: valid,
      paymentStatus: "Pending",
    };
    update("sales", (list) => [...list, s]);
    onClose();
  };

  return (
    <Modal title="Record Sale" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sale date">
            <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Collector">
            <Select value={form.collectorId} onChange={(e) => setForm({ ...form, collectorId: e.target.value })}>
              {db.collectors.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.paymentTermDays}-day term)</option>
              ))}
            </Select>
          </Field>
          <Field label="Crop">
            <Select value={form.cropId} onChange={(e) => setForm({ ...form, cropId: e.target.value })}>
              {db.crops.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {pendingStockKg(db, c.id).toLocaleString()}kg available</option>
              ))}
            </Select>
          </Field>
          <Field label="From farm">
            <Select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })}>
              {db.farms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">Grading — quantity and price per grade</p>
          <div className="space-y-2">
            {grades.map((g, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_1fr_100px] items-center gap-2">
                <input
                  value={g.grade}
                  onChange={(e) => setGrade(i, { grade: e.target.value })}
                  placeholder="Grade"
                  className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  value={g.quantityKg || ""}
                  onChange={(e) => setGrade(i, { quantityKg: Number(e.target.value) || 0 })}
                  placeholder="Quantity (kg)"
                  className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm tnum"
                />
                <input
                  type="number"
                  step="0.01"
                  value={g.pricePerKg || ""}
                  onChange={(e) => setGrade(i, { pricePerKg: Number(e.target.value) || 0 })}
                  placeholder="Price per kg"
                  className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm tnum"
                />
                <span className="text-right text-sm tnum text-ink-2">{fmtRM(g.quantityKg * g.pricePerKg)}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setGrades([...grades, { grade: "", quantityKg: 0, pricePerKg: 0 }])}
            className="mt-2 text-xs text-accent hover:underline"
          >
            + Add grade line
          </button>
        </div>

        <div className="flex items-center justify-between rounded border border-hairline bg-surface-2 px-3 py-2.5">
          <span className="text-sm text-muted">{totalKg.toLocaleString()} kg total</span>
          <span className="text-sm font-semibold tnum">{fmtRM(total)}</span>
        </div>
        {totalKg > available && (
          <p className="text-xs text-warning">
            Only {available.toLocaleString()} kg of {db.crops.find((c) => c.id === form.cropId)?.name} is on hand from harvest records — this sale goes past that.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Sale</Button>
        </div>
      </div>
    </Modal>
  );
}

const WASTE_REASONS: WasteReason[] = ["Rotten / spoiled", "Damaged", "Rejected by collector", "Own use / given away", "Other"];

function WasteForm({
  initial,
  onClose,
}: {
  initial: { mode: "add"; cropId?: string; quantityKg?: number } | { mode: "edit"; waste: WasteRecord };
  onClose: () => void;
}) {
  const { db, update } = useStore();
  const waste = initial.mode === "edit" ? initial.waste : undefined;

  // for a write-off started from a crop, suggest the plot that harvested the most of it
  const defaultPlot = () => {
    if (waste) return waste.plotId;
    const cropId = initial.mode === "add" ? initial.cropId : undefined;
    if (!cropId) return db.plots[0]?.id ?? "";
    const kg = new Map<string, number>();
    for (const h of db.harvests) if (h.cropId === cropId) kg.set(h.plotId, (kg.get(h.plotId) ?? 0) + h.quantityKg);
    return [...kg.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? db.plots.find((p) => p.cropId === cropId)?.id ?? db.plots[0]?.id ?? "";
  };
  const firstPlot = defaultPlot();
  const [form, setForm] = useState({
    date: waste?.date ?? TODAY.toISOString().slice(0, 10),
    plotId: firstPlot,
    cropId: waste?.cropId ?? (initial.mode === "add" ? initial.cropId : undefined) ?? db.plots.find((p) => p.id === firstPlot)?.cropId ?? db.crops[0]?.id ?? "",
    quantityKg: waste ? String(waste.quantityKg) : initial.mode === "add" && initial.quantityKg ? String(initial.quantityKg) : "",
    reason: waste?.reason ?? ("Rotten / spoiled" as WasteReason),
    notes: waste?.notes ?? "",
  });

  const qty = Number(form.quantityKg) || 0;
  // an edited record's own kg are already out of stock, so give them back before comparing
  const inStock = pendingStockKg(db, form.cropId) + (waste && waste.cropId === form.cropId ? waste.quantityKg : 0);

  const submit = () => {
    if (!qty || !form.plotId) return;
    const payload = {
      date: form.date,
      plotId: form.plotId,
      cropId: form.cropId,
      quantityKg: qty,
      reason: form.reason,
      notes: form.notes.trim() || undefined,
    };
    if (waste) update("wastage", (list) => list.map((w) => (w.id === waste.id ? { ...w, ...payload } : w)));
    else update("wastage", (list) => [...list, { id: newId("ws"), ...payload }]);
    onClose();
  };

  return (
    <Modal title={waste ? "Edit Wastage" : "Record Wastage"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Quantity lost (kg)">
            <TextInput type="number" value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} />
          </Field>
        </div>
        <Field label="Plot it came from">
          <Select
            value={form.plotId}
            onChange={(e) => {
              const p = db.plots.find((x) => x.id === e.target.value);
              setForm({ ...form, plotId: e.target.value, cropId: p?.cropId ?? form.cropId });
            }}
          >
            {db.plots.map((p) => (
              <option key={p.id} value={p.id}>
                {db.farms.find((f) => f.id === p.farmId)?.name} — {p.name} ({db.crops.find((c) => c.id === p.cropId)?.name})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Crop">
          <Select value={form.cropId} onChange={(e) => setForm({ ...form, cropId: e.target.value })}>
            {db.crops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reason">
          <Select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value as WasteReason })}>
            {WASTE_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
        </Field>
        <p className={`text-xs ${qty > inStock ? "text-critical" : "text-muted"}`}>
          {inStock.toLocaleString()} kg of this crop is in store (harvested − sold − written off).
          {qty > inStock ? " This is more than the stock on record — check the harvest and sales records." : ""}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{waste ? "Save changes" : "Save Wastage"}</Button>
        </div>
      </div>
    </Modal>
  );
}
