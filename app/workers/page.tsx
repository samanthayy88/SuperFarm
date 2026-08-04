"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Table, Th, Td, Button, Modal, Field, TextInput, Select, StatCard } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, currentMonthKey, monthLabel } from "@/lib/utils";
import { Worker, WorkerExpense, WorkerExpenseType } from "@/lib/types";

export default function WorkersPage() {
  const { db } = useStore();
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [expenseFormWorker, setExpenseFormWorker] = useState<string | null>(null);
  const curMonth = currentMonthKey();
  const lastMonth = (() => {
    const [y, m] = curMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const monthExpenses = db.workerExpenses.filter((e) => e.date.startsWith(lastMonth) || e.date.startsWith(curMonth));
  const totalAdvances = monthExpenses.filter((e) => e.type === "Cash Advance").reduce((s, e) => s + e.amount, 0);
  const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader
        title="Workers"
        subtitle="Worker records, monthly expenses, cash advances and salary deductions"
        actions={<Button onClick={() => setShowWorkerForm(true)}>+ Add Worker</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active workers" value={String(db.workers.filter((w) => w.active).length)} />
        <StatCard label={`Worker expenses (${monthLabel(lastMonth)}–now)`} value={fmtRM0(totalSpent)} sub="Groceries, top-ups, cigarettes, advances" />
        <StatCard label="Cash advances given" value={fmtRM0(totalAdvances)} tone={totalAdvances > 0 ? "warning" : undefined} />
      </div>

      <div className="space-y-4">
        {db.workers.map((w) => {
          const farm = db.farms.find((f) => f.id === w.farmId)?.name ?? "—";
          const plots = db.plots.filter((p) => p.workerId === w.id);
          const expenses = db.workerExpenses
            .filter((e) => e.workerId === w.id)
            .sort((a, b) => b.date.localeCompare(a.date));
          const deductible = expenses
            .filter((e) => e.deductFromSalary && e.date.startsWith(lastMonth))
            .reduce((s, e) => s + e.amount, 0);
          return (
            <Card
              key={w.id}
              title={w.name}
              actions={<Button small variant="ghost" onClick={() => setExpenseFormWorker(w.id)}>+ Record Expense / Advance</Button>}
            >
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
                <span><span className="text-muted">ID/Passport:</span> {w.idNumber}</span>
                <span><span className="text-muted">Phone:</span> {w.phone}</span>
                <span><span className="text-muted">Nationality:</span> {w.nationality}</span>
                <span><span className="text-muted">Joined:</span> {fmtDate(w.joinDate)}</span>
                <span><span className="text-muted">Base salary:</span> {fmtRM(w.baseSalary)}</span>
                <span><span className="text-muted">Farm:</span> {farm}</span>
                <span>
                  <span className="text-muted">Plots:</span>{" "}
                  {plots.length > 0
                    ? plots.map((p) => `${db.farms.find((f) => f.id === p.farmId)?.name?.split(" ")[0]} ${p.name}`).join(", ")
                    : "—"}
                </span>
                {!w.active && <Badge tone="neutral">Inactive</Badge>}
              </div>

              {deductible > 0 && (
                <p className="mb-3 text-xs text-warning">
                  {fmtRM(deductible)} to deduct from {monthLabel(lastMonth)} salary (see Payroll)
                </p>
              )}

              {expenses.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Description</Th>
                      <Th right>Amount</Th>
                      <Th>Deduct from salary?</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.slice(0, 6).map((e) => (
                      <tr key={e.id}>
                        <Td>{fmtDate(e.date)}</Td>
                        <Td>
                          <Badge tone={e.type === "Cash Advance" ? "warning" : "neutral"}>{e.type}</Badge>
                        </Td>
                        <Td>{e.description}</Td>
                        <Td right>{fmtRM(e.amount)}</Td>
                        <Td>{e.deductFromSalary ? <span className="text-good">Yes</span> : <span className="text-muted">No (employer covers)</span>}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          );
        })}
      </div>

      {showWorkerForm && <WorkerForm onClose={() => setShowWorkerForm(false)} />}
      {expenseFormWorker && <ExpenseForm workerId={expenseFormWorker} onClose={() => setExpenseFormWorker(null)} />}
    </div>
  );
}

function WorkerForm({ onClose }: { onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    name: "",
    idNumber: "",
    phone: "",
    nationality: "",
    joinDate: new Date().toISOString().slice(0, 10),
    baseSalary: "",
    farmId: db.farms[0]?.id ?? "",
  });

  const submit = () => {
    if (!form.name) return;
    const w: Worker = {
      id: newId("w"),
      name: form.name,
      idNumber: form.idNumber,
      phone: form.phone,
      nationality: form.nationality,
      joinDate: form.joinDate,
      baseSalary: Number(form.baseSalary) || 0,
      farmId: form.farmId,
      active: true,
    };
    update("workers", (list) => [...list, w]);
    onClose();
  };

  return (
    <Modal title="Add Worker" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID / Passport no.">
            <TextInput value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
          </Field>
          <Field label="Phone">
            <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Nationality">
            <TextInput value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
          </Field>
          <Field label="Join date">
            <TextInput type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Base salary (RM/month)">
          <TextInput type="number" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} />
        </Field>
        <Field label="Farm">
          <Select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })}>
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Worker</Button>
        </div>
      </div>
    </Modal>
  );
}

function ExpenseForm({ workerId, onClose }: { workerId: string; onClose: () => void }) {
  const { db, update } = useStore();
  const worker = db.workers.find((w) => w.id === workerId);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "Groceries" as WorkerExpenseType,
    description: "",
    amount: "",
    deductFromSalary: true,
  });

  const submit = () => {
    if (!form.amount) return;
    const e: WorkerExpense = {
      id: newId("we"),
      workerId,
      date: form.date,
      type: form.type,
      description: form.description,
      amount: Number(form.amount) || 0,
      deductFromSalary: form.deductFromSalary,
    };
    update("workerExpenses", (list) => [...list, e]);
    onClose();
  };

  return (
    <Modal title={`Record Expense — ${worker?.name}`} onClose={onClose}>
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
            className="accent-[#3987e5]"
          />
          Deduct from monthly salary
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
