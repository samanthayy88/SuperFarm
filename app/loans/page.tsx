"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Button, Modal, Field, TextInput, Select, StatCard } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, unpaidLoanMonths, loanBalance, currentMonthKey, monthLabel, lastNMonthKeys } from "@/lib/utils";
import { Loan } from "@/lib/types";

export default function LoansPage() {
  const { db, update } = useStore();
  const [showForm, setShowForm] = useState(false);
  const curMonth = currentMonthKey();

  const totalBorrowed = db.loans.reduce((s, l) => s + l.principal, 0);
  const totalBalance = db.loans.reduce((s, l) => s + loanBalance(l), 0);
  const totalMonthly = db.loans.reduce((s, l) => s + l.monthlyInstallment, 0);
  const missedCount = db.loans.reduce((s, l) => s + unpaidLoanMonths(l).filter((m) => m < curMonth).length, 0);

  const togglePaid = (loanId: string, month: string) => {
    update("loans", (list) =>
      list.map((l) =>
        l.id === loanId
          ? {
              ...l,
              paidMonths: l.paidMonths.includes(month)
                ? l.paidMonths.filter((m) => m !== month)
                : [...l.paidMonths, month],
            }
          : l
      )
    );
  };

  const recentMonths = lastNMonthKeys(6);

  return (
    <div>
      <PageHeader
        title="Loans & Repayments"
        subtitle="Bank, relatives and friends — installments, balances and missed payments"
        actions={<Button onClick={() => setShowForm(true)}>+ Add Loan</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total borrowed" value={fmtRM0(totalBorrowed)} />
        <StatCard label="Estimated balance" value={fmtRM0(totalBalance)} sub="Principal minus installments paid" />
        <StatCard label="Total monthly installments" value={fmtRM0(totalMonthly)} />
        <StatCard label="Missed installments" value={String(missedCount)} tone={missedCount > 0 ? "critical" : "good"} />
      </div>

      <div className="space-y-4">
        {db.loans.map((l) => {
          const missed = unpaidLoanMonths(l).filter((m) => m < curMonth);
          const dueNow = unpaidLoanMonths(l).includes(curMonth);
          return (
            <Card key={l.id} title={`${l.lender}`}>
              <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <Badge tone={l.lenderType === "Bank" ? "accent" : "neutral"}>{l.lenderType}</Badge>
                <span className="text-ink-2"><span className="text-muted">Principal:</span> {fmtRM0(l.principal)}</span>
                <span className="text-ink-2"><span className="text-muted">Interest:</span> {l.interestRatePct}% p.a.</span>
                <span className="text-ink-2"><span className="text-muted">Installment:</span> {fmtRM(l.monthlyInstallment)}/month</span>
                <span className="text-ink-2"><span className="text-muted">Tenure:</span> {l.tenureMonths} months from {fmtDate(l.startDate)}</span>
                <span className="text-ink-2"><span className="text-muted">Balance:</span> <span className="font-medium">{fmtRM0(loanBalance(l))}</span></span>
                {l.notes && <span className="text-muted italic">{l.notes}</span>}
              </div>

              {missed.length > 0 && (
                <p className="mb-3 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
                  Missed installments: {missed.map(monthLabel).join(", ")} — {fmtRM0(missed.length * l.monthlyInstallment)} outstanding
                </p>
              )}
              {dueNow && missed.length === 0 && (
                <p className="mb-3 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                  This month&apos;s installment ({fmtRM(l.monthlyInstallment)}) not paid yet
                </p>
              )}

              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Installments — last 6 months (click to mark paid/unpaid)</p>
              <div className="flex flex-wrap gap-2">
                {recentMonths.map((m) => {
                  const start = l.startDate.slice(0, 7);
                  if (m < start)
                    return (
                      <span key={m} className="rounded border border-hairline px-3 py-1.5 text-xs text-muted/50">
                        {monthLabel(m)} — n/a
                      </span>
                    );
                  const paid = l.paidMonths.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => togglePaid(l.id, m)}
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

      {showForm && <LoanForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function LoanForm({ onClose }: { onClose: () => void }) {
  const { update } = useStore();
  const [form, setForm] = useState({
    lender: "",
    lenderType: "Bank" as Loan["lenderType"],
    principal: "",
    interestRatePct: "",
    monthlyInstallment: "",
    startDate: "",
    tenureMonths: "",
    notes: "",
  });

  const submit = () => {
    if (!form.lender || !form.startDate) return;
    const l: Loan = {
      id: newId("l"),
      lender: form.lender,
      lenderType: form.lenderType,
      principal: Number(form.principal) || 0,
      interestRatePct: Number(form.interestRatePct) || 0,
      monthlyInstallment: Number(form.monthlyInstallment) || 0,
      startDate: form.startDate,
      tenureMonths: Number(form.tenureMonths) || 12,
      paidMonths: [],
      notes: form.notes || undefined,
    };
    update("loans", (list) => [...list, l]);
    onClose();
  };

  return (
    <Modal title="Add Loan" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Lender name">
          <TextInput value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} />
        </Field>
        <Field label="Lender type">
          <Select value={form.lenderType} onChange={(e) => setForm({ ...form, lenderType: e.target.value as Loan["lenderType"] })}>
            <option>Bank</option>
            <option>Relative</option>
            <option>Friend</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Principal (RM)">
            <TextInput type="number" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
          </Field>
          <Field label="Interest rate (% p.a.)">
            <TextInput type="number" value={form.interestRatePct} onChange={(e) => setForm({ ...form, interestRatePct: e.target.value })} />
          </Field>
          <Field label="Monthly installment (RM)">
            <TextInput type="number" value={form.monthlyInstallment} onChange={(e) => setForm({ ...form, monthlyInstallment: e.target.value })} />
          </Field>
          <Field label="Tenure (months)">
            <TextInput type="number" value={form.tenureMonths} onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })} />
          </Field>
        </div>
        <Field label="Start date">
          <TextInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </Field>
        <Field label="Notes">
          <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Loan</Button>
        </div>
      </div>
    </Modal>
  );
}
