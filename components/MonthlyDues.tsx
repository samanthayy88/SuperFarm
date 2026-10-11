"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, Badge, Button, Table, Th, Td, MonthSelect, EmptyState } from "@/components/ui";
import { fmtRM, fmtRM0, currentMonthKey, monthLabel, lastNMonthKeys, loanMonthWithinTenure, unpaidLoanMonths, unpaidRentMonths } from "@/lib/utils";

interface Due {
  key: string;
  kind: "loan" | "rent";
  id: string;
  who: string;
  detail: string;
  amount: number;
  paid: boolean;
  /** earlier months this year still not ticked as paid */
  missed: string[];
}

/**
 * Monthly reminder on the Payment page: the loan installments (Borrowings) and
 * rent (Rental Contracts) that fall due in a month, so they are not forgotten
 * when the month's bills are recorded. Ticking one off writes to the same
 * `paidMonths` the Borrowings / Rental Contracts pages use, so there is one
 * record of what was paid and the expense totals pick it up from there.
 */
export default function MonthlyDues() {
  const { db, update } = useStore();
  const cur = currentMonthKey();
  const [month, setMonth] = useState(cur);

  // next month (to get ahead of it) back through the last year
  const nextMonth = (() => {
    const [y, m] = cur.split("-").map(Number);
    return new Date(y, m, 1);
  })();
  const monthOptions = lastNMonthKeys(14, nextMonth)
    .reverse()
    .map((m) => ({ value: m, label: m === cur ? `${monthLabel(m)} (this month)` : monthLabel(m) }));

  const loanDues: Due[] = db.loans
    .filter((l) => l.monthlyInstallment > 0 && loanMonthWithinTenure(l, month))
    .map((l) => ({
      key: `loan-${l.id}`,
      kind: "loan",
      id: l.id,
      who: l.lender,
      detail: `Loan repayment · ${l.lenderType}`,
      amount: l.monthlyInstallment,
      paid: l.paidMonths.includes(month),
      missed: unpaidLoanMonths(l).filter((m) => m < month),
    }));

  // if a renewal overlaps, the newest term on a farm is the one that applies
  const rentDues: Due[] = db.farms.flatMap((f) => {
    const c = db.contracts
      .filter((x) => x.farmId === f.id && month >= x.startDate.slice(0, 7) && month <= x.endDate.slice(0, 7))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    if (!c) return [];
    return [
      {
        key: `rent-${c.id}`,
        kind: "rent" as const,
        id: c.id,
        who: `${c.landlord}`,
        detail: `Rent · ${f.name}`,
        amount: c.monthlyRent,
        paid: c.paidMonths.includes(month),
        missed: unpaidRentMonths(c).filter((m) => m < month),
      },
    ];
  });

  const dues = [...loanDues, ...rentDues];
  const total = dues.reduce((s, d) => s + d.amount, 0);
  const paidTotal = dues.filter((d) => d.paid).reduce((s, d) => s + d.amount, 0);
  const unpaid = dues.filter((d) => !d.paid);
  const earlier = dues.filter((d) => d.missed.length > 0);

  const toggle = (d: Due) => {
    if (d.kind === "loan") {
      update("loans", (list) =>
        list.map((l) =>
          l.id === d.id
            ? { ...l, paidMonths: l.paidMonths.includes(month) ? l.paidMonths.filter((x) => x !== month) : [...l.paidMonths, month] }
            : l
        )
      );
    } else {
      update("contracts", (list) =>
        list.map((c) =>
          c.id === d.id
            ? { ...c, paidMonths: c.paidMonths.includes(month) ? c.paidMonths.filter((x) => x !== month) : [...c.paidMonths, month] }
            : c
        )
      );
    }
  };

  const statusOf = (d: Due) => {
    if (d.paid) return <Badge tone="good">Paid</Badge>;
    if (month < cur) return <Badge tone="critical">Missed</Badge>;
    if (month === cur) return <Badge tone="warning">Due this month</Badge>;
    return <Badge>Coming up</Badge>;
  };

  const headline =
    dues.length === 0
      ? "Nothing falls due this month."
      : unpaid.length === 0
        ? `All ${dues.length} monthly payment${dues.length === 1 ? "" : "s"} for ${monthLabel(month)} are paid.`
        : `${unpaid.length} of ${dues.length} monthly payment${dues.length === 1 ? " is" : "s are"} still to be paid for ${monthLabel(month)} — ${fmtRM0(
            total - paidTotal
          )}.`;

  return (
    <Card
      title={`Monthly reminder — ${monthLabel(month)}`}
      className="mb-6"
      actions={<MonthSelect value={month} onChange={setMonth} options={monthOptions} />}
    >
      <div
        className={`mb-4 rounded-card border px-4 py-3 text-sm ${
          dues.length === 0
            ? "border-hairline bg-surface-2 text-ink-2"
            : unpaid.length === 0
              ? "border-good bg-good-soft text-good"
              : month < cur
                ? "border-critical bg-critical-soft text-critical"
                : "border-warning bg-warning-soft text-warning"
        }`}
      >
        <p className="font-medium">{headline}</p>
        <p className="mt-0.5 text-xs opacity-90">
          Remember to include the loan repayments from{" "}
          <Link href="/loans" className="underline">Borrowings</Link> and the rent from{" "}
          <Link href="/contracts" className="underline">Rental Contracts</Link>{" "}
          when you do this month&apos;s payments. Tick them off here once paid — it updates both pages.
        </p>
      </div>

      {dues.length === 0 ? (
        <EmptyState message="No loan installments or rent fall due in this month." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Pay to</Th>
              <Th>For</Th>
              <Th>Status</Th>
              <Th right>Amount</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {dues.map((d) => (
              <tr key={d.key}>
                <Td className="font-medium text-ink">{d.who}</Td>
                <Td className="text-muted">{d.detail}</Td>
                <Td>{statusOf(d)}</Td>
                <Td right className="font-medium">{fmtRM(d.amount)}</Td>
                <Td>
                  <Button small variant={d.paid ? "ghost" : "primary"} onClick={() => toggle(d)}>
                    {d.paid ? "Undo" : "Mark paid"}
                  </Button>
                </Td>
              </tr>
            ))}
            <tr>
              <Td className="font-semibold">Total</Td>
              <Td />
              <Td className="text-muted">{fmtRM(paidTotal)} paid</Td>
              <Td right className="font-semibold">{fmtRM(total)}</Td>
              <Td />
            </tr>
          </tbody>
        </Table>
      )}

      {earlier.length > 0 && (
        <div className="mt-4 rounded-card border border-critical bg-critical-soft px-4 py-3 text-sm text-critical">
          <p className="font-medium">Earlier months not marked as paid</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {earlier.map((d) => (
              <li key={d.key}>
                {d.who} ({d.kind === "loan" ? "loan" : "rent"}) — {d.missed.map(monthLabel).join(", ")} · {fmtRM0(d.missed.length * d.amount)}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs opacity-90">
            Pick the month above to mark them, or fix them on{" "}
            <Link href="/loans" className="underline">Borrowings</Link> / <Link href="/contracts" className="underline">Rental Contracts</Link>.
          </p>
        </div>
      )}
    </Card>
  );
}
