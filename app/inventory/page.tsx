"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Table, Th, Td, Button, Modal, Field, TextInput, Select, StatCard, Tabs, EmptyState, MonthSelect } from "@/components/ui";
import { fmtRM, fmtDate, currentMonthKey, monthLabel, lastNMonthKeys, TODAY } from "@/lib/utils";
import { UsageLog } from "@/lib/types";

export default function InventoryPage() {
  const { db, update } = useStore();
  const [tab, setTab] = useState("Inventory");
  const [showUsage, setShowUsage] = useState(false);
  const months = lastNMonthKeys(12).reverse();
  const [month, setMonth] = useState(
    () => months.find((m) => db.usageLogs.some((u) => u.date.startsWith(m))) ?? currentMonthKey()
  );

  const lowStock = db.items.filter((i) => i.trackInventory && i.stock <= i.minStock);
  const stockValue = db.items.reduce((s, i) => s + i.stock * i.lastCostPerUnit, 0);
  const monthUsage = db.usageLogs.filter((u) => u.date.startsWith(month));

  return (
    <div>
      <PageHeader
        title="Stock Level"
        subtitle="Track quantity on hand, supplier invoice names and usage — purchases update stock automatically. The month filter applies to the Usage Log."
        actions={
          <>
            <MonthSelect value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
            <Button variant="ghost" onClick={() => setShowUsage(true)}>− Record Usage</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stock value" value={fmtRM(stockValue)} sub={`${db.items.length} tracked items`} />
        <StatCard label="Items low / out of stock" value={String(lowStock.length)} tone={lowStock.length > 0 ? "critical" : "good"} />
        <StatCard label={`Usage logged — ${monthLabel(month)}`} value={String(monthUsage.length)} />
        <StatCard label="Vendors" value={String(db.suppliers.length)} />
      </div>

      <Tabs tabs={["Inventory", "Supplier Name Mapping", "Usage Log"]} active={tab} onChange={setTab} />

      {tab === "Inventory" && (
        <Card title="Stock levels">
          <Table>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Category</Th>
                <Th right>In stock</Th>
                <Th right>Min level</Th>
                <Th right>Last cost/unit</Th>
                <Th right>Stock value</Th>
                <Th>Status</Th>
                <Th>Adjust</Th>
              </tr>
            </thead>
            <tbody>
              {db.items.map((i) => {
                const out = i.stock === 0;
                const low = i.stock <= i.minStock;
                return (
                  <tr key={i.id}>
                    <Td className="font-medium">{i.name}</Td>
                    <Td>{i.category}</Td>
                    <Td right className={out ? "text-critical" : low ? "text-warning" : ""}>
                      {i.stock} {i.unit}
                    </Td>
                    <Td right>{i.minStock}</Td>
                    <Td right>{fmtRM(i.lastCostPerUnit)}</Td>
                    <Td right>{fmtRM(i.stock * i.lastCostPerUnit)}</Td>
                    <Td>
                      <Badge tone={out ? "critical" : low ? "warning" : "good"}>
                        {out ? "Out of stock — reorder" : low ? "Low — reorder soon" : "OK"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => update("items", (list) => list.map((x) => (x.id === i.id ? { ...x, stock: Math.max(0, x.stock - 1) } : x)))}
                          className="rounded border border-hairline bg-surface-2 px-2 py-0.5 text-xs hover:bg-grid"
                        >
                          −
                        </button>
                        <button
                          onClick={() => update("items", (list) => list.map((x) => (x.id === i.id ? { ...x, stock: x.stock + 1 } : x)))}
                          className="rounded border border-hairline bg-surface-2 px-2 py-0.5 text-xs hover:bg-grid"
                        >
                          +
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "Supplier Name Mapping" && (
        <Card title="Supplier invoice names → our standard item names">
          <p className="mb-4 text-sm text-muted">
            Different suppliers print different names for the same product. Map them here so purchases update the right stock item.
          </p>
          <Table>
            <thead>
              <tr>
                <Th>Our item name</Th>
                <Th>Unit</Th>
                <Th>Supplier invoice names</Th>
                <Th>Add mapping</Th>
              </tr>
            </thead>
            <tbody>
              {db.items.map((i) => (
                <tr key={i.id}>
                  <Td className="font-medium">{i.name}</Td>
                  <Td>{i.unit}</Td>
                  <Td>
                    {i.aliases.length === 0 ? (
                      <span className="text-muted">No mappings yet</span>
                    ) : (
                      i.aliases.map((a, idx) => (
                        <p key={idx} className="text-xs text-ink-2">
                          <span className="text-muted">{db.suppliers.find((s) => s.id === a.supplierId)?.name}:</span> &ldquo;{a.aliasName}&rdquo;
                        </p>
                      ))
                    )}
                  </Td>
                  <Td>
                    <AliasAdder itemId={i.id} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "Usage Log" && (
        <Card title={`Stock usage log — ${monthLabel(month)}`}>
          {monthUsage.length === 0 ? (
            <EmptyState message="No usage recorded for this month." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Item</Th>
                  <Th right>Quantity used</Th>
                  <Th>Purpose</Th>
                  <Th>Farm</Th>
                </tr>
              </thead>
              <tbody>
                {[...monthUsage].sort((a, b) => b.date.localeCompare(a.date)).map((u) => {
                  const item = db.items.find((i) => i.id === u.itemId);
                  return (
                    <tr key={u.id}>
                      <Td>{fmtDate(u.date)}</Td>
                      <Td>{item?.name ?? "—"}</Td>
                      <Td right>{u.quantity} {item?.unit}</Td>
                      <Td>{u.purpose}</Td>
                      <Td>{db.farms.find((f) => f.id === u.farmId)?.name ?? "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {showUsage && <UsageForm onClose={() => setShowUsage(false)} />}
    </div>
  );
}

function AliasAdder({ itemId }: { itemId: string }) {
  const { db, update } = useStore();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(db.suppliers[0]?.id ?? "");
  const [alias, setAlias] = useState("");

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-accent hover:underline">
        + Add
      </button>
    );

  return (
    <div className="flex items-center gap-1">
      <select
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        className="rounded border border-hairline bg-surface-2 px-1.5 py-1 text-xs"
      >
        {db.suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <input
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        placeholder="Name on invoice"
        className="w-36 rounded border border-hairline bg-surface-2 px-1.5 py-1 text-xs"
      />
      <button
        onClick={() => {
          if (alias.trim())
            update("items", (list) =>
              list.map((i) => (i.id === itemId ? { ...i, aliases: [...i.aliases, { supplierId, aliasName: alias.trim() }] } : i))
            );
          setAlias("");
          setOpen(false);
        }}
        className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-on-accent"
      >
        Save
      </button>
    </div>
  );
}

function UsageForm({ onClose }: { onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    date: TODAY.toISOString().slice(0, 10),
    itemId: db.items[0]?.id ?? "",
    quantity: "",
    purpose: "",
    farmId: db.farms[0]?.id ?? "",
  });

  const item = db.items.find((i) => i.id === form.itemId);
  const qty = Number(form.quantity) || 0;

  const submit = () => {
    if (!item || !qty) return;
    const u: UsageLog = {
      id: newId("u"),
      date: form.date,
      itemId: item.id,
      quantity: qty,
      purpose: form.purpose,
      farmId: form.farmId,
    };
    update("usageLogs", (list) => [...list, u]);
    update("items", (list) => list.map((i) => (i.id === item.id ? { ...i, stock: Math.max(0, i.stock - qty) } : i)));
    onClose();
  };

  return (
    <Modal title="Record Stock Usage" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Date">
          <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Item">
          <Select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
            {db.items.map((i) => (
              <option key={i.id} value={i.id}>{i.name} ({i.stock} {i.unit} in stock)</option>
            ))}
          </Select>
        </Field>
        <Field label={`Quantity used (${item?.unit ?? ""})`}>
          <TextInput type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </Field>
        <Field label="Purpose">
          <TextInput value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Side dressing Plot A" />
        </Field>
        <Field label="Farm">
          <Select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })}>
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </Field>
        {item && qty > 0 && (
          <p className={`text-xs ${item.stock - qty <= item.minStock ? "text-warning" : "text-muted"}`}>
            Stock after usage: {Math.max(0, item.stock - qty)} {item.unit}
            {item.stock - qty <= item.minStock && " — below minimum, reorder soon"}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Usage</Button>
        </div>
      </div>
    </Modal>
  );
}
