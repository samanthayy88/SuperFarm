"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Table, Th, Td, Button, Modal, Field, TextInput, Select, StatCard, Tabs, EmptyState, MonthSelect } from "@/components/ui";
import { fmtRM, fmtDate, currentMonthKey, monthLabel, lastNMonthKeys, TODAY } from "@/lib/utils";
import { UsageLog, InventoryItem, StockAllocation } from "@/lib/types";
import { consumeStock, transferStock, farmBalance, mainBalance, allocatedTotal, fmtStock, packSizeOf } from "@/lib/stock";

export default function InventoryPage() {
  const { db } = useStore();
  const [tab, setTab] = useState("Inventory");
  const [showUsage, setShowUsage] = useState(false);
  const [itemForm, setItemForm] = useState<{ item?: InventoryItem } | null>(null);
  const [transferItem, setTransferItem] = useState<InventoryItem | null>(null);
  const [place, setPlace] = useState("main"); // By Farm tab: "main" or a farm id
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
        subtitle="Stock is held in a main store and split between your farms — purchases add to Main, then you hand quantities to each farm. The month filter applies to the Usage Log."
        actions={
          <>
            <MonthSelect value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
            <Button variant="ghost" onClick={() => setShowUsage(true)}>− Record Usage</Button>
            <Button onClick={() => setItemForm({})}>+ Add Item</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stock value" value={fmtRM(stockValue)} sub={`${db.items.length} tracked items`} />
        <StatCard label="Items low / out of stock" value={String(lowStock.length)} tone={lowStock.length > 0 ? "critical" : "good"} />
        <StatCard label={`Usage logged — ${monthLabel(month)}`} value={String(monthUsage.length)} />
        <StatCard label="Vendors" value={String(db.suppliers.length)} />
      </div>

      <Tabs tabs={["Inventory", "By Farm", "Allocations", "Supplier Name Mapping", "Usage Log"]} active={tab} onChange={setTab} />

      {tab === "Inventory" && (
        <Card title="Stock levels — main store and each farm">
          <Table>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Category</Th>
                <Th right>Total</Th>
                <Th right>Main (unallocated)</Th>
                {db.farms.map((f) => (
                  <Th key={f.id} right>{f.name}</Th>
                ))}
                <Th right>Min level</Th>
                <Th right>Stock value</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {db.items.map((i) => {
                const out = i.stock === 0;
                const low = i.stock <= i.minStock;
                return (
                  <tr key={i.id}>
                    <Td className="font-medium">
                      {i.name}
                      <span className="block text-xs font-normal text-muted">
                        {packSizeOf(i) > 1 && i.packLabel ? `1 ${i.packLabel} = ${packSizeOf(i)} ${i.unit} · ` : ""}
                        {fmtRM(i.lastCostPerUnit)}/{i.unit}
                      </span>
                    </Td>
                    <Td>{i.category}</Td>
                    <Td right className={out ? "text-critical" : low ? "text-warning" : ""}>
                      {fmtStock(i, i.stock)}
                    </Td>
                    <Td right>{fmtStock(i, mainBalance(i))}</Td>
                    {db.farms.map((f) => (
                      <Td key={f.id} right>{farmBalance(i, f.id) > 0 ? fmtStock(i, farmBalance(i, f.id)) : <span className="text-muted">—</span>}</Td>
                    ))}
                    <Td right>{i.minStock.toLocaleString()} {i.unit}</Td>
                    <Td right>{fmtRM(i.stock * i.lastCostPerUnit)}</Td>
                    <Td>
                      <Badge tone={out ? "critical" : low ? "warning" : "good"}>
                        {out ? "Out of stock — reorder" : low ? "Low — reorder soon" : "OK"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setTransferItem(i)}
                          className="rounded-full border border-hairline px-3 py-1 text-xs text-accent transition-colors hover:bg-surface-2"
                        >
                          Split / transfer
                        </button>
                        <button
                          onClick={() => setItemForm({ item: i })}
                          className="rounded-full border border-hairline px-3 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          Edit
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-muted">
            Total = Main + every farm. Using stock at a farm takes from that farm&apos;s share first, then from Main. Low-stock
            alerts look at the total.
          </p>
        </Card>
      )}

      {tab === "By Farm" && (() => {
        const places = [{ id: "main", label: "Main store" }, ...db.farms.map((f) => ({ id: f.id, label: f.name }))];
        const qtyAt = (i: InventoryItem) => (place === "main" ? mainBalance(i) : farmBalance(i, place));
        const held = db.items.filter((i) => qtyAt(i) > 0);
        const value = held.reduce((s, i) => s + qtyAt(i) * i.lastCostPerUnit, 0);
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {places.map((pl) => {
                const itemsHere = db.items.filter((i) => (pl.id === "main" ? mainBalance(i) : farmBalance(i, pl.id)) > 0).length;
                return (
                  <button
                    key={pl.id}
                    onClick={() => setPlace(pl.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      place === pl.id ? "border-accent bg-accent text-on-accent" : "border-hairline bg-surface text-ink-2 hover:border-accent/40 hover:text-accent"
                    }`}
                  >
                    {pl.label} <span className="opacity-70">· {itemsHere} item{itemsHere === 1 ? "" : "s"}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Items held" value={String(held.length)} sub={places.find((x) => x.id === place)?.label} />
              <StatCard label="Stock value here" value={fmtRM(value)} />
              <StatCard
                label="Share of all stock value"
                value={stockValue > 0 ? `${((value / stockValue) * 100).toFixed(0)}%` : "—"}
                sub={`of ${fmtRM(stockValue)} company-wide`}
              />
            </div>
            <Card title={`Inventory — ${places.find((x) => x.id === place)?.label}`}>
              {held.length === 0 ? (
                <EmptyState message={place === "main" ? "Nothing sits in Main right now." : "Nothing has been allocated to this farm yet. Use “Split to farms” on a purchase, or “Split / transfer” on the Inventory tab."} />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Item</Th>
                      <Th>Category</Th>
                      <Th right>Quantity here</Th>
                      <Th right>Value</Th>
                      <Th right>Of total stock</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {held.map((i) => (
                      <tr key={i.id}>
                        <Td className="font-medium">{i.name}</Td>
                        <Td>{i.category}</Td>
                        <Td right>{fmtStock(i, qtyAt(i))}</Td>
                        <Td right>{fmtRM(qtyAt(i) * i.lastCostPerUnit)}</Td>
                        <Td right>{i.stock > 0 ? `${((qtyAt(i) / i.stock) * 100).toFixed(0)}%` : "—"}</Td>
                        <Td>
                          <button
                            onClick={() => setTransferItem(i)}
                            className="rounded-full border border-hairline px-3 py-1 text-xs text-accent transition-colors hover:bg-surface-2"
                          >
                            Split / transfer
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        );
      })()}

      {tab === "Allocations" && (
        <Card title="Allocation history — stock handed to farms">
          {(db.allocations ?? []).length === 0 ? (
            <EmptyState message="Nothing allocated yet. Split a purchase between farms, or use “Split / transfer” on the Inventory tab." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Item</Th>
                  <Th>Farm</Th>
                  <Th right>Quantity</Th>
                  <Th right>Value</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {[...(db.allocations ?? [])].sort((x, y) => y.date.localeCompare(x.date)).map((al) => {
                  const item = db.items.find((i) => i.id === al.itemId);
                  const purchase = db.purchases.find((p) => p.id === al.purchaseId);
                  return (
                    <tr key={al.id}>
                      <Td>{fmtDate(al.date)}</Td>
                      <Td>{item?.name ?? "—"}</Td>
                      <Td>{db.farms.find((f) => f.id === al.farmId)?.name ?? "—"}</Td>
                      <Td right className={al.quantity < 0 ? "text-critical" : ""}>
                        {al.quantity > 0 ? "+" : ""}{al.quantity.toLocaleString()} {item?.unit}
                      </Td>
                      <Td right>{fmtRM(al.quantity * al.unitCost)}</Td>
                      <Td className="text-muted">
                        {purchase ? `Purchase ${fmtDate(purchase.date)} · ${db.suppliers.find((v) => v.id === purchase.supplierId)?.name ?? ""}` : al.quantity < 0 ? "Returned to Main / moved" : "Transfer from Main"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
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
      {itemForm && <ItemForm item={itemForm.item} onClose={() => setItemForm(null)} />}
      {transferItem && <TransferForm item={transferItem} onClose={() => setTransferItem(null)} />}
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
    update("items", (list) => list.map((i) => (i.id === item.id ? consumeStock(i, form.farmId, qty) : i)));
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
              <option key={i.id} value={i.id}>{i.name} ({fmtStock(i, i.stock)} in stock)</option>
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
        {item && (
          <p className="text-xs text-muted">
            {db.farms.find((f) => f.id === form.farmId)?.name}: {fmtStock(item, farmBalance(item, form.farmId))} · Main:{" "}
            {fmtStock(item, mainBalance(item))}
          </p>
        )}
        {item && qty > 0 && (() => {
          const own = farmBalance(item, form.farmId);
          const short = Math.max(0, qty - own);
          const after = Math.max(0, item.stock - qty);
          return (
            <>
              {short > 0 && (
                <p className={`text-xs ${short > mainBalance(item) ? "text-critical" : "text-warning"}`}>
                  {short > mainBalance(item)
                    ? `Not enough stock: this farm has ${own.toLocaleString()} ${item.unit} and Main has ${mainBalance(item).toLocaleString()} ${item.unit}.`
                    : `This farm only has ${own.toLocaleString()} ${item.unit} — ${short.toLocaleString()} ${item.unit} will be drawn from Main.`}
                </p>
              )}
              <p className={`text-xs ${after <= item.minStock ? "text-warning" : "text-muted"}`}>
                Total stock after usage: {fmtStock(item, after)}
                {after <= item.minStock && " — below minimum, reorder soon"}
              </p>
            </>
          );
        })()}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Usage</Button>
        </div>
      </div>
    </Modal>
  );
}

const UNITS = ["kg", "L", "pcs", "roll", "g", "mL"];
const CATEGORIES: InventoryItem["category"][] = ["Fertilizer", "Pesticide", "Fungicide", "Herbicide", "Tools", "Materials", "Other"];

function ItemForm({ item, onClose }: { item?: InventoryItem; onClose: () => void }) {
  const { update } = useStore();
  const [form, setForm] = useState({
    name: item?.name ?? "",
    category: item?.category ?? ("Fertilizer" as InventoryItem["category"]),
    unit: item?.unit ?? "kg",
    packLabel: item?.packLabel ?? "",
    packSize: item ? String(packSizeOf(item)) : "1",
    minStock: item ? String(item.minStock) : "0",
    trackInventory: item?.trackInventory ?? true,
    stock: item ? String(item.stock) : "",
  });
  const size = Number(form.packSize) || 1;
  const newStock = Number(form.stock) || 0;
  const minAllowed = item ? allocatedTotal(item) : 0;
  const stockTooLow = Boolean(item) && newStock < minAllowed - 1e-9;

  const submit = () => {
    if (!form.name.trim() || stockTooLow) return;
    const payload = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      packLabel: form.packLabel.trim() || undefined,
      packSize: size,
      minStock: Number(form.minStock) || 0,
      trackInventory: form.trackInventory,
    };
    if (item) update("items", (list) => list.map((i) => (i.id === item.id ? { ...i, ...payload, stock: newStock } : i)));
    else
      update("items", (list) => [
        ...list,
        { id: newId("i"), stock: 0, lastCostPerUnit: 0, aliases: [], farmStock: {}, ...payload },
      ]);
    onClose();
  };

  return (
    <Modal title={item ? `Edit ${item.name}` : "Add Stock Item"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Item name">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pruning scissors" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as InventoryItem["category"] })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Count stock in (smallest unit)">
            <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </Field>
          <Field label="One pack on the invoice is called">
            <TextInput value={form.packLabel} onChange={(e) => setForm({ ...form, packLabel: e.target.value })} placeholder="bag, bottle, pack…" />
          </Field>
          <Field label={`${form.unit} in one pack`}>
            <TextInput type="number" value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-muted">
          {size > 1
            ? `Buying 1 ${form.packLabel || "pack"} adds ${size} ${form.unit} to stock, and you can split it between farms in ${form.unit}.`
            : `Stock is counted one ${form.unit} at a time.`}
          {item ? " Changing this only affects purchases you record from now on." : ""}
        </p>
        <Field label={`Minimum level (${form.unit}) — reorder alert`}>
          <TextInput type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
        </Field>
        {item && (
          <Field label={`Total stock on hand (${form.unit}) — change only to correct a miscount`}>
            <TextInput type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </Field>
        )}
        {stockTooLow && (
          <p className="text-xs text-critical">
            {allocatedTotal(item!).toLocaleString()} {form.unit} is already handed to farms, so the total can&apos;t be lower. Move
            some back to Main first.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{item ? "Save changes" : "Add Item"}</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Move stock between Main and a farm (or between two farms), keeping a record of each move. */
function TransferForm({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const { db, setDB } = useStore();
  const [form, setForm] = useState({
    from: "main",
    to: db.farms[0]?.id ?? "",
    quantity: "",
    date: TODAY.toISOString().slice(0, 10),
  });
  const qty = Number(form.quantity) || 0;
  const src = form.from === "main" ? null : form.from;
  const dst = form.to === "main" ? null : form.to;
  const available = src === null ? mainBalance(item) : farmBalance(item, src);
  const sameSpot = form.from === form.to;
  const invalid = !qty || qty > available + 1e-9 || sameSpot;
  const place = (v: string) => (v === "main" ? "Main" : db.farms.find((f) => f.id === v)?.name ?? "");

  const submit = () => {
    if (invalid) return;
    setDB((prev) => {
      const moves: StockAllocation[] = [];
      if (dst !== null) moves.push({ id: newId("al"), date: form.date, itemId: item.id, farmId: dst, quantity: qty, unitCost: item.lastCostPerUnit, kind: "transfer" });
      if (src !== null) moves.push({ id: newId("al"), date: form.date, itemId: item.id, farmId: src, quantity: -qty, unitCost: item.lastCostPerUnit, kind: "transfer" });
      return {
        ...prev,
        items: prev.items.map((i) => (i.id === item.id ? transferStock(i, src, dst, qty) : i)),
        allocations: [...(prev.allocations ?? []), ...moves],
      };
    });
    onClose();
  };

  const options = [{ v: "main", label: "Main (unallocated)" }, ...db.farms.map((f) => ({ v: f.id, label: f.name }))];

  return (
    <Modal title={`Split / transfer — ${item.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-muted">
          Total {fmtStock(item, item.stock)} · Main {fmtStock(item, mainBalance(item))}
          {db.farms.map((f) => ` · ${f.name} ${fmtStock(item, farmBalance(item, f.id))}`).join("")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <Select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>
              {options.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="To">
            <Select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>
              {options.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label={`Quantity (${item.unit})`}>
            <TextInput type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="Date">
            <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
        </div>
        <p className={`text-xs ${qty > available + 1e-9 || sameSpot ? "text-critical" : "text-muted"}`}>
          {sameSpot
            ? "Pick two different places."
            : `${place(form.from)} has ${available.toLocaleString()} ${item.unit} available.${qty > available + 1e-9 ? " That is more than it holds." : ""}`}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Move stock</Button>
        </div>
      </div>
    </Modal>
  );
}
