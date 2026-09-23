"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader, Card, Table, Th, Td, Button, Modal, StatCard, Tabs, EmptyState } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, computePayroll, lastNMonthKeys, monthLabel, PayrollLine } from "@/lib/utils";

export default function PayrollPage() {
  const { db, update } = useStore();
  const months = lastNMonthKeys(6).reverse();
  // default to the newest month that actually has harvest data, so payroll isn't blank on the 1st
  const [month, setMonth] = useState(
    () => months.find((m) => db.harvests.some((h) => h.date.startsWith(m))) ?? months[0]
  );
  const [tab, setTab] = useState("Payroll");
  const [payslipWorker, setPayslipWorker] = useState<string | null>(null);

  const payroll = computePayroll(db, month);
  const totalNet = payroll.reduce((s, p) => s + p.netPay, 0);
  const totalCommission = payroll.reduce((s, p) => s + p.commissionTotal, 0);
  const totalDeductions = payroll.reduce((s, p) => s + p.deductionTotal, 0);
  const totalKg = db.harvests.filter((h) => h.date.startsWith(month)).reduce((s, h) => s + h.quantityKg, 0);

  return (
    <div>
      <PageHeader
        title="Payroll & Commission"
        subtitle="Commission auto-calculated from Harvest Record × crop rate, minus worker expenses"
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
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Total payout — ${monthLabel(month)}`} value={fmtRM0(totalNet)} />
        <StatCard label="Commission earned" value={fmtRM0(totalCommission)} sub={`${totalKg.toLocaleString()} kg harvested`} />
        <StatCard label="Deductions" value={fmtRM0(totalDeductions)} sub="Groceries, advances, top-ups" tone={totalDeductions > 0 ? "warning" : undefined} />
        <StatCard label="Commission rates" value={`${db.crops.length} crops`} sub={db.crops.map((c) => `${c.name} RM${c.commissionRatePerKg}/kg`).join(" · ")} />
      </div>

      <Tabs tabs={["Payroll", "Commission Rates"]} active={tab} onChange={setTab} />

      {tab === "Payroll" && (
        <Card title={`Payroll — ${monthLabel(month)}`}>
          {payroll.length === 0 ? (
            <EmptyState message="No active workers." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Worker</Th>
                  <Th right>Base salary</Th>
                  <Th>Harvest & commission</Th>
                  <Th right>Commission</Th>
                  <Th right>Deductions</Th>
                  <Th right>Net pay</Th>
                  <Th>Payslip</Th>
                </tr>
              </thead>
              <tbody>
                {payroll.map((p) => {
                  const w = db.workers.find((x) => x.id === p.workerId)!;
                  return (
                    <tr key={p.workerId}>
                      <Td className="font-medium">{w.name}</Td>
                      <Td right>{fmtRM(p.baseSalary)}</Td>
                      <Td>
                        {p.commissionByCrop.length === 0 ? (
                          <span className="text-muted">No harvest this month</span>
                        ) : (
                          p.commissionByCrop.map((c) => {
                            const crop = db.crops.find((x) => x.id === c.cropId);
                            return (
                              <p key={c.cropId} className="text-xs text-ink-2">
                                {crop?.name}: {c.kg.toLocaleString()} kg × RM {c.rate.toFixed(2)} = {fmtRM(c.amount)}
                              </p>
                            );
                          })
                        )}
                      </Td>
                      <Td right>{fmtRM(p.commissionTotal)}</Td>
                      <Td right className={p.deductionTotal > 0 ? "text-warning" : ""}>
                        {p.deductionTotal > 0 ? `− ${fmtRM(p.deductionTotal)}` : "—"}
                      </Td>
                      <Td right className="font-semibold">{fmtRM(p.netPay)}</Td>
                      <Td>
                        <Button small variant="ghost" onClick={() => setPayslipWorker(p.workerId)}>View</Button>
                      </Td>
                    </tr>
                  );
                })}
                <tr>
                  <Td className="font-semibold">Total</Td>
                  <Td right className="font-semibold">{fmtRM(payroll.reduce((s, p) => s + p.baseSalary, 0))}</Td>
                  <Td />
                  <Td right className="font-semibold">{fmtRM(totalCommission)}</Td>
                  <Td right className="font-semibold">− {fmtRM(totalDeductions)}</Td>
                  <Td right className="font-semibold">{fmtRM(totalNet)}</Td>
                  <Td />
                </tr>
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "Commission Rates" && (
        <Card title="Commission rate per crop (RM per kg harvested)">
          <Table>
            <thead>
              <tr>
                <Th>Crop</Th>
                <Th right>Commission rate / kg</Th>
                <Th right>Plots planted</Th>
                <Th>Adjust</Th>
              </tr>
            </thead>
            <tbody>
              {db.crops.map((c) => (
                <tr key={c.id}>
                  <Td className="font-medium">{c.name}</Td>
                  <Td right>RM {c.commissionRatePerKg.toFixed(2)}</Td>
                  <Td right>{db.plots.filter((p) => p.cropId === c.id).length}</Td>
                  <Td>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={c.commissionRatePerKg}
                      onBlur={(e) =>
                        update("crops", (list) =>
                          list.map((x) => (x.id === c.id ? { ...x, commissionRatePerKg: Number(e.target.value) || 0 } : x))
                        )
                      }
                      className="w-24 rounded border border-hairline bg-surface-2 px-2 py-1 text-sm tnum"
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {payslipWorker && (
        <PayslipModal
          line={payroll.find((p) => p.workerId === payslipWorker)!}
          month={month}
          onClose={() => setPayslipWorker(null)}
        />
      )}
    </div>
  );
}

function PayslipModal({ line, month, onClose }: { line: PayrollLine; month: string; onClose: () => void }) {
  const { db } = useStore();
  const w = db.workers.find((x) => x.id === line.workerId)!;
  const farm = db.farms.find((f) => f.id === w.farmId)?.name ?? "—";

  return (
    <Modal title={`Payslip — ${w.name}, ${monthLabel(month)}`} onClose={onClose} wide>
      <div className="print-area" id="payslip">
        <div className="rounded border border-hairline p-5">
          <div className="mb-5 flex items-start justify-between border-b border-hairline pb-4">
            <div>
              <p className="text-base font-semibold">PAYSLIP</p>
              <p className="text-xs text-muted">Pay period: {monthLabel(month)}</p>
            </div>
            <div className="text-right text-xs text-muted">
              <p>Issued: {fmtDate(new Date().toISOString().slice(0, 10))}</p>
              <p>Farm: {farm}</p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <p><span className="text-muted">Worker:</span> {w.name}</p>
            <p><span className="text-muted">ID/Passport:</span> {w.idNumber}</p>
            <p><span className="text-muted">Join date:</span> {fmtDate(w.joinDate)}</p>
            <p><span className="text-muted">Phone:</span> {w.phone}</p>
          </div>

          <table className="mb-4 w-full text-sm">
            <thead>
              <tr>
                <th className="border-b border-hairline py-2 text-left text-xs uppercase tracking-wide text-muted">Earnings</th>
                <th className="border-b border-hairline py-2 text-right text-xs uppercase tracking-wide text-muted">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b border-grid py-2">Base salary</td>
                <td className="border-b border-grid py-2 text-right tnum">{fmtRM(line.baseSalary)}</td>
              </tr>
              {line.commissionByCrop.map((c) => {
                const crop = db.crops.find((x) => x.id === c.cropId);
                return (
                  <tr key={c.cropId}>
                    <td className="border-b border-grid py-2">
                      Harvest commission — {crop?.name}
                      <span className="ml-1 text-xs text-muted">({c.kg.toLocaleString()} kg × RM {c.rate.toFixed(2)}/kg)</span>
                    </td>
                    <td className="border-b border-grid py-2 text-right tnum">{fmtRM(c.amount)}</td>
                  </tr>
                );
              })}
              <tr>
                <td className="py-2 font-medium">Gross pay</td>
                <td className="py-2 text-right font-medium tnum">{fmtRM(line.baseSalary + line.commissionTotal)}</td>
              </tr>
            </tbody>
          </table>

          <table className="mb-4 w-full text-sm">
            <thead>
              <tr>
                <th className="border-b border-hairline py-2 text-left text-xs uppercase tracking-wide text-muted">Deductions</th>
                <th className="border-b border-hairline py-2 text-right text-xs uppercase tracking-wide text-muted">Amount</th>
              </tr>
            </thead>
            <tbody>
              {line.deductions.length === 0 ? (
                <tr>
                  <td className="border-b border-grid py-2 text-muted" colSpan={2}>No deductions</td>
                </tr>
              ) : (
                line.deductions.map((d) => (
                  <tr key={d.id}>
                    <td className="border-b border-grid py-2">
                      {d.type} — {d.description}
                      <span className="ml-1 text-xs text-muted">({fmtDate(d.date)})</span>
                    </td>
                    <td className="border-b border-grid py-2 text-right tnum">− {fmtRM(d.amount)}</td>
                  </tr>
                ))
              )}
              <tr>
                <td className="py-2 font-medium">Total deductions</td>
                <td className="py-2 text-right font-medium tnum">− {fmtRM(line.deductionTotal)}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-hairline pt-4">
            <p className="text-sm font-semibold uppercase tracking-wide">Net pay</p>
            <p className="text-2xl font-semibold tnum">{fmtRM(line.netPay)}</p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-muted">
            <div className="border-t border-hairline pt-2">Employer signature</div>
            <div className="border-t border-hairline pt-2">Worker signature / thumbprint</div>
          </div>
        </div>
      </div>

      <div className="no-print mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button onClick={() => window.print()}>Print / Save PDF</Button>
      </div>
    </Modal>
  );
}
