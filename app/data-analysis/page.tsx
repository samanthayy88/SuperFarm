"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader, Card, Table, Th, Td, StatCard, Tabs, EmptyState, Badge } from "@/components/ui";
import {
  fmtRM,
  fmtRM0,
  monthKey,
  monthLabel,
  lastNMonthKeys,
  currentMonthKey,
  saleTotal,
  purchaseTotal,
  applicationCost,
  computePayroll,
  averageCycleDaysByCrop,
  TODAY,
} from "@/lib/utils";
import BarChart from "@/components/BarChart";
import GroupedBarChart from "@/components/GroupedBarChart";

export default function DataAnalysisPage() {
  const [tab, setTab] = useState("Farm Analysis");

  return (
    <div>
      <PageHeader
        title="Data & Analysis"
        subtitle="Cross-farm, financial, worker and application-cost analytics, rolled up from every record in the dashboard"
      />
      <Tabs tabs={["Farm Analysis", "Financial Analysis", "Worker Analysis", "Application Analysis"]} active={tab} onChange={setTab} />
      {tab === "Farm Analysis" && <FarmAnalysis />}
      {tab === "Financial Analysis" && <FinancialAnalysis />}
      {tab === "Worker Analysis" && <WorkerAnalysis />}
      {tab === "Application Analysis" && <ApplicationAnalysis />}
    </div>
  );
}

/* ------------------------------- Farm Analysis ------------------------------- */

function FarmAnalysis() {
  const { db } = useStore();
  const totalAcres = db.plots.reduce((s, p) => s + p.sizeAcres, 0);
  const activePlots = db.plots.filter((p) => p.status === "Active").length;

  const cycleData = db.crops
    .map((c) => ({ label: c.name, value: averageCycleDaysByCrop(db.plots, c.id) }))
    .filter((d): d is { label: string; value: number } => d.value !== null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Farms" value={String(db.farms.length)} />
        <StatCard label="Plots" value={String(db.plots.length)} sub={`${activePlots} active`} />
        <StatCard label="Total acreage" value={`${totalAcres.toLocaleString()} acres`} />
        <StatCard label="Crops in rotation" value={String(db.crops.length)} />
      </div>

      <Card title="Plots by farm and status">
        <Table>
          <thead>
            <tr>
              <Th>Farm</Th>
              <Th right>Plots</Th>
              <Th right>Acreage</Th>
              <Th right>Active</Th>
              <Th right>Fallow</Th>
              <Th right>Preparing</Th>
              <Th>Crops grown</Th>
            </tr>
          </thead>
          <tbody>
            {db.farms.map((f) => {
              const plots = db.plots.filter((p) => p.farmId === f.id);
              const crops = [...new Set(plots.map((p) => db.crops.find((c) => c.id === p.cropId)?.name).filter(Boolean))];
              return (
                <tr key={f.id}>
                  <Td className="font-medium">{f.name}</Td>
                  <Td right>{plots.length}</Td>
                  <Td right>{plots.reduce((s, p) => s + p.sizeAcres, 0)}</Td>
                  <Td right>{plots.filter((p) => p.status === "Active").length}</Td>
                  <Td right>{plots.filter((p) => p.status === "Fallow").length}</Td>
                  <Td right>{plots.filter((p) => p.status === "Preparing").length}</Td>
                  <Td>{crops.join(", ") || "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card title="Average completed cycle length by crop (sowing/planting → fallow)">
        {cycleData.length === 0 ? (
          <EmptyState message="No completed cycles yet — figures appear once a plot reaches Fallow." />
        ) : (
          <BarChart data={cycleData} formatValue={(v) => `${v} days`} />
        )}
      </Card>
    </div>
  );
}

/* ----------------------------- Financial Analysis ----------------------------- */

function FinancialAnalysis() {
  const { db } = useStore();
  const months = lastNMonthKeys(6);
  const month = months[months.length - 1];

  const salaryForMonth = (m: string) => {
    const payroll = computePayroll(db, m);
    return payroll.reduce((s, p) => s + p.baseSalary + p.commissionTotal, 0);
  };
  const rentForMonth = (m: string) => db.contracts.filter((c) => c.paidMonths.includes(m)).reduce((s, c) => s + c.monthlyRent, 0);
  const loanForMonth = (m: string) => db.loans.filter((l) => l.paidMonths.includes(m)).reduce((s, l) => s + l.monthlyInstallment, 0);
  const purchasesForMonth = (m: string) => db.purchases.filter((p) => p.date.startsWith(m)).reduce((s, p) => s + purchaseTotal(p), 0);
  const paymentsForMonth = (m: string) => db.payments.filter((p) => p.date.startsWith(m)).reduce((s, p) => s + p.amount, 0);
  const workerExpForMonth = (m: string) => db.workerExpenses.filter((e) => e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0);
  const incomeForMonth = (m: string) => db.sales.filter((s) => s.date.startsWith(m)).reduce((s, x) => s + saleTotal(x), 0);

  const expenseForMonth = (m: string) =>
    purchasesForMonth(m) + paymentsForMonth(m) + workerExpForMonth(m) + salaryForMonth(m) + rentForMonth(m) + loanForMonth(m);

  const chartData = months.map((m) => ({ label: monthLabel(m).split(" ")[0], values: [incomeForMonth(m), expenseForMonth(m)] }));
  const totalIncome6mo = months.reduce((s, m) => s + incomeForMonth(m), 0);
  const totalExpense6mo = months.reduce((s, m) => s + expenseForMonth(m), 0);

  const breakdown = [
    { label: "Purchases", value: purchasesForMonth(month) },
    { label: "Payment", value: paymentsForMonth(month) },
    { label: "Worker Expenses", value: workerExpForMonth(month) },
    { label: "Salary", value: salaryForMonth(month) },
    { label: "Rental Contracts", value: rentForMonth(month) },
    { label: "Loan installments", value: loanForMonth(month) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Income — last 6 months" value={fmtRM0(totalIncome6mo)} />
        <StatCard label="Expenses — last 6 months" value={fmtRM0(totalExpense6mo)} />
        <StatCard
          label="Net — last 6 months"
          value={fmtRM0(totalIncome6mo - totalExpense6mo)}
          tone={totalIncome6mo - totalExpense6mo >= 0 ? "good" : "critical"}
        />
      </div>

      <Card title="Income vs expenses, last 6 months">
        <GroupedBarChart data={chartData} seriesNames={["Income", "Expenses"]} formatValue={fmtRM} />
      </Card>

      <Card title={`Expense breakdown — ${monthLabel(month)}`}>
        <Table>
          <thead>
            <tr>
              <Th>Category</Th>
              <Th right>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((b) => (
              <tr key={b.label}>
                <Td>{b.label}</Td>
                <Td right>{fmtRM(b.value)}</Td>
              </tr>
            ))}
            <tr>
              <Td className="font-semibold">Total</Td>
              <Td right className="font-semibold">{fmtRM(breakdown.reduce((s, b) => s + b.value, 0))}</Td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

/* ------------------------------- Worker Analysis ------------------------------- */

function WorkerAnalysis() {
  const { db } = useStore();
  const months = lastNMonthKeys(6).reverse();
  const [month, setMonth] = useState(
    () => months.find((m) => db.harvests.some((h) => h.date.startsWith(m))) ?? currentMonthKey()
  );
  const payroll = computePayroll(db, month);
  const totalKg = db.harvests.filter((h) => h.date.startsWith(month)).reduce((s, h) => s + h.quantityKg, 0);
  const totalCommission = payroll.reduce((s, p) => s + p.commissionTotal, 0);
  const topEarner = [...payroll].sort((a, b) => b.commissionTotal - a.commissionTotal)[0];

  const chartData = payroll.map((p) => ({
    label: db.workers.find((w) => w.id === p.workerId)?.name.replace(" (demo)", "") ?? "—",
    value: p.commissionTotal,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink"
        >
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total kg harvested" value={totalKg.toLocaleString()} />
        <StatCard label="Total commission paid" value={fmtRM0(totalCommission)} />
        <StatCard
          label="Top earner"
          value={topEarner && topEarner.commissionTotal > 0 ? db.workers.find((w) => w.id === topEarner.workerId)?.name ?? "—" : "—"}
          sub={topEarner ? fmtRM(topEarner.commissionTotal) : undefined}
        />
      </div>

      <Card title={`Commission earned by worker — ${monthLabel(month)}`}>
        {chartData.every((d) => d.value === 0) ? (
          <EmptyState message="No commission earned this month." />
        ) : (
          <BarChart data={chartData} formatValue={fmtRM} />
        )}
      </Card>

      <Card title="Worker performance detail">
        <Table>
          <thead>
            <tr>
              <Th>Worker</Th>
              <Th right>Base salary</Th>
              <Th right>Commission</Th>
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
                  <Td right className="font-semibold">{fmtRM(p.netPay)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

/* ----------------------------- Application Analysis ----------------------------- */

function ApplicationAnalysis() {
  const { db } = useStore();
  const totalCost = db.applications.reduce((s, a) => s + applicationCost(a), 0);
  const avgCost = db.applications.length ? totalCost / db.applications.length : 0;
  const thisMonth = monthKey(TODAY);
  const monthCost = db.applications.filter((a) => a.date.startsWith(thisMonth)).reduce((s, a) => s + applicationCost(a), 0);

  const targets = ["Pest", "Disease", "Weed", "Foliar Feed", "Mixed"] as const;
  const targetData = targets.map((t) => ({ label: t, value: db.applications.filter((a) => a.target === t).length }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Rounds recorded" value={String(db.applications.length)} />
        <StatCard label="Total input cost" value={fmtRM0(totalCost)} />
        <StatCard label="Average cost / round" value={fmtRM(avgCost)} />
        <StatCard label={`This month (${monthLabel(thisMonth)})`} value={fmtRM0(monthCost)} />
      </div>

      <Card title="Application rounds by target">
        {db.applications.length === 0 ? (
          <EmptyState message="No applications recorded yet." />
        ) : (
          <BarChart data={targetData} formatValue={(v) => `${v} round(s)`} />
        )}
      </Card>

      <Card title="Input cost by farm">
        <Table>
          <thead>
            <tr>
              <Th>Farm</Th>
              <Th right>Rounds</Th>
              <Th right>Total cost</Th>
              <Th>Most common target</Th>
            </tr>
          </thead>
          <tbody>
            {db.farms.map((f) => {
              const rounds = db.applications.filter((a) => a.farmId === f.id);
              const cost = rounds.reduce((s, a) => s + applicationCost(a), 0);
              const counts = new Map<string, number>();
              for (const a of rounds) counts.set(a.target, (counts.get(a.target) ?? 0) + 1);
              const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
              return (
                <tr key={f.id}>
                  <Td className="font-medium">{f.name}</Td>
                  <Td right>{rounds.length}</Td>
                  <Td right>{fmtRM(cost)}</Td>
                  <Td>{top ? <Badge tone="accent">{top[0]}</Badge> : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
