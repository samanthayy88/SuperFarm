"use client";

import { useState, useRef } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Table, Th, Td, Button, Modal, Field, TextInput, Select, StatCard, Tabs, EmptyState } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, TODAY } from "@/lib/utils";
import { Purchase, PurchaseLine, UsageLog } from "@/lib/types";

const purchaseTotal = (p: Purchase) => p.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

export default function InventoryPage() {
  const { db, update } = useStore();
  const [tab, setTab] = useState("Inventory");
  const [showPurchase, setShowPurchase] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const lowStock = db.items.filter((i) => i.trackInventory && i.stock <= i.minStock);
  const stockValue = db.items.reduce((s, i) => s + i.stock * i.lastCostPerUnit, 0);
  const claims = db.purchases.filter((p) => p.paidBy === "Own Pocket");
  const toClaim = claims.filter((p) => p.claimStatus === "To Claim");
  const claimPending = claims.filter((p) => p.claimStatus !== "Reimbursed");
  const claimPendingTotal = claimPending.reduce((s, p) => s + purchaseTotal(p), 0);

  const setClaimStatus = (id: string, status: Purchase["claimStatus"]) =>
    update("purchases", (list) => list.map((p) => (p.id === id ? { ...p, claimStatus: status } : p)));

  return (
    <div>
      <PageHeader
        title="Purchases & Inventory"
        subtitle="Upload receipts to claim expenses and update stock in one step"
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowUsage(true)}>− Record Usage</Button>
            <Button onClick={() => setShowPurchase(true)}>+ New Purchase / Receipt</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stock value" value={fmtRM0(stockValue)} sub={`${db.items.length} tracked items`} />
        <StatCard label="Items low / out of stock" value={String(lowStock.length)} tone={lowStock.length > 0 ? "critical" : "good"} />
        <StatCard label="Claims outstanding" value={fmtRM0(claimPendingTotal)} sub={`${toClaim.length} not yet submitted`} tone={claimPendingTotal > 0 ? "warning" : "good"} />
        <StatCard label="Purchases recorded" value={String(db.purchases.length)} sub={`${db.suppliers.length} suppliers`} />
      </div>

      <Tabs tabs={["Inventory", "Purchases & Claims", "Supplier Name Mapping", "Usage Log"]} active={tab} onChange={setTab} />

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

      {tab === "Purchases & Claims" && (
        <Card title="Purchases">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Supplier</Th>
                <Th>Items (as printed on invoice)</Th>
                <Th right>Total</Th>
                <Th>Paid by</Th>
                <Th>Claim status</Th>
                <Th>Receipt</Th>
              </tr>
            </thead>
            <tbody>
              {[...db.purchases].sort((a, b) => b.date.localeCompare(a.date)).map((p) => {
                const sup = db.suppliers.find((s) => s.id === p.supplierId);
                return (
                  <tr key={p.id}>
                    <Td>{fmtDate(p.date)}</Td>
                    <Td>{sup?.name ?? "—"}</Td>
                    <Td>
                      {p.lines.map((l, idx) => {
                        const item = db.items.find((i) => i.id === l.itemId);
                        return (
                          <p key={idx} className="text-xs text-ink-2">
                            {l.invoiceName} × {l.quantity} @ {fmtRM(l.unitPrice)}
                            {item ? (
                              <span className="ml-1 text-accent">→ {item.name}</span>
                            ) : (
                              <span className="ml-1 text-muted">(one-time, not stocked)</span>
                            )}
                          </p>
                        );
                      })}
                    </Td>
                    <Td right className="font-medium">{fmtRM(purchaseTotal(p))}</Td>
                    <Td>
                      <Badge tone={p.paidBy === "Own Pocket" ? "warning" : "neutral"}>{p.paidBy}</Badge>
                    </Td>
                    <Td>
                      {p.paidBy === "Own Pocket" ? (
                        <select
                          value={p.claimStatus ?? "To Claim"}
                          onChange={(e) => setClaimStatus(p.id, e.target.value as Purchase["claimStatus"])}
                          className={`rounded border border-hairline bg-surface-2 px-2 py-1 text-xs ${
                            p.claimStatus === "Reimbursed" ? "text-good" : p.claimStatus === "Claim Submitted" ? "text-accent" : "text-warning"
                          }`}
                        >
                          <option>To Claim</option>
                          <option>Claim Submitted</option>
                          <option>Reimbursed</option>
                        </select>
                      ) : (
                        <span className="text-xs text-muted">n/a</span>
                      )}
                    </Td>
                    <Td>
                      {p.receiptDataUrl ? (
                        <button onClick={() => setReceiptPreview(p.receiptDataUrl!)} className="text-xs text-accent hover:underline">
                          View image
                        </button>
                      ) : p.receiptName ? (
                        <span className="text-xs text-muted">{p.receiptName}</span>
                      ) : (
                        <span className="text-xs text-critical">Missing</span>
                      )}
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
        <Card title="Stock usage log">
          {db.usageLogs.length === 0 ? (
            <EmptyState message="No usage recorded yet." />
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
                {[...db.usageLogs].sort((a, b) => b.date.localeCompare(a.date)).map((u) => {
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

      {showPurchase && <PurchaseForm onClose={() => setShowPurchase(false)} />}
      {showUsage && <UsageForm onClose={() => setShowUsage(false)} />}
      {receiptPreview && (
        <Modal title="Receipt" onClose={() => setReceiptPreview(null)} wide>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={receiptPreview} alt="Receipt" className="mx-auto max-h-[70vh] rounded border border-hairline" />
        </Modal>
      )}
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
        className="rounded bg-accent px-2 py-1 text-xs text-white"
      >
        Save
      </button>
    </div>
  );
}

interface DraftLine extends PurchaseLine {
  key: string;
}

function PurchaseForm({ onClose }: { onClose: () => void }) {
  const { db, update } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [receipt, setReceipt] = useState<{ name: string; dataUrl: string } | null>(null);
  const [form, setForm] = useState({
    date: TODAY.toISOString().slice(0, 10),
    supplierId: db.suppliers[0]?.id ?? "",
    paidBy: "Own Pocket" as Purchase["paidBy"],
    notes: "",
  });
  const [lines, setLines] = useState<DraftLine[]>([{ key: "1", invoiceName: "", quantity: 1, unitPrice: 0, itemId: undefined }]);

  /** Downscale the image so it fits comfortably in localStorage. */
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setReceipt({ name: file.name, dataUrl: canvas.toDataURL("image/jpeg", 0.6) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  /** Suggest a stock item from the supplier's invoice wording. */
  const suggestItem = (invoiceName: string): string | undefined => {
    const n = invoiceName.trim().toLowerCase();
    if (!n) return undefined;
    for (const item of db.items) {
      if (item.aliases.some((a) => a.supplierId === form.supplierId && a.aliasName.toLowerCase() === n)) return item.id;
    }
    for (const item of db.items) {
      if (item.aliases.some((a) => a.aliasName.toLowerCase().includes(n) || n.includes(a.aliasName.toLowerCase()))) return item.id;
      if (item.name.toLowerCase().includes(n) || n.includes(item.name.toLowerCase())) return item.id;
    }
    return undefined;
  };

  const setLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const submit = () => {
    const valid = lines.filter((l) => l.invoiceName.trim() && l.quantity > 0);
    if (valid.length === 0) return;

    const purchase: Purchase = {
      id: newId("pu"),
      date: form.date,
      supplierId: form.supplierId,
      paidBy: form.paidBy,
      claimStatus: form.paidBy === "Own Pocket" ? "To Claim" : undefined,
      receiptName: receipt?.name,
      receiptDataUrl: receipt?.dataUrl,
      notes: form.notes || undefined,
      lines: valid.map(({ key, ...l }) => l), // eslint-disable-line @typescript-eslint/no-unused-vars
    };
    update("purchases", (list) => [...list, purchase]);

    // update stock + last cost for every line linked to a tracked item
    update("items", (list) =>
      list.map((item) => {
        const relevant = valid.filter((l) => l.itemId === item.id);
        if (relevant.length === 0) return item;
        const addedQty = relevant.reduce((s, l) => s + l.quantity, 0);
        const newAliases = [...item.aliases];
        for (const l of relevant) {
          const nm = l.invoiceName.trim();
          if (nm && !newAliases.some((a) => a.supplierId === form.supplierId && a.aliasName.toLowerCase() === nm.toLowerCase()))
            newAliases.push({ supplierId: form.supplierId, aliasName: nm });
        }
        return {
          ...item,
          stock: item.stock + addedQty,
          lastCostPerUnit: relevant[relevant.length - 1].unitPrice || item.lastCostPerUnit,
          aliases: newAliases,
        };
      })
    );
    onClose();
  };

  return (
    <Modal title="New Purchase — upload receipt, claim & update stock" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Date">
            <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Supplier">
            <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              {db.suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Paid by">
            <Select value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value as Purchase["paidBy"] })}>
              <option>Own Pocket</option>
              <option>Company</option>
            </Select>
          </Field>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-muted">Receipt (screenshot or photo)</p>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            className="cursor-pointer rounded border border-dashed border-hairline bg-surface-2 p-4 text-center transition-colors hover:border-accent/50"
          >
            {receipt ? (
              <div className="flex items-center justify-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receipt.dataUrl} alt="Receipt preview" className="max-h-24 rounded border border-hairline" />
                <span className="text-xs text-ink-2">{receipt.name} — click to replace</span>
              </div>
            ) : (
              <p className="text-sm text-muted">Click to upload or drag a receipt image here</p>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">
            Line items — type the name exactly as printed on the invoice, then link it to a stock item (leave unlinked for one-time purchases)
          </p>
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[1fr_70px_90px_1fr_28px] items-center gap-2">
                <input
                  value={l.invoiceName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLine(l.key, { invoiceName: v, itemId: l.itemId ?? suggestItem(v) });
                  }}
                  onBlur={() => {
                    if (!l.itemId) {
                      const s = suggestItem(l.invoiceName);
                      if (s) setLine(l.key, { itemId: s });
                    }
                  }}
                  placeholder="Name on invoice"
                  className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  value={l.quantity || ""}
                  onChange={(e) => setLine(l.key, { quantity: Number(e.target.value) || 0 })}
                  placeholder="Qty"
                  className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm tnum"
                />
                <input
                  type="number"
                  step="0.01"
                  value={l.unitPrice || ""}
                  onChange={(e) => setLine(l.key, { unitPrice: Number(e.target.value) || 0 })}
                  placeholder="Unit RM"
                  className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm tnum"
                />
                <select
                  value={l.itemId ?? ""}
                  onChange={(e) => setLine(l.key, { itemId: e.target.value || undefined })}
                  className="rounded border border-hairline bg-surface-2 px-2 py-2 text-sm"
                >
                  <option value="">One-time — do not stock</option>
                  {db.items.map((i) => (
                    <option key={i.id} value={i.id}>→ {i.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                  className="text-muted hover:text-critical"
                  aria-label="Remove line"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLines([...lines, { key: String(Date.now()), invoiceName: "", quantity: 1, unitPrice: 0 }])}
            className="mt-2 text-xs text-accent hover:underline"
          >
            + Add line
          </button>
        </div>

        <div className="rounded border border-hairline bg-surface-2 px-3 py-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Total</span>
            <span className="font-semibold tnum">{fmtRM(total)}</span>
          </div>
          {form.paidBy === "Own Pocket" && (
            <p className="mt-1 text-xs text-warning">
              Will be filed as a claim ({fmtRM(total)}) against the company, status &ldquo;To Claim&rdquo;.
            </p>
          )}
          {lines.some((l) => l.itemId) && (
            <p className="mt-1 text-xs text-good">
              Stock will be increased for: {lines.filter((l) => l.itemId).map((l) => db.items.find((i) => i.id === l.itemId)?.name).join(", ")}
            </p>
          )}
        </div>

        <Field label="Notes">
          <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Purchase</Button>
        </div>
      </div>
    </Modal>
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
