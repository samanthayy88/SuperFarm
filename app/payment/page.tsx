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
  EmptyState,
  ConfirmDialog,
} from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, currentMonthKey, monthLabel, paidDateOf } from "@/lib/utils";
import MonthlyDues from "@/components/MonthlyDues";
import DateRangeFilter, { DateRange, monthRange, inDateRange, rangeLabel } from "@/components/DateRangeFilter";
import { Payment, PaymentCategory } from "@/lib/types";

/** One line of the payment record: an ad-hoc bill, or a rent / loan month ticked off as paid. */
interface PaymentRow {
  key: string;
  date: string;
  category: string;
  payee: string;
  farm: string | null;
  description: string;
  amount: number;
  /** set for an ad-hoc bill */
  payment?: Payment;
  /** set for a rent / loan month, which lives on the contract / loan itself */
  link?: { kind: "loan" | "rent"; id: string; month: string };
}

export default function PaymentPage() {
  const { db, update } = useStore();
  const [range, setRange] = useState<DateRange>(() =>
    monthRange([...db.payments.map((p) => p.date.slice(0, 7))].sort().pop() ?? currentMonthKey())
  );
  const label = rangeLabel(range);
  const [paymentForm, setPaymentForm] = useState<{ mode: "add" } | { mode: "edit"; payment: Payment } | null>(null);
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);
  const [dateRow, setDateRow] = useState<PaymentRow | null>(null);

  // Rent and loan installments are not stored a second time: a month ticked as paid on
  // Rental Contracts / Borrowings shows here as a payment line, so it is counted once everywhere.
  const rows: PaymentRow[] = [
    ...db.payments.map((p) => ({
      key: p.id,
      date: p.date,
      category: p.category,
      payee: p.payee,
      farm: db.farms.find((f) => f.id === p.farmId)?.name ?? null,
      description: p.description,
      amount: p.amount,
      payment: p,
    })),
    ...db.contracts.flatMap((c) =>
      c.paidMonths.map((m) => ({
        key: `rent-${c.id}-${m}`,
        date: paidDateOf(c, m),
        category: "Farm rental",
        payee: c.landlord,
        farm: db.farms.find((f) => f.id === c.farmId)?.name ?? null,
        description: `Rent for ${monthLabel(m)}`,
        amount: c.monthlyRent,
        link: { kind: "rent" as const, id: c.id, month: m },
      }))
    ),
    ...db.loans.flatMap((l) =>
      l.paidMonths.map((m) => ({
        key: `loan-${l.id}-${m}`,
        date: paidDateOf(l, m),
        category: "Loan repayment",
        payee: l.lender,
        farm: null,
        description: `Installment for ${monthLabel(m)}`,
        amount: l.monthlyInstallment,
        link: { kind: "loan" as const, id: l.id, month: m },
      }))
    ),
  ];
  const monthPayments = rows
    .filter((r) => inDateRange(r.date, range))
    .sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
  const totalSpent = monthPayments.reduce((s, r) => s + r.amount, 0);
  const billsTotal = monthPayments.filter((r) => r.payment).reduce((s, r) => s + r.amount, 0);
  const rentLoanTotal = totalSpent - billsTotal;

  const doDeletePayment = (p: Payment) => {
    update("payments", (list) => list.filter((x) => x.id !== p.id));
    setDeletePayment(null);
  };

  return (
    <div>
      <PageHeader
        title="Payment"
        subtitle="Ad-hoc company bills — utilities, transport, professional fees and other one-off costs"
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <Button onClick={() => setPaymentForm({ mode: "add" })}>+ Record Payment</Button>
          </>
        }
      />

      <MonthlyDues />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`Total paid — ${label}`} value={fmtRM0(totalSpent)} sub={`${monthPayments.length} payment${monthPayments.length === 1 ? "" : "s"}`} />
        <StatCard label="Bills & other payments" value={fmtRM0(billsTotal)} />
        <StatCard label="Farm rent & loan repayments" value={fmtRM0(rentLoanTotal)} sub="Added automatically from Rental Contracts and Borrowings" />
      </div>

      <Card title={`Payments — ${label}`}>
        {monthPayments.length === 0 ? (
          <EmptyState message="No payments recorded for this period." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Category</Th>
                <Th>Payee</Th>
                <Th>Farm</Th>
                <Th>Description</Th>
                <Th right>Amount</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {monthPayments.map((r) => (
                <tr key={r.key}>
                  <Td>{fmtDate(r.date)}</Td>
                  <Td>{r.link ? <Badge tone={r.link.kind === "rent" ? "accent" : "neutral"}>{r.category}</Badge> : r.category}</Td>
                  <Td>{r.payee}</Td>
                  <Td>{r.farm ?? <span className="text-muted">All farms</span>}</Td>
                  <Td>
                    {r.description}
                    {r.link && (
                      <span className="block text-xs text-muted">
                        From {r.link.kind === "rent" ? "Rental Contracts" : "Borrowings"}
                      </span>
                    )}
                  </Td>
                  <Td right className="font-medium">{fmtRM(r.amount)}</Td>
                  <Td>
                    <div className="flex gap-1">
                      {r.payment ? (
                        <>
                          <button
                            onClick={() => setPaymentForm({ mode: "edit", payment: r.payment! })}
                            className="rounded-full border border-hairline px-3 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeletePayment(r.payment!)}
                            className="rounded-full px-3 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDateRow(r)}
                          className="rounded-full border border-hairline px-3 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          Edit date
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="font-semibold">Total</Td>
                <Td /><Td /><Td /><Td />
                <Td right className="font-semibold">{fmtRM(totalSpent)}</Td>
                <Td />
              </tr>
            </tbody>
          </Table>
        )}
      </Card>

      {paymentForm && (
        <PaymentForm payment={paymentForm.mode === "edit" ? paymentForm.payment : undefined} onClose={() => setPaymentForm(null)} />
      )}
      {dateRow && <PaidDateForm row={dateRow} onClose={() => setDateRow(null)} />}
      {deletePayment && (
        <ConfirmDialog
          title="Delete this payment record?"
          message={`The ${fmtRM(deletePayment.amount)} payment to “${deletePayment.payee}” will be permanently removed.`}
          confirmLabel="Delete payment"
          onConfirm={() => doDeletePayment(deletePayment)}
          onClose={() => setDeletePayment(null)}
        />
      )}
    </div>
  );
}

/** Change the date a rent / loan month was paid, or take it back to unpaid. */
function PaidDateForm({ row, onClose }: { row: PaymentRow; onClose: () => void }) {
  const { update } = useStore();
  const link = row.link!;
  const [date, setDate] = useState(row.date);

  const save = () => {
    if (!date) return;
    const setDateOn = <T extends { id: string; paidDates?: Record<string, string> }>(list: T[]) =>
      list.map((x) => (x.id === link.id ? { ...x, paidDates: { ...(x.paidDates ?? {}), [link.month]: date } } : x));
    if (link.kind === "rent") update("contracts", setDateOn);
    else update("loans", setDateOn);
    onClose();
  };

  const unmark = () => {
    const clear = <T extends { id: string; paidMonths: string[]; paidDates?: Record<string, string> }>(list: T[]) =>
      list.map((x) => {
        if (x.id !== link.id) return x;
        const dates = { ...(x.paidDates ?? {}) };
        delete dates[link.month];
        return { ...x, paidMonths: x.paidMonths.filter((m) => m !== link.month), paidDates: dates };
      });
    if (link.kind === "rent") update("contracts", clear);
    else update("loans", clear);
    onClose();
  };

  return (
    <Modal title={`${row.category} — ${row.payee}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-ink-2">
          {row.description} · {fmtRM(row.amount)}. This payment comes from {link.kind === "rent" ? "Rental Contracts" : "Borrowings"}, so
          the amount is changed there. You can set the date it was actually paid.
        </p>
        <Field label="Date paid">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="danger" onClick={unmark}>Mark as not paid</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save date</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PaymentForm({ payment, onClose }: { payment?: Payment; onClose: () => void }) {
  const { db, update } = useStore();
  const editing = Boolean(payment);
  const [form, setForm] = useState({
    date: payment?.date ?? new Date().toISOString().slice(0, 10),
    category: payment?.category ?? ("Utilities" as PaymentCategory),
    payee: payment?.payee ?? "",
    description: payment?.description ?? "",
    amount: payment ? String(payment.amount) : "",
    farmId: payment?.farmId ?? "",
    notes: payment?.notes ?? "",
  });

  const submit = () => {
    if (!form.payee.trim() || !form.amount) return;
    const payload = {
      date: form.date,
      category: form.category,
      payee: form.payee.trim(),
      description: form.description.trim(),
      amount: Number(form.amount) || 0,
      farmId: form.farmId || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (payment) {
      update("payments", (list) => list.map((p) => (p.id === payment.id ? { ...p, ...payload } : p)));
    } else {
      update("payments", (list) => [...list, { id: newId("pm"), ...payload }]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? "Edit Payment" : "Record Payment"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PaymentCategory })}>
              <option>Utilities</option>
              <option>Rental/Office</option>
              <option>Transport</option>
              <option>Professional Fees</option>
              <option>Bank Charges</option>
              <option>Other</option>
            </Select>
          </Field>
        </div>
        {form.category === "Rental/Office" && (
          <p className="rounded-card border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink-2">
            Farm rent and loan repayments are added here automatically when you tick them as paid — record only other rent (e.g.
            office) here so it isn&apos;t counted twice.
          </p>
        )}
        <Field label="Payee">
          <TextInput value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} placeholder="Who was paid" />
        </Field>
        <Field label="Description">
          <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Amount (RM)">
          <TextInput type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Farm (for crop costing)">
          <Select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })}>
            <option value="">All farms (company-wide)</option>
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Save Payment"}</Button>
        </div>
      </div>
    </Modal>
  );
}
