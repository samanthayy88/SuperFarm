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
  EmptyState,
  ConfirmDialog,
  StatCard,
} from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, currentMonthKey, monthLabel, lastNMonthKeys } from "@/lib/utils";
import { WorkerExpense, WorkerExpenseType } from "@/lib/types";

export default function WorkerExpensesPage() {
  const { db, update } = useStore();
  const months = lastNMonthKeys(6).reverse();
  const [month, setMonth] = useState(
    () => months.find((m) => db.workerExpenses.some((e) => e.date.startsWith(m))) ?? currentMonthKey()
  );
  const [expenseForm, setExpenseForm] = useState<
    { mode: "add"; workerId: string } | { mode: "edit"; expense: WorkerExpense } | null
  >(null);
  const [deleteExpense, setDeleteExpense] = useState<WorkerExpense | null>(null);

  const monthExpenses = db.workerExpenses.filter((e) => e.date.startsWith(month));
  const totalAdvances = monthExpenses.filter((e) => e.type === "Cash Advance").reduce((s, e) => s + e.amount, 0);
  const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalDeductible = monthExpenses.filter((e) => e.deductFromSalary).reduce((s, e) => s + e.amount, 0);

  const doDeleteExpense = (e: WorkerExpense) => {
    update("workerExpenses", (list) => list.filter((x) => x.id !== e.id));
    setDeleteExpense(null);
  };

  return (
    <div>
      <PageHeader
        title="Worker Expenses"
        subtitle="Groceries, top-ups, cigarettes and cash advances, with optional salary deduction"
        actions={
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`Total expenses — ${monthLabel(month)}`} value={fmtRM0(totalSpent)} sub="Groceries, top-ups, cigarettes, advances" />
        <StatCard label="Cash advances given" value={fmtRM0(totalAdvances)} tone={totalAdvances > 0 ? "warning" : undefined} />
        <StatCard label="To deduct from salary" value={fmtRM0(totalDeductible)} sub="See Payroll" tone={totalDeductible > 0 ? "warning" : undefined} />
      </div>

      <div className="space-y-4">
        {db.workers.length === 0 && (
          <Card>
            <EmptyState message="No workers yet — add one under My Workers first." />
          </Card>
        )}

        {db.workers.map((w) => {
          const expenses = monthExpenses
            .filter((e) => e.workerId === w.id)
            .sort((a, b) => b.date.localeCompare(a.date));
          return (
            <Card
              key={w.id}
              title={w.name}
              actions={
                <Button small variant="ghost" onClick={() => setExpenseForm({ mode: "add", workerId: w.id })}>
                  + Record Expense / Advance
                </Button>
              }
            >
              {expenses.length === 0 ? (
                <EmptyState message={`No expenses recorded for ${monthLabel(month)}.`} />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Description</Th>
                      <Th right>Amount</Th>
                      <Th>Deduct from salary?</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <Td>{fmtDate(e.date)}</Td>
                        <Td>
                          <Badge tone={e.type === "Cash Advance" ? "warning" : "neutral"}>{e.type}</Badge>
                        </Td>
                        <Td>{e.description}</Td>
                        <Td right>{fmtRM(e.amount)}</Td>
                        <Td>
                          {e.deductFromSalary ? (
                            <span className="text-good">Yes</span>
                          ) : (
                            <span className="text-muted">No (employer covers)</span>
                          )}
                        </Td>
                        <Td>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setExpenseForm({ mode: "edit", expense: e })}
                              className="rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteExpense(e)}
                              className="rounded-md px-2 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
                            >
                              Delete
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          );
        })}
      </div>

      {expenseForm && (
        <ExpenseForm
          workerId={expenseForm.mode === "add" ? expenseForm.workerId : expenseForm.expense.workerId}
          expense={expenseForm.mode === "edit" ? expenseForm.expense : undefined}
          onClose={() => setExpenseForm(null)}
        />
      )}
      {deleteExpense && (
        <ConfirmDialog
          title="Delete this expense record?"
          message={`This ${deleteExpense.type.toLowerCase()} record of ${fmtRM(deleteExpense.amount)} will be permanently removed.`}
          confirmLabel="Delete record"
          onConfirm={() => doDeleteExpense(deleteExpense)}
          onClose={() => setDeleteExpense(null)}
        />
      )}
    </div>
  );
}

function ExpenseForm({
  workerId,
  expense,
  onClose,
}: {
  workerId: string;
  expense?: WorkerExpense;
  onClose: () => void;
}) {
  const { db, update } = useStore();
  const editing = Boolean(expense);
  const worker = db.workers.find((w) => w.id === workerId);
  const [form, setForm] = useState({
    date: expense?.date ?? new Date().toISOString().slice(0, 10),
    type: expense?.type ?? ("Groceries" as WorkerExpenseType),
    description: expense?.description ?? "",
    amount: expense ? String(expense.amount) : "",
    deductFromSalary: expense?.deductFromSalary ?? true,
  });

  const submit = () => {
    if (!form.amount) return;
    const payload = {
      workerId,
      date: form.date,
      type: form.type,
      description: form.description,
      amount: Number(form.amount) || 0,
      deductFromSalary: form.deductFromSalary,
    };
    if (expense) {
      update("workerExpenses", (list) => list.map((e) => (e.id === expense.id ? { ...e, ...payload } : e)));
    } else {
      update("workerExpenses", (list) => [...list, { id: newId("we"), ...payload }]);
    }
    onClose();
  };

  return (
    <Modal title={`${editing ? "Edit Expense" : "Record Expense"} — ${worker?.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as WorkerExpenseType })}>
              <option>Groceries</option>
              <option>Phone Top-up</option>
              <option>Cigarettes</option>
              <option>Cash Advance</option>
              <option>Other</option>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Amount (RM)">
          <TextInput type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={form.deductFromSalary}
            onChange={(e) => setForm({ ...form, deductFromSalary: e.target.checked })}
            className="accent-[var(--accent)]"
          />
          Deduct from monthly salary
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}
