"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Table, Th, Td, Button, Modal, Field, TextInput, Select, StatCard, Tabs } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, saleTotal, saleKg, saleDueDate, saleOverdueDays, TODAY } from "@/lib/utils";
import { SaleRecord, SaleGradeLine } from "@/lib/types";

export default function SalesPage() {
  const { db, update } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState("Sales");

  const pending = db.sales.filter((s) => s.paymentStatus === "Pending");
  const receivables = pending.reduce((s, x) => s + saleTotal(x), 0);
  const year = String(TODAY.getFullYear());
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

  return (
    <div>
      <PageHeader
        title="Sales & Collectors"
        subtitle="Graded sales to collectors, payment follow-up and average selling price"
        actions={<Button onClick={() => setShowForm(true)}>+ Record Sale</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Revenue ${year}`} value={fmtRM0(yearRevenue)} sub={`${yearKg.toLocaleString()} kg sold`} />
        <StatCard label="Outstanding receivables" value={fmtRM0(receivables)} sub={`${pending.length} sale(s) unpaid`} tone={receivables > 0 ? "warning" : "good"} />
        <StatCard label="Overdue payments" value={String(overdue.length)} tone={overdue.length > 0 ? "critical" : "good"} sub="Past collector payment term" />
        <StatCard label={`Avg selling price ${year}`} value={yearKg ? `RM ${(yearRevenue / yearKg).toFixed(2)}/kg` : "—"} sub="All crops blended" />
      </div>

      <Tabs tabs={["Sales", "Average Price by Crop", "Collectors"]} active={tab} onChange={setTab} />

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
            // by grade
            const gradeMap = new Map<string, { kg: number; rev: number }>();
            for (const s of cropSales)
              for (const g of s.grades) {
                const cur = gradeMap.get(g.grade) ?? { kg: 0, rev: 0 };
                gradeMap.set(g.grade, { kg: cur.kg + g.quantityKg, rev: cur.rev + g.quantityKg * g.pricePerKg });
              }
            // by collector
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

      {tab === "Collectors" && (
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

      {showForm && <SaleForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function SaleForm({ onClose }: { onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    date: TODAY.toISOString().slice(0, 10),
    collectorId: db.collectors[0]?.id ?? "",
    cropId: db.crops[0]?.id ?? "",
    farmId: db.farms[0]?.id ?? "",
  });
  const [grades, setGrades] = useState<SaleGradeLine[]>([
    { grade: "A", quantityKg: 0, pricePerKg: 0 },
    { grade: "B", quantityKg: 0, pricePerKg: 0 },
  ]);

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
                <option key={c.id} value={c.id}>{c.name}</option>
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

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Sale</Button>
        </div>
      </div>
    </Modal>
  );
}
