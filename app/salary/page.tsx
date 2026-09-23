"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader, Card, Table, Th, Td, StatCard, EmptyState } from "@/components/ui";
import { fmtRM, fmtRM0, computePayroll, currentMonthKey, monthLabel, lastNMonthKeys } from "@/lib/utils";

export default function SalaryPage() {
  const { db } = useStore();
  const months = lastNMonthKeys(6).reverse();
  const [month, setMonth] = useState(
    () => months.find((m) => db.harvests.some((h) => h.date.startsWith(m))) ?? currentMonthKey()
  );

  const payroll = computePayroll(db, month);
  const totalBase = payroll.reduce((s, p) => s + p.baseSalary, 0);
  const totalCommission = payroll.reduce((s, p) => s + p.commissionTotal, 0);
  const totalNet = payroll.reduce((s, p) => s + p.netPay, 0);

  return (
    <div>
      <PageHeader
        title="Salary"
        subtitle="Salary expense for financial reporting — a read-only view of Payroll totals. Manage rates and payslips under People → Payroll."
        actions={
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink"
          >
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Base salary" value={fmtRM0(totalBase)} />
        <StatCard label="Harvest commission" value={fmtRM0(totalCommission)} />
        <StatCard label={`Total salary expense — ${monthLabel(month)}`} value={fmtRM0(totalNet + payroll.reduce((s, p) => s + p.deductionTotal, 0))} sub="Before worker-expense deductions" />
      </div>

      <Card title={`Salary expense by worker — ${monthLabel(month)}`}>
        {payroll.length === 0 ? (
          <EmptyState message="No active workers." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Worker</Th>
                <Th right>Base salary</Th>
                <Th right>Commission</Th>
                <Th right>Deductions</Th>
                <Th right>Net pay</Th>
              </tr>
            </thead>
            <tbody>
              {payroll.map((p) => {
                const w = db.workers.find((x) => x.id === p.workerId)!;
                return (
                  <tr key={p.workerId}>
                    <Td className="font-medium">{w.name}</Td>
                    <Td right>{fmtRM(p.baseSalary)}</Td>
                    <Td right>{fmtRM(p.commissionTotal)}</Td>
                    <Td right className={p.deductionTotal > 0 ? "text-warning" : ""}>
                      {p.deductionTotal > 0 ? `− ${fmtRM(p.deductionTotal)}` : "—"}
                    </Td>
                    <Td right className="font-semibold">{fmtRM(p.netPay)}</Td>
                  </tr>
                );
              })}
              <tr>
                <Td className="font-semibold">Total</Td>
                <Td right className="font-semibold">{fmtRM(totalBase)}</Td>
                <Td right className="font-semibold">{fmtRM(totalCommission)}</Td>
                <Td right className="font-semibold">− {fmtRM(payroll.reduce((s, p) => s + p.deductionTotal, 0))}</Td>
                <Td right className="font-semibold">{fmtRM(totalNet)}</Td>
              </tr>
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
