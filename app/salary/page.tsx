"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader, Card, Table, Th, Td, StatCard, EmptyState } from "@/components/ui";
import { fmtRM, fmtRM0, computePayroll, currentMonthKey, monthLabel } from "@/lib/utils";
import DateRangeFilter, { DateRange, monthRange, rangeLabel } from "@/components/DateRangeFilter";

/** Every "YYYY-MM" from `from` to `to`, oldest first (capped, so an open-ended range can't run away). */
function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ey, em] = to.split("-").map(Number);
  while ((y < ey || (y === ey && m <= em)) && out.length < 60) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export default function SalaryPage() {
  const { db } = useStore();
  const [range, setRange] = useState<DateRange>(() =>
    monthRange(
      [...db.harvests.map((h) => h.date.slice(0, 7))].sort().pop() ?? currentMonthKey()
    )
  );

  // Salary is worked out calendar month by month, so the period covers every month it touches.
  const earliest = [...db.harvests.map((h) => h.date), ...db.workerExpenses.map((e) => e.date)].sort()[0]?.slice(0, 7) ?? currentMonthKey();
  const fromKey = range.from ? range.from.slice(0, 7) : earliest;
  const toKey = range.to ? range.to.slice(0, 7) : currentMonthKey();
  const months = fromKey <= toKey ? monthsBetween(fromKey, toKey) : [];
  const label = rangeLabel(range);

  const perMonth = months.map((m) => {
    const rows = computePayroll(db, m);
    return {
      month: m,
      base: rows.reduce((s, p) => s + p.baseSalary, 0),
      commission: rows.reduce((s, p) => s + p.commissionTotal, 0),
      deductions: rows.reduce((s, p) => s + p.deductionTotal, 0),
      net: rows.reduce((s, p) => s + p.netPay, 0),
      rows,
    };
  });

  // one line per worker, added up across the period
  const byWorker = db.workers
    .map((w) => {
      const mine = perMonth.flatMap((pm) => pm.rows.filter((r) => r.workerId === w.id));
      return {
        worker: w,
        base: mine.reduce((s, r) => s + r.baseSalary, 0),
        commission: mine.reduce((s, r) => s + r.commissionTotal, 0),
        deductions: mine.reduce((s, r) => s + r.deductionTotal, 0),
        net: mine.reduce((s, r) => s + r.netPay, 0),
        months: mine.length,
      };
    })
    .filter((w) => w.months > 0);

  const totalBase = byWorker.reduce((s, w) => s + w.base, 0);
  const totalCommission = byWorker.reduce((s, w) => s + w.commission, 0);
  const totalDeductions = byWorker.reduce((s, w) => s + w.deductions, 0);
  const totalNet = byWorker.reduce((s, w) => s + w.net, 0);

  return (
    <div>
      <PageHeader
        title="Salary"
        subtitle="Salary expense for financial reporting — a read-only view of Payroll totals. Manage rates and payslips under People → Payroll."
        actions={<DateRangeFilter value={range} onChange={setRange} monthly />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Base salary" value={fmtRM0(totalBase)} sub={`${months.length} month(s)`} />
        <StatCard label="Harvest commission" value={fmtRM0(totalCommission)} />
        <StatCard label={`Total salary expense — ${label}`} value={fmtRM0(totalNet + totalDeductions)} sub="Before worker-expense deductions" />
      </div>

      <Card title={`Salary expense by worker — ${label}`} className="mb-6">
        {byWorker.length === 0 ? (
          <EmptyState message="No salary in this period." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Worker</Th>
                <Th right>Months</Th>
                <Th right>Base salary</Th>
                <Th right>Commission</Th>
                <Th right>Deductions</Th>
                <Th right>Net pay</Th>
              </tr>
            </thead>
            <tbody>
              {byWorker.map((w) => (
                <tr key={w.worker.id}>
                  <Td className="font-medium">{w.worker.name}</Td>
                  <Td right>{w.months}</Td>
                  <Td right>{fmtRM(w.base)}</Td>
                  <Td right>{fmtRM(w.commission)}</Td>
                  <Td right className={w.deductions > 0 ? "text-warning" : ""}>
                    {w.deductions > 0 ? `− ${fmtRM(w.deductions)}` : "—"}
                  </Td>
                  <Td right className="font-semibold">{fmtRM(w.net)}</Td>
                </tr>
              ))}
              <tr>
                <Td className="font-semibold">Total</Td>
                <Td />
                <Td right className="font-semibold">{fmtRM(totalBase)}</Td>
                <Td right className="font-semibold">{fmtRM(totalCommission)}</Td>
                <Td right className="font-semibold">− {fmtRM(totalDeductions)}</Td>
                <Td right className="font-semibold">{fmtRM(totalNet)}</Td>
              </tr>
            </tbody>
          </Table>
        )}
      </Card>

      {months.length > 1 && (
        <Card title="Month by month">
          <Table>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th right>Base salary</Th>
                <Th right>Commission</Th>
                <Th right>Deductions</Th>
                <Th right>Net pay</Th>
              </tr>
            </thead>
            <tbody>
              {[...perMonth].reverse().map((pm) => (
                <tr key={pm.month}>
                  <Td className="font-medium">{monthLabel(pm.month)}</Td>
                  <Td right>{fmtRM(pm.base)}</Td>
                  <Td right>{fmtRM(pm.commission)}</Td>
                  <Td right className={pm.deductions > 0 ? "text-warning" : ""}>
                    {pm.deductions > 0 ? `− ${fmtRM(pm.deductions)}` : "—"}
                  </Td>
                  <Td right className="font-semibold">{fmtRM(pm.net)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-muted">Salary is calculated per calendar month, so every month the period touches is counted in full.</p>
        </Card>
      )}
    </div>
  );
}
