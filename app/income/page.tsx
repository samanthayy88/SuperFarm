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
  currentMonthKey,
  monthLabel,
  lastNMonthKeys,
  saleTotal,
  saleKg,
  saleDueDate,
  saleOverdueDays,
  pendingStockKg,
  TODAY,
} from "@/lib/utils";
import { HarvestRecord, SaleRecord, SaleGradeLine } from "@/lib/types";
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
  const totalCommission = rows.reduce(
    (s, h) => s + h.quantityKg * commissionRateFor(db, h.workerId, h.plotId, h.cropId, h.variety),
    0
  );

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

  const stockRows = db.crops
    .map((c) => ({ crop: c, pending: pendingStockKg(db, c.id) }))
    .filter((r) => db.harvests.some((h) => h.cropId === r.crop.id));

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
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Harvested — ${monthLabel(month)}`} value={`${totalKg.toLocaleString()} kg`} sub={`${fmtRM(totalCommission)} commission`} />
        <StatCard label={`Revenue ${year}`} value={fmtRM0(yearRevenue)} sub={`${yearKg.toLocaleString()} kg sold`} />
        <StatCard label="Outstanding receivables" value={fmtRM0(receivables)} sub={`${pending.length} sale(s) unpaid`} tone={receivables > 0 ? "warning" : "good"} />
        <StatCard label="Overdue payments" value={String(overdue.length)} tone={overdue.length > 0 ? "critical" : "good"} sub="Past collector payment term" />
      </div>

      <Card title="Stock awaiting sale — harvested minus sold, all time" className="mb-6">
        {stockRows.length === 0 ? (
          <EmptyState message="No harvests recorded yet." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {stockRows.map(({ crop, pending: p }) => (
              <Badge key={crop.id} tone={p > 0 ? "warning" : p < 0 ? "critical" : "good"}>
                {crop.name}: {p.toLocaleString()} kg {p > 0 ? "pending" : p < 0 ? "oversold" : "fully sold"}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Tabs tabs={["Harvest Records", "Sales", "Average Price by Crop", "Collector Payments"]} active={tab} onChange={setTab} />

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
                  const rate = commissionRateFor(db, h.workerId, h.plotId, h.cropId, h.variety);
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
    variety: harvest?.variety ?? firstPlot?.variety ?? "",
    quantityKg: harvest ? String(harvest.quantityKg) : "",
  });

  const plot = db.plots.find((p) => p.id === form.plotId);
  const crop = db.crops.find((c) => c.id === plot?.cropId);
  const worker = db.workers.find((w) => w.id === plot?.workerId);
  const qty = Number(form.quantityKg) || 0;
  const rate = plot && crop ? commissionRateFor(db, plot.workerId, plot.id, crop.id, form.variety || undefined) : 0;
  const commission = qty * rate;

  const setPlot = (plotId: string) => {
    const p = db.plots.find((x) => x.id === plotId);
    setForm({ ...form, plotId, variety: p?.variety ?? "" });
  };

  const submit = () => {
    if (!plot || !qty) return;
    const payload = {
      date: form.date,
      plotId: plot.id,
      workerId: plot.workerId,
      cropId: plot.cropId,
      variety: form.variety.trim() || undefined,
      quantityKg: qty,
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
            onChange={(v) => setForm({ ...form, variety: v })}
            anyLabel="No variety"
          />
        </Field>
        <div className="rounded border border-hairline bg-surface-2 p-3 text-sm">
          <p className="text-muted">Auto-assigned</p>
          <p className="mt-1 text-ink-2">Worker: <span className="font-medium">{worker?.name ?? "—"}</span></p>
          <p className="text-ink-2">Crop: <span className="font-medium">{crop?.name ?? "—"}</span> at RM {rate.toFixed(2)}/kg</p>
          <p className="mt-1 text-ink">Commission for this harvest: <span className="font-semibold">{fmtRM(commission)}</span></p>
        </div>
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
