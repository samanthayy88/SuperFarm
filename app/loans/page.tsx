"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Button, Modal, Field, TextInput, Select, StatCard, EmptyState, ConfirmDialog, MonthSelect } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, unpaidLoanMonths, loanBalance, currentMonthKey, monthLabel, lastNMonthKeys } from "@/lib/utils";
import { Loan } from "@/lib/types";

/** Whether `month` ("YYYY-MM") falls within a loan's tenure, counting from its start month. */
function monthWithinTenure(l: Loan, month: string): boolean {
  const start = l.startDate.slice(0, 7);
  if (month < start) return false;
  const [sy, sm] = start.split("-").map(Number);
  const [my, mm] = month.split("-").map(Number);
  const idx = (my - sy) * 12 + (mm - sm);
  return idx < l.tenureMonths;
}

export default function LoansPage() {
  const { db, update } = useStore();
  const [loanForm, setLoanForm] = useState<{ mode: "add" } | { mode: "edit"; loan: Loan } | null>(null);
  const [deleteLoan, setDeleteLoan] = useState<Loan | null>(null);
  const curMonth = currentMonthKey();
  const months = lastNMonthKeys(24).reverse();
  const [month, setMonth] = useState(curMonth);

  const doDeleteLoan = (loan: Loan) => {
    update("loans", (list) => list.filter((l) => l.id !== loan.id));
    setDeleteLoan(null);
  };

  const totalBorrowed = db.loans.reduce((s, l) => s + l.principal, 0);
  const totalBalance = db.loans.reduce((s, l) => s + loanBalance(l), 0);
  const monthlyDue = db.loans.filter((l) => monthWithinTenure(l, month)).reduce((s, l) => s + l.monthlyInstallment, 0);
  const unpaidCount = db.loans.filter((l) => monthWithinTenure(l, month) && !l.paidMonths.includes(month)).length;

  const togglePaid = (loanId: string, m: string) => {
    update("loans", (list) =>
      list.map((l) =>
        l.id === loanId
          ? {
              ...l,
              paidMonths: l.paidMonths.includes(m)
                ? l.paidMonths.filter((x) => x !== m)
                : [...l.paidMonths, m],
            }
          : l
      )
    );
  };

  return (
    <div>
      <PageHeader
        title="Loans & Repayments"
        subtitle="Bank, relatives and friends — installments, balances and missed payments"
        actions={
          <>
            <MonthSelect value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
            <Button onClick={() => setLoanForm({ mode: "add" })}>+ Add Loan</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total borrowed" value={fmtRM0(totalBorrowed)} />
        <StatCard label="Estimated balance" value={fmtRM0(totalBalance)} sub="Principal minus installments paid" />
        <StatCard label={`Installments due — ${monthLabel(month)}`} value={fmtRM0(monthlyDue)} />
        <StatCard label={`Unpaid — ${monthLabel(month)}`} value={String(unpaidCount)} tone={unpaidCount > 0 ? "critical" : "good"} />
      </div>

      <div className="space-y-4">
        {db.loans.length === 0 && (
          <Card>
            <EmptyState message="No loans yet. Use “+ Add Loan” to add your first one." />
          </Card>
        )}
        {db.loans.map((l) => {
          const missed = unpaidLoanMonths(l).filter((m) => m < curMonth);
          const dueNow = unpaidLoanMonths(l).includes(curMonth);
          return (
            <Card
              key={l.id}
              title={`${l.lender}`}
              actions={
                <div className="flex gap-2">
                  <Button small variant="ghost" onClick={() => setLoanForm({ mode: "edit", loan: l })}>
                    Edit
                  </Button>
                  <Button small variant="danger" onClick={() => setDeleteLoan(l)}>
                    Delete
                  </Button>
                </div>
              }
            >
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

              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Installment — {monthLabel(month)} (click to mark paid/unpaid)</p>
              {!monthWithinTenure(l, month) ? (
                <span className="inline-block rounded border border-hairline px-3 py-1.5 text-xs text-muted/50">
                  {month < l.startDate.slice(0, 7) ? "Loan hadn't started yet" : "Loan tenure already ended"}
                </span>
              ) : (
                (() => {
                  const paid = l.paidMonths.includes(month);
                  return (
                    <button
                      onClick={() => togglePaid(l.id, month)}
                      className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                        paid
                          ? "border-good/40 bg-good/10 text-good"
                          : month === curMonth
                            ? "border-warning/40 bg-warning/10 text-warning"
                            : month > curMonth
                              ? "border-hairline bg-surface-2 text-ink-2"
                              : "border-critical/40 bg-critical/10 text-critical"
                      }`}
                    >
                      {monthLabel(month)} — {paid ? "Paid ✓" : month === curMonth ? "Due" : month > curMonth ? "Upcoming" : "MISSED"}
                    </button>
                  );
                })()
              )}
            </Card>
          );
        })}
      </div>

      {loanForm && (
        <LoanForm loan={loanForm.mode === "edit" ? loanForm.loan : undefined} onClose={() => setLoanForm(null)} />
      )}
      {deleteLoan && (
        <ConfirmDialog
          title={`Delete ${deleteLoan.lender}?`}
          message={`“${deleteLoan.lender}” and its full payment history will be permanently removed.`}
          confirmLabel="Delete loan"
          onConfirm={() => doDeleteLoan(deleteLoan)}
          onClose={() => setDeleteLoan(null)}
        />
      )}
    </div>
  );
}

function LoanForm({ loan, onClose }: { loan?: Loan; onClose: () => void }) {
  const { update } = useStore();
  const editing = Boolean(loan);
  const [form, setForm] = useState({
    lender: loan?.lender ?? "",
    lenderType: loan?.lenderType ?? ("Bank" as Loan["lenderType"]),
    principal: loan ? String(loan.principal) : "",
    interestRatePct: loan ? String(loan.interestRatePct) : "",
    monthlyInstallment: loan ? String(loan.monthlyInstallment) : "",
    startDate: loan?.startDate ?? "",
    tenureMonths: loan ? String(loan.tenureMonths) : "",
    notes: loan?.notes ?? "",
  });

  const submit = () => {
    if (!form.lender || !form.startDate) return;
    const payload = {
      lender: form.lender,
      lenderType: form.lenderType,
      principal: Number(form.principal) || 0,
      interestRatePct: Number(form.interestRatePct) || 0,
      monthlyInstallment: Number(form.monthlyInstallment) || 0,
      startDate: form.startDate,
      tenureMonths: Number(form.tenureMonths) || 12,
      notes: form.notes || undefined,
    };
    if (loan) {
      update("loans", (list) => list.map((l) => (l.id === loan.id ? { ...l, ...payload } : l)));
    } else {
      update("loans", (list) => [...list, { id: newId("l"), ...payload, paidMonths: [] }]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? `Edit ${loan!.lender}` : "Add Loan"} onClose={onClose}>
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
          <Button onClick={submit}>{editing ? "Save changes" : "Save Loan"}</Button>
        </div>
      </div>
    </Modal>
  );
}
