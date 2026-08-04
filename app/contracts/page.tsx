"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Button, Modal, Field, TextInput, Select, StatCard } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, contractStatus, unpaidRentMonths, currentMonthKey, monthLabel, lastNMonthKeys, daysBetween, TODAY } from "@/lib/utils";
import { RentalContract } from "@/lib/types";

export default function ContractsPage() {
  const { db, update } = useStore();
  const [showForm, setShowForm] = useState(false);
  const curMonth = currentMonthKey();

  const totalMonthlyRent = db.contracts
    .filter((c) => contractStatus(c) !== "Expired")
    .reduce((s, c) => s + c.monthlyRent, 0);
  const missedTotal = db.contracts.reduce(
    (s, c) => s + unpaidRentMonths(c).filter((m) => m < curMonth).length * c.monthlyRent,
    0
  );
  const expiringCount = db.contracts.filter((c) => contractStatus(c) !== "Active").length;

  const togglePaid = (contractId: string, month: string) => {
    update("contracts", (list) =>
      list.map((c) =>
        c.id === contractId
          ? {
              ...c,
              paidMonths: c.paidMonths.includes(month)
                ? c.paidMonths.filter((m) => m !== month)
                : [...c.paidMonths, month],
            }
          : c
      )
    );
  };

  const recentMonths = lastNMonthKeys(6);

  return (
    <div>
      <PageHeader
        title="Rental Contracts"
        subtitle="Landlords, monthly rent, payment tracking and renewal reminders"
        actions={<Button onClick={() => setShowForm(true)}>+ Add Contract</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total monthly rent (active)" value={fmtRM0(totalMonthlyRent)} />
        <StatCard label="Missed rent outstanding" value={fmtRM0(missedTotal)} tone={missedTotal > 0 ? "critical" : "good"} />
        <StatCard label="Contracts needing renewal" value={String(expiringCount)} tone={expiringCount > 0 ? "warning" : "good"} />
      </div>

      <div className="space-y-4">
        {db.contracts.map((c) => {
          const farm = db.farms.find((f) => f.id === c.farmId);
          const st = contractStatus(c);
          const missed = unpaidRentMonths(c).filter((m) => m < curMonth);
          const end = new Date(c.endDate);
          return (
            <Card key={c.id} title={`${farm?.name ?? "Unknown farm"} — ${c.landlord}`}>
              <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <Badge tone={st === "Active" ? "good" : st === "Expiring Soon" ? "warning" : "critical"}>
                  {st === "Expiring Soon" ? `Expires in ${daysBetween(TODAY, end)} days` : st}
                </Badge>
                <span className="text-ink-2">
                  <span className="text-muted">Rent:</span> {fmtRM(c.monthlyRent)}/month
                </span>
                <span className="text-ink-2">
                  <span className="text-muted">Period:</span> {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                </span>
                <span className="text-ink-2">
                  <span className="text-muted">Deposit:</span> {fmtRM0(c.depositPaid)}
                </span>
                {c.notes && <span className="text-muted italic">{c.notes}</span>}
              </div>

              {missed.length > 0 && (
                <p className="mb-3 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
                  Missed rent: {missed.map(monthLabel).join(", ")} — total {fmtRM0(missed.length * c.monthlyRent)} outstanding
                </p>
              )}

              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Rent payments — last 6 months (click to mark paid/unpaid)</p>
              <div className="flex flex-wrap gap-2">
                {recentMonths.map((m) => {
                  const inTerm = m >= c.startDate.slice(0, 7) && m <= c.endDate.slice(0, 7);
                  const paid = c.paidMonths.includes(m);
                  if (!inTerm)
                    return (
                      <span key={m} className="rounded border border-hairline px-3 py-1.5 text-xs text-muted/50">
                        {monthLabel(m)} — n/a
                      </span>
                    );
                  return (
                    <button
                      key={m}
                      onClick={() => togglePaid(c.id, m)}
                      className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                        paid
                          ? "border-good/40 bg-good/10 text-good"
                          : m === curMonth
                            ? "border-warning/40 bg-warning/10 text-warning"
                            : "border-critical/40 bg-critical/10 text-critical"
                      }`}
                    >
                      {monthLabel(m)} — {paid ? "Paid ✓" : m === curMonth ? "Due" : "MISSED"}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {showForm && <ContractForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function ContractForm({ onClose }: { onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    farmId: db.farms[0]?.id ?? "",
    landlord: "",
    monthlyRent: "",
    startDate: "",
    endDate: "",
    depositPaid: "",
    notes: "",
  });

  const submit = () => {
    if (!form.landlord || !form.startDate || !form.endDate) return;
    const c: RentalContract = {
      id: newId("ct"),
      farmId: form.farmId,
      landlord: form.landlord,
      monthlyRent: Number(form.monthlyRent) || 0,
      startDate: form.startDate,
      endDate: form.endDate,
      depositPaid: Number(form.depositPaid) || 0,
      notes: form.notes || undefined,
      paidMonths: [],
    };
    update("contracts", (list) => [...list, c]);
    onClose();
  };

  return (
    <Modal title="Add Rental Contract" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Farm">
          <Select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })}>
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Landlord">
          <TextInput value={form.landlord} onChange={(e) => setForm({ ...form, landlord: e.target.value })} />
        </Field>
        <Field label="Monthly rent (RM)">
          <TextInput type="number" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <TextInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="End date">
            <TextInput type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Deposit paid (RM)">
          <TextInput type="number" value={form.depositPaid} onChange={(e) => setForm({ ...form, depositPaid: e.target.value })} />
        </Field>
        <Field label="Notes">
          <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Contract</Button>
        </div>
      </div>
    </Modal>
  );
}
