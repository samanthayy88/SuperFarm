"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Table, Th, Td, Button, Modal, Field, TextInput, Select, StatCard, EmptyState, ConfirmDialog } from "@/components/ui";
import { fmtRM, fmtDate, commissionRateFor, currentMonthKey, monthLabel, lastNMonthKeys } from "@/lib/utils";
import { HarvestRecord } from "@/lib/types";
import VarietySelect from "@/components/VarietySelect";

export default function HarvestRecordPage() {
  const { db, update } = useStore();
  const months = lastNMonthKeys(6).reverse();
  const [month, setMonth] = useState(
    () => months.find((m) => db.harvests.some((h) => h.date.startsWith(m))) ?? currentMonthKey()
  );
  const [harvestForm, setHarvestForm] = useState<{ mode: "add" } | { mode: "edit"; harvest: HarvestRecord } | null>(null);
  const [deleteHarvest, setDeleteHarvest] = useState<HarvestRecord | null>(null);

  const rows = db.harvests
    .filter((h) => h.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalKg = rows.reduce((s, h) => s + h.quantityKg, 0);
  const totalCommission = rows.reduce(
    (s, h) => s + h.quantityKg * commissionRateFor(db, h.workerId, h.plotId, h.cropId, h.variety),
    0
  );

  const doDeleteHarvest = (h: HarvestRecord) => {
    update("harvests", (list) => list.filter((x) => x.id !== h.id));
    setDeleteHarvest(null);
  };

  return (
    <div>
      <PageHeader
        title="Harvest Record"
        subtitle="Kg harvested per plot — drives worker commission and sits behind Sales Record"
        actions={
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
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`Total harvested — ${monthLabel(month)}`} value={`${totalKg.toLocaleString()} kg`} />
        <StatCard label="Records this month" value={String(rows.length)} />
        <StatCard label="Commission accrued" value={fmtRM(totalCommission)} sub="Paid out via Payroll" />
      </div>

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
                const farm = db.farms.find((f) => f.id === plot?.farmId)?.name ?? "—";
                const crop = db.crops.find((c) => c.id === h.cropId);
                const rate = commissionRateFor(db, h.workerId, h.plotId, h.cropId, h.variety);
                return (
                  <tr key={h.id}>
                    <Td>{fmtDate(h.date)}</Td>
                    <Td>{worker}</Td>
                    <Td>{farm} · {plot?.name ?? "—"}</Td>
                    <Td>{crop?.name ?? "—"}</Td>
                    <Td>{h.variety || <span className="text-muted">—</span>}</Td>
                    <Td right>{h.quantityKg.toLocaleString()} kg</Td>
                    <Td right>RM {rate.toFixed(2)}</Td>
                    <Td right>{fmtRM(h.quantityKg * rate)}</Td>
                    <Td>
                      <div className="flex gap-1">
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
