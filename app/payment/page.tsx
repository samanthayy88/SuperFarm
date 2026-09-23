"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import {
  PageHeader,
  Card,
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
import { fmtRM, fmtRM0, fmtDate, currentMonthKey, monthLabel, lastNMonthKeys } from "@/lib/utils";
import { Payment, PaymentCategory } from "@/lib/types";

export default function PaymentPage() {
  const { db, update } = useStore();
  const months = lastNMonthKeys(6).reverse();
  const [month, setMonth] = useState(
    () => months.find((m) => db.payments.some((p) => p.date.startsWith(m))) ?? currentMonthKey()
  );
  const [paymentForm, setPaymentForm] = useState<{ mode: "add" } | { mode: "edit"; payment: Payment } | null>(null);
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);

  const monthPayments = db.payments
    .filter((p) => p.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalSpent = monthPayments.reduce((s, p) => s + p.amount, 0);

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
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink"
            >
              {months.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
            <Button onClick={() => setPaymentForm({ mode: "add" })}>+ Record Payment</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label={`Total payments — ${monthLabel(month)}`} value={fmtRM0(totalSpent)} />
        <StatCard label="Records this month" value={String(monthPayments.length)} />
      </div>

      <Card title={`Payments — ${monthLabel(month)}`}>
        {monthPayments.length === 0 ? (
          <EmptyState message="No payments recorded for this month." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Category</Th>
                <Th>Payee</Th>
                <Th>Description</Th>
                <Th right>Amount</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {monthPayments.map((p) => (
                <tr key={p.id}>
                  <Td>{fmtDate(p.date)}</Td>
                  <Td>{p.category}</Td>
                  <Td>{p.payee}</Td>
                  <Td>{p.description}</Td>
                  <Td right className="font-medium">{fmtRM(p.amount)}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPaymentForm({ mode: "edit", payment: p })}
                        className="rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletePayment(p)}
                        className="rounded-md px-2 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
                      >
                        Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="font-semibold">Total</Td>
                <Td /><Td /><Td />
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

function PaymentForm({ payment, onClose }: { payment?: Payment; onClose: () => void }) {
  const { update } = useStore();
  const editing = Boolean(payment);
  const [form, setForm] = useState({
    date: payment?.date ?? new Date().toISOString().slice(0, 10),
    category: payment?.category ?? ("Utilities" as PaymentCategory),
    payee: payment?.payee ?? "",
    description: payment?.description ?? "",
    amount: payment ? String(payment.amount) : "",
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
        <Field label="Payee">
          <TextInput value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} placeholder="Who was paid" />
        </Field>
        <Field label="Description">
          <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Amount (RM)">
          <TextInput type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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
