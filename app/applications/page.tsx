"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Table, Th, Td, Button, Modal, Field, TextInput, Select, StatCard, Tabs, EmptyState, MonthSelect } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, applicationCost, currentMonthKey, monthLabel, lastNMonthKeys, TODAY } from "@/lib/utils";
import { ApplicationRecord, ApplicationProduct } from "@/lib/types";

export default function ApplicationsPage() {
  const { db } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState("Application Rounds");
  const months = lastNMonthKeys(12).reverse();
  const [month, setMonth] = useState(
    () => months.find((m) => db.applications.some((a) => a.date.startsWith(m))) ?? currentMonthKey()
  );

  const rounds = db.applications.filter((a) => a.date.startsWith(month));
  const totalCost = rounds.reduce((s, a) => s + applicationCost(a), 0);
  const avgCost = rounds.length ? totalCost / rounds.length : 0;
  const totalWater = rounds.reduce((s, a) => s + a.waterVolumeL, 0);

  return (
    <div>
      <PageHeader
        title="Agri Inputs"
        subtitle="Cost per application round — products, dose rates and water volume, per plot"
        actions={
          <>
            <MonthSelect value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
            <Button onClick={() => setShowForm(true)}>+ Record Application</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Application cost — ${monthLabel(month)}`} value={fmtRM0(totalCost)} sub={`${rounds.length} rounds recorded`} />
        <StatCard label="Average cost per round" value={fmtRM(avgCost)} />
        <StatCard label="Total water applied" value={`${totalWater.toLocaleString()} L`} />
        <StatCard
          label="Average cost per 100L"
          value={totalWater ? fmtRM((totalCost / totalWater) * 100) : "—"}
          sub="Blended across this month's rounds"
        />
      </div>

      <Tabs tabs={["Application Rounds", "By Plot", "Product Usage"]} active={tab} onChange={setTab} />

      {tab === "Application Rounds" && (
        <div className="space-y-4">
          {rounds.length === 0 ? (
            <Card><EmptyState message="No applications recorded for this month." /></Card>
          ) : (
            [...rounds].sort((a, b) => b.date.localeCompare(a.date)).map((a) => {
              const farm = db.farms.find((f) => f.id === a.farmId);
              const plot = db.plots.find((p) => p.id === a.plotId);
              const crop = db.crops.find((c) => c.id === plot?.cropId);
              const cost = applicationCost(a);
              const perAcre = plot?.sizeAcres ? cost / plot.sizeAcres : 0;
              return (
                <Card
                  key={a.id}
                  title={`${fmtDate(a.date)} — ${farm?.name} · ${plot?.name} (${crop?.name})`}
                  actions={<span className="text-sm font-semibold tnum">{fmtRM(cost)}</span>}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <Badge tone={a.target === "Pest" ? "serious" : a.target === "Disease" ? "critical" : "accent"}>
                      {a.target} control
                    </Badge>
                    <span className="text-ink-2"><span className="text-muted">Water volume:</span> {a.waterVolumeL} L</span>
                    <span className="text-ink-2"><span className="text-muted">Plot size:</span> {plot?.sizeAcres} ac</span>
                    <span className="text-ink-2"><span className="text-muted">Cost per acre:</span> {fmtRM(perAcre)}</span>
                    <span className="text-ink-2"><span className="text-muted">Cost per 100 L:</span> {fmtRM((cost / a.waterVolumeL) * 100)}</span>
                    {a.notes && <span className="text-muted italic">{a.notes}</span>}
                  </div>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Product</Th>
                        <Th right>Rate per 100 L</Th>
                        <Th right>Quantity used</Th>
                        <Th right>Unit cost</Th>
                        <Th right>Cost</Th>
                        <Th right>% of round</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.products.map((p, i) => {
                        const item = db.items.find((x) => x.id === p.itemId);
                        const lineCost = p.quantityUsed * p.unitCost;
                        return (
                          <tr key={i}>
                            <Td className="font-medium">{item?.name ?? "—"}</Td>
                            <Td right>{p.ratePer100L} {item?.unit?.includes("L") ? "L" : "kg"}</Td>
                            <Td right>{p.quantityUsed}</Td>
                            <Td right>{fmtRM(p.unitCost)}</Td>
                            <Td right>{fmtRM(lineCost)}</Td>
                            <Td right>{((lineCost / cost) * 100).toFixed(0)}%</Td>
                          </tr>
                        );
                      })}
                      <tr>
                        <Td className="font-semibold">Total for this round</Td>
                        <Td />
                        <Td />
                        <Td />
                        <Td right className="font-semibold">{fmtRM(cost)}</Td>
                        <Td right className="font-semibold">100%</Td>
                      </tr>
                    </tbody>
                  </Table>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "By Plot" && (
        <Card title={`Agri-input cost by plot — ${monthLabel(month)}`}>
          <Table>
            <thead>
              <tr>
                <Th>Farm / Plot</Th>
                <Th>Crop</Th>
                <Th right>Size</Th>
                <Th right>Rounds</Th>
                <Th right>Total cost</Th>
                <Th right>Cost per acre</Th>
                <Th right>Avg cost per round</Th>
              </tr>
            </thead>
            <tbody>
              {db.plots.map((plot) => {
                const apps = rounds.filter((a) => a.plotId === plot.id);
                if (apps.length === 0) return null;
                const cost = apps.reduce((s, a) => s + applicationCost(a), 0);
                return (
                  <tr key={plot.id}>
                    <Td className="font-medium">
                      {db.farms.find((f) => f.id === plot.farmId)?.name} · {plot.name}
                    </Td>
                    <Td>{db.crops.find((c) => c.id === plot.cropId)?.name}</Td>
                    <Td right>{plot.sizeAcres} ac</Td>
                    <Td right>{apps.length}</Td>
                    <Td right className="font-medium">{fmtRM(cost)}</Td>
                    <Td right>{fmtRM(cost / plot.sizeAcres)}</Td>
                    <Td right>{fmtRM(cost / apps.length)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "Product Usage" && (
        <Card title={`Agri-input usage — ${monthLabel(month)}`}>
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th right>Times used</Th>
                <Th right>Total quantity</Th>
                <Th right>Total cost</Th>
                <Th right>Current stock</Th>
              </tr>
            </thead>
            <tbody>
              {db.items.map((item) => {
                const uses = rounds.flatMap((a) => a.products.filter((p) => p.itemId === item.id));
                if (uses.length === 0) return null;
                const qty = uses.reduce((s, p) => s + p.quantityUsed, 0);
                const cost = uses.reduce((s, p) => s + p.quantityUsed * p.unitCost, 0);
                return (
                  <tr key={item.id}>
                    <Td className="font-medium">{item.name}</Td>
                    <Td>{item.category}</Td>
                    <Td right>{uses.length}</Td>
                    <Td right>{qty.toFixed(2)}</Td>
                    <Td right>{fmtRM(cost)}</Td>
                    <Td right className={item.stock <= item.minStock ? "text-warning" : ""}>
                      {item.stock} {item.unit}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {showForm && <ApplicationForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

interface DraftProduct extends ApplicationProduct {
  key: string;
}

function ApplicationForm({ onClose }: { onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    date: TODAY.toISOString().slice(0, 10),
    farmId: db.farms[0]?.id ?? "",
    plotId: "",
    target: "Pest" as ApplicationRecord["target"],
    waterVolumeL: "400",
    notes: "",
  });
  const [products, setProducts] = useState<DraftProduct[]>([
    { key: "1", itemId: db.items[0]?.id ?? "", ratePer100L: 0, quantityUsed: 0, unitCost: db.items[0]?.lastCostPerUnit ?? 0 },
  ]);

  const plots = db.plots.filter((p) => p.farmId === form.farmId);
  const water = Number(form.waterVolumeL) || 0;

  const setProduct = (key: string, patch: Partial<DraftProduct>) =>
    setProducts((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  /** Dose rate × water volume gives the quantity actually mixed for this round. */
  const recalcQty = (key: string, rate: number) => {
    setProduct(key, { ratePer100L: rate, quantityUsed: Number(((rate * water) / 100).toFixed(3)) });
  };

  const total = products.reduce((s, p) => s + p.quantityUsed * p.unitCost, 0);

  const submit = () => {
    const plotId = form.plotId || plots[0]?.id;
    const valid = products.filter((p) => p.itemId && p.quantityUsed > 0);
    if (!plotId || valid.length === 0) return;
    const a: ApplicationRecord = {
      id: newId("a"),
      date: form.date,
      farmId: form.farmId,
      plotId,
      target: form.target,
      waterVolumeL: water,
      products: valid.map(({ key, ...p }) => p), // eslint-disable-line @typescript-eslint/no-unused-vars
      notes: form.notes || undefined,
    };
    update("applications", (list) => [...list, a]);
    // deduct the mixed quantity from stock
    update("items", (list) =>
      list.map((item) => {
        const used = valid.filter((p) => p.itemId === item.id).reduce((s, p) => s + p.quantityUsed, 0);
        return used > 0 ? { ...item, stock: Math.max(0, Number((item.stock - used).toFixed(3))) } : item;
      })
    );
    onClose();
  };

  return (
    <Modal title="Record Application Round" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Date">
            <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Farm">
            <Select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value, plotId: "" })}>
              {db.farms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Plot">
            <Select value={form.plotId} onChange={(e) => setForm({ ...form, plotId: e.target.value })}>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({db.crops.find((c) => c.id === p.cropId)?.name})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target">
            <Select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value as ApplicationRecord["target"] })}>
              <option>Pest</option>
              <option>Disease</option>
              <option>Weed</option>
              <option>Foliar Feed</option>
              <option>Mixed</option>
            </Select>
          </Field>
        </div>

        <Field label="Water volume for this round (L) — smaller crops need less water, so cost is lower">
          <TextInput
            type="number"
            value={form.waterVolumeL}
            onChange={(e) => {
              const v = e.target.value;
              const w = Number(v) || 0;
              setForm({ ...form, waterVolumeL: v });
              setProducts((ps) => ps.map((p) => ({ ...p, quantityUsed: Number(((p.ratePer100L * w) / 100).toFixed(3)) })));
            }}
          />
        </Field>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">
            Tank mix — enter the dose rate per 100 L and the quantity is calculated from the water volume
          </p>
          <div className="mb-1 grid grid-cols-[1fr_100px_100px_100px_90px_28px] gap-2 text-xs text-muted">
            <span>Product</span>
            <span>Rate /100L</span>
            <span>Qty used</span>
            <span>Cost/unit</span>
            <span className="text-right">Line cost</span>
            <span />
          </div>
          <div className="space-y-2">
            {products.map((p) => {
              const item = db.items.find((i) => i.id === p.itemId);
              return (
                <div key={p.key} className="grid grid-cols-[1fr_100px_100px_100px_90px_28px] items-center gap-2">
                  <select
                    value={p.itemId}
                    onChange={(e) => {
                      const it = db.items.find((i) => i.id === e.target.value);
                      setProduct(p.key, { itemId: e.target.value, unitCost: it?.lastCostPerUnit ?? 0 });
                    }}
                    className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm"
                  >
                    {db.items.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={p.ratePer100L || ""}
                    onChange={(e) => recalcQty(p.key, Number(e.target.value) || 0)}
                    className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm tnum"
                  />
                  <input
                    type="number"
                    step="0.001"
                    value={p.quantityUsed || ""}
                    onChange={(e) => setProduct(p.key, { quantityUsed: Number(e.target.value) || 0 })}
                    className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm tnum"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={p.unitCost || ""}
                    onChange={(e) => setProduct(p.key, { unitCost: Number(e.target.value) || 0 })}
                    className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm tnum"
                  />
                  <span className="text-right text-sm tnum text-ink-2">{fmtRM(p.quantityUsed * p.unitCost)}</span>
                  <button
                    onClick={() => setProducts((ps) => (ps.length > 1 ? ps.filter((x) => x.key !== p.key) : ps))}
                    className="text-muted hover:text-critical"
                    aria-label="Remove product"
                  >
                    ✕
                  </button>
                  {item && <span className="col-span-6 -mt-1 text-xs text-muted">Stock: {item.stock} {item.unit}</span>}
                </div>
              );
            })}
          </div>
          <button
            onClick={() =>
              setProducts([
                ...products,
                { key: String(Date.now()), itemId: db.items[0]?.id ?? "", ratePer100L: 0, quantityUsed: 0, unitCost: db.items[0]?.lastCostPerUnit ?? 0 },
              ])
            }
            className="mt-2 text-xs text-accent hover:underline"
          >
            + Add product to tank mix
          </button>
        </div>

        <div className="rounded border border-hairline bg-surface-2 px-3 py-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Cost of this application round</span>
            <span className="font-semibold tnum">{fmtRM(total)}</span>
          </div>
          {water > 0 && (
            <p className="mt-1 text-xs text-muted">
              {fmtRM((total / water) * 100)} per 100 L · water volume {water} L
            </p>
          )}
        </div>

        <Field label="Notes">
          <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Young crop, half water volume" />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Application</Button>
        </div>
      </div>
    </Modal>
  );
}
