"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageHeader, Card, StatCard, Badge, Table, Th, Td, EmptyState, MonthSelect } from "@/components/ui";
import BarChart from "@/components/BarChart";
import {
  fmtRM,
  fmtRM0,
  fmtDate,
  saleTotal,
  saleOverdueDays,
  contractStatus,
  isRenewed,
  unpaidRentMonths,
  unpaidLoanMonths,
  currentMonthKey,
  lastNMonthKeys,
  monthLabel,
  TODAY,
  daysBetween,
} from "@/lib/utils";

interface Alert {
  tone: "critical" | "warning" | "serious";
  text: string;
  href: string;
  tag: string;
}

export default function Overview() {
  const { db } = useStore();
  const curMonth = currentMonthKey();
  const months = lastNMonthKeys(12).reverse();
  const [month, setMonth] = useState(curMonth);
  const [asOfYear, asOfMon] = month.split("-").map(Number);
  const asOfDate = new Date(asOfYear, asOfMon - 1, 1);

  // ---- KPIs ----
  const monthSales = db.sales.filter((s) => s.date.startsWith(month));
  const monthRevenue = monthSales.reduce((sum, s) => sum + saleTotal(s), 0);
  const pendingSales = db.sales.filter((s) => s.paymentStatus === "Pending");
  const receivables = pendingSales.reduce((sum, s) => sum + saleTotal(s), 0);
  const monthlyCommitments =
    db.contracts.filter((c) => contractStatus(c) !== "Expired").reduce((s, c) => s + c.monthlyRent, 0) +
    db.loans.reduce((s, l) => s + l.monthlyInstallment, 0);
  const activeWorkers = db.workers.filter((w) => w.active).length;

  // ---- Alerts ----
  const alerts: Alert[] = [];
  for (const c of db.contracts) {
    const farm = db.farms.find((f) => f.id === c.farmId)?.name ?? "?";
    const st = contractStatus(c);
    if (isRenewed(c, db.contracts)) {
      // already renewed: no expiry reminder, but any rent still owed from that term stays flagged
    } else if (st === "Expired")
      alerts.push({ tone: "critical", tag: "Contract", text: `${farm}: rental contract EXPIRED on ${fmtDate(c.endDate)} — renew with ${c.landlord}`, href: "/contracts" });
    else if (st === "Expiring Soon")
      alerts.push({ tone: "warning", tag: "Contract", text: `${farm}: contract expires ${fmtDate(c.endDate)} (${daysBetween(TODAY, new Date(c.endDate))} days left)`, href: "/contracts" });
    const missed = unpaidRentMonths(c).filter((m) => m < curMonth);
    if (missed.length > 0)
      alerts.push({ tone: "critical", tag: "Rent", text: `${farm}: rent unpaid for ${missed.map(monthLabel).join(", ")} (${fmtRM0(missed.length * c.monthlyRent)})`, href: "/contracts" });
  }
  for (const l of db.loans) {
    const missed = unpaidLoanMonths(l).filter((m) => m < curMonth);
    if (missed.length > 0)
      alerts.push({ tone: "critical", tag: "Loan", text: `${l.lender}: installment missed for ${missed.map(monthLabel).join(", ")}`, href: "/loans" });
    if (unpaidLoanMonths(l).includes(curMonth))
      alerts.push({ tone: "warning", tag: "Loan", text: `${l.lender}: ${fmtRM0(l.monthlyInstallment)} installment due this month`, href: "/loans" });
  }
  for (const s of pendingSales) {
    const col = db.collectors.find((c) => c.id === s.collectorId);
    const overdue = col ? saleOverdueDays(s, col.paymentTermDays) : 0;
    if (overdue > 0)
      alerts.push({ tone: "serious", tag: "Payment", text: `${col?.name}: ${fmtRM0(saleTotal(s))} for ${fmtDate(s.date)} sale is ${overdue} day(s) overdue`, href: "/sales" });
  }
  for (const i of db.items.filter((i) => i.trackInventory && i.stock <= i.minStock)) {
    alerts.push({
      tone: i.stock === 0 ? "critical" : "warning",
      tag: "Stock",
      text: `${i.name}: ${i.stock === 0 ? "OUT OF STOCK" : `low stock (${i.stock} ${i.unit} left, min ${i.minStock})`}`,
      href: "/inventory",
    });
  }
  const toClaim = db.purchases.filter((p) => p.paidBy === "Own Pocket" && p.claimStatus === "To Claim");
  if (toClaim.length > 0) {
    const total = toClaim.reduce((s, p) => s + p.lines.reduce((a, ln) => a + ln.quantity * ln.unitPrice, 0), 0);
    alerts.push({ tone: "warning", tag: "Claim", text: `${toClaim.length} purchase(s) paid from own pocket not yet claimed (${fmtRM0(total)})`, href: "/inventory" });
  }
  for (const p of db.projects.filter((p) => p.status === "Delayed")) {
    const farm = db.farms.find((f) => f.id === p.farmId)?.name ?? "?";
    alerts.push({ tone: "serious", tag: "Project", text: `${p.jobType} at ${farm} by ${p.contractor} is delayed (expected ${fmtDate(p.expectedEndDate)})`, href: "/projects" });
  }
  const toneRank = { critical: 0, serious: 1, warning: 2 };
  alerts.sort((a, b) => toneRank[a.tone] - toneRank[b.tone]);

  // ---- Sales chart (6 months ending at the selected month) ----
  const chartMonths = lastNMonthKeys(6, asOfDate);
  const chartData = chartMonths.map((m) => {
    const salesInMonth = db.sales.filter((s) => s.date.startsWith(m));
    return {
      label: monthLabel(m).split(" ")[0],
      value: salesInMonth.reduce((sum, s) => sum + saleTotal(s), 0),
      detail: `${salesInMonth.length} sale(s)`,
    };
  });

  // ---- Today's tasks ----
  const todayISO = TODAY.toISOString().slice(0, 10);
  const todayTasks = db.tasks.filter((t) => t.date === todayISO);

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={`${TODAY.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${db.farms.length} farms · ${db.plots.length} plots`}
        actions={<MonthSelect value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Sales — ${monthLabel(month)}`} value={fmtRM0(monthRevenue)} sub={`${monthSales.length} sales recorded`} />
        <StatCard
          label="Outstanding from collectors"
          value={fmtRM0(receivables)}
          sub={`${pendingSales.length} pending payment(s)`}
          tone={receivables > 0 ? "warning" : "good"}
        />
        <StatCard label="Monthly rent + loan commitments" value={fmtRM0(monthlyCommitments)} sub="Rentals + loan installments" />
        <StatCard label="Active workers" value={String(activeWorkers)} sub={`across ${db.farms.length} farms`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={`Action needed (${alerts.length})`}>
          {alerts.length === 0 ? (
            <EmptyState message="Nothing needs attention. All clear." />
          ) : (
            <ul className="max-h-105 space-y-2 overflow-y-auto pr-1">
              {alerts.map((a, i) => (
                <li key={i}>
                  <Link
                    href={a.href}
                    className="flex items-start gap-3 rounded border border-hairline bg-surface-2 px-3 py-2.5 text-sm transition-colors hover:border-accent/50"
                  >
                    <Badge tone={a.tone}>{a.tag}</Badge>
                    <span className="text-ink-2">{a.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card title={`Sales revenue — 6 months ending ${monthLabel(month)}`}>
            <BarChart data={chartData} formatValue={(v) => fmtRM0(v)} />
          </Card>

          <Card title="Today's schedule" actions={<Link href="/schedule" className="text-xs text-accent hover:underline">Full schedule →</Link>}>
            {todayTasks.length === 0 ? (
              <EmptyState message="No tasks scheduled today." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Worker</Th>
                    <Th>Farm / Plot</Th>
                    <Th>Task</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {todayTasks.map((t) => {
                    const worker = db.workers.find((w) => w.id === t.workerId)?.name ?? "—";
                    const farm = db.farms.find((f) => f.id === t.farmId)?.name ?? "—";
                    const plot = db.plots.find((p) => p.id === t.plotId)?.name;
                    return (
                      <tr key={t.id}>
                        <Td>{worker}</Td>
                        <Td>
                          {farm}
                          {plot ? ` · ${plot}` : ""}
                        </Td>
                        <Td>{t.task}</Td>
                        <Td>
                          <Badge tone={t.status === "Done" ? "good" : t.status === "In Progress" ? "accent" : "neutral"}>
                            {t.status}
                          </Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Pending collector payments" actions={<Link href="/sales" className="text-xs text-accent hover:underline">All sales →</Link>}>
          {pendingSales.length === 0 ? (
            <EmptyState message="No pending payments." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Sale date</Th>
                  <Th>Collector</Th>
                  <Th>Crop</Th>
                  <Th right>Amount</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {pendingSales.map((s) => {
                  const col = db.collectors.find((c) => c.id === s.collectorId);
                  const crop = db.crops.find((c) => c.id === s.cropId)?.name ?? "—";
                  const overdue = col ? saleOverdueDays(s, col.paymentTermDays) : 0;
                  return (
                    <tr key={s.id}>
                      <Td>{fmtDate(s.date)}</Td>
                      <Td>{col?.name ?? "—"}</Td>
                      <Td>{crop}</Td>
                      <Td right>{fmtRM(saleTotal(s))}</Td>
                      <Td>
                        {overdue > 0 ? (
                          <Badge tone="critical">{overdue}d overdue</Badge>
                        ) : (
                          <Badge tone="warning">Waiting</Badge>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="Farms at a glance" actions={<Link href="/farms" className="text-xs text-accent hover:underline">Manage farms →</Link>}>
          <Table>
            <thead>
              <tr>
                <Th>Farm</Th>
                <Th>Location</Th>
                <Th right>Size</Th>
                <Th right>Plots</Th>
                <Th right>Workers</Th>
              </tr>
            </thead>
            <tbody>
              {db.farms.map((f) => {
                const plots = db.plots.filter((p) => p.farmId === f.id);
                const workers = new Set(plots.map((p) => p.workerId)).size;
                return (
                  <tr key={f.id}>
                    <Td className="font-medium">{f.name}</Td>
                    <Td>{f.location}</Td>
                    <Td right>{f.sizeAcres} ac</Td>
                    <Td right>{plots.length}</Td>
                    <Td right>{workers}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
