"use client";

import { useState, useRef } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Table, Th, Td, Button, Modal, Field, TextInput, Select, StatCard, MonthSelect, EmptyState, ConfirmDialog } from "@/components/ui";
import { fmtRM, fmtRM0, fmtDate, purchaseTotal, currentMonthKey, monthLabel, lastNMonthKeys, TODAY } from "@/lib/utils";
import { Purchase, StockAllocation, InventoryItem } from "@/lib/types";
import { packSizeOf, mainBalance, lineBaseQty, reversePurchase } from "@/lib/stock";
import ItemForm from "@/components/ItemForm";

export default function PurchasesPage() {
  const { db, update, setDB } = useStore();
  const [showPurchase, setShowPurchase] = useState(false);
  const [deletePurchase, setDeletePurchase] = useState<Purchase | null>(null);
  const [splitPurchase, setSplitPurchase] = useState<Purchase | null>(null);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const months = lastNMonthKeys(12).reverse();
  const [month, setMonth] = useState(
    () => months.find((m) => db.purchases.some((p) => p.date.startsWith(m))) ?? currentMonthKey()
  );

  const claims = db.purchases.filter((p) => p.paidBy === "Own Pocket");
  const toClaim = claims.filter((p) => p.claimStatus === "To Claim");
  const claimPending = claims.filter((p) => p.claimStatus !== "Reimbursed");
  const claimPendingTotal = claimPending.reduce((s, p) => s + purchaseTotal(p), 0);
  const totalSpend = db.purchases.reduce((s, p) => s + purchaseTotal(p), 0);
  const monthPurchases = db.purchases.filter((p) => p.date.startsWith(month));
  const monthVendors = new Set(monthPurchases.map((p) => p.supplierId)).size;

  /** Removing a purchase takes back what it added: the stock, and each farm's share of it. */
  const doDeletePurchase = (p: Purchase) => {
    setDB((prev) => reversePurchase(prev, p));
    setDeletePurchase(null);
  };

  /** "Chicken Manure: Sungai Ruan 10 kg · Bukit Tinggi 5 kg · Main 10 kg" for each stocked line of a purchase. */
  const splitSummary = (p: Purchase): string[] => {
    const out: string[] = [];
    const itemIds = [...new Set(p.lines.map((l) => l.itemId).filter(Boolean) as string[])];
    for (const id of itemIds) {
      const item = db.items.find((i) => i.id === id);
      if (!item) continue;
      const received = p.lines.filter((l) => l.itemId === id).reduce((s, l) => s + lineBaseQty(l, item), 0);
      const splits = (db.allocations ?? []).filter((a) => a.purchaseId === p.id && a.itemId === id);
      const given = splits.reduce((s, a) => s + a.quantity, 0);
      const parts = splits.map((a) => `${db.farms.find((f) => f.id === a.farmId)?.name ?? "Farm"} ${a.quantity.toLocaleString()} ${item.unit}`);
      out.push(`${item.name}: ${[...parts, `Main ${Math.max(0, received - given).toLocaleString()} ${item.unit}`].join(" · ")}`);
    }
    return out;
  };

  const setClaimStatus = (id: string, status: Purchase["claimStatus"]) =>
    update("purchases", (list) => list.map((p) => (p.id === id ? { ...p, claimStatus: status } : p)));

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Upload receipts, link them to stock items and claim personal spend"
        actions={
          <>
            <MonthSelect value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
            <Button onClick={() => setShowPurchase(true)}>+ New Purchase / Receipt</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Purchases — ${monthLabel(month)}`} value={fmtRM0(monthPurchases.reduce((s, p) => s + purchaseTotal(p), 0))} sub={`${monthPurchases.length} record(s)`} />
        <StatCard label="Claims outstanding" value={fmtRM0(claimPendingTotal)} sub={`${toClaim.length} not yet submitted`} tone={claimPendingTotal > 0 ? "warning" : "good"} />
        <StatCard label={`Vendors used — ${monthLabel(month)}`} value={String(monthVendors)} />
        <StatCard label="All-time purchases" value={fmtRM0(totalSpend)} sub={`${db.purchases.length} record(s)`} />
      </div>

      <Card title={`Purchases — ${monthLabel(month)}`}>
        {monthPurchases.length === 0 ? (
          <EmptyState message="No purchases recorded for this month." />
        ) : (
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Vendor</Th>
              <Th>Items (as printed on invoice)</Th>
              <Th right>Total</Th>
              <Th>Paid by</Th>
              <Th>Claim status</Th>
              <Th>Receipt</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {[...monthPurchases].sort((a, b) => b.date.localeCompare(a.date)).map((p) => {
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
                          {l.invoiceName} × {l.quantity}{l.uom ? ` ${l.uom}` : ""} @ {fmtRM(l.unitPrice)}
                          {l.packSize && l.packSize !== 1 ? <span className="text-muted"> ({l.packSize} {l.packUnit}/{l.uom ?? "pack"})</span> : null}
                          {l.category ? <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{l.category}</span> : null}
                          {item ? (
                            <span className="ml-1 text-accent">→ {item.name} (+{lineBaseQty(l, item).toLocaleString()} {item.unit})</span>
                          ) : (
                            <span className="ml-1 text-muted">(one-time, not stocked)</span>
                          )}
                        </p>
                      );
                    })}
                    {splitSummary(p).map((line) => (
                      <p key={line} className="mt-1 text-xs text-muted">{line}</p>
                    ))}
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
                  <Td>
                    <button
                      onClick={() => setEditPurchase(p)}
                      className="mr-1 rounded-full border border-hairline px-3 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      Edit
                    </button>
                    {p.lines.some((l) => l.itemId) && (
                      <button
                        onClick={() => setSplitPurchase(p)}
                        className="mr-1 rounded-full border border-accent/40 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
                      >
                        Split to farms
                      </button>
                    )}
                    <button
                      onClick={() => setDeletePurchase(p)}
                      className="rounded-full px-3 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
                    >
                      Delete
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        )}
      </Card>

      {showPurchase && <PurchaseForm onClose={() => setShowPurchase(false)} />}
      {editPurchase && <PurchaseForm purchase={editPurchase} onClose={() => setEditPurchase(null)} />}
      {splitPurchase && <SplitPurchaseForm purchase={splitPurchase} onClose={() => setSplitPurchase(null)} />}
      {deletePurchase && (
        <ConfirmDialog
          title="Delete this purchase?"
          message={`The ${fmtRM(purchaseTotal(deletePurchase))} purchase will be removed, and the stock it added (and each farm's share of it) is taken back out of inventory.`}
          confirmLabel="Delete purchase"
          onConfirm={() => doDeletePurchase(deletePurchase)}
          onClose={() => setDeletePurchase(null)}
        />
      )}
      {receiptPreview && (
        <Modal title="Receipt" onClose={() => setReceiptPreview(null)} wide>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={receiptPreview} alt="Receipt" className="mx-auto max-h-[70vh] rounded border border-hairline" />
        </Modal>
      )}
    </div>
  );
}

interface DraftSplit {
  key: string;
  farmId: string;
  quantity: string; // base units (kg / L / pcs)
}

interface DraftLine {
  key: string;
  invoiceName: string;
  quantity: number;
  unitPrice: number;
  itemId?: string;
  uom: string; // pack as invoiced: bag, bottle...
  packSize: number; // content of one pack, in packUnit
  packUnit: string; // kg / L / pcs
  category: string;
  splits?: DraftSplit[];
}

const lineClass = "rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm";

function PurchaseForm({ purchase, onClose }: { purchase?: Purchase; onClose: () => void }) {
  const { db, setDB } = useStore();
  const editing = Boolean(purchase);
  const fileRef = useRef<HTMLInputElement>(null);
  const [receipt, setReceipt] = useState<{ name: string; dataUrl?: string } | null>(
    purchase?.receiptName || purchase?.receiptDataUrl ? { name: purchase.receiptName ?? "Receipt", dataUrl: purchase.receiptDataUrl } : null
  );
  const [itemForm, setItemForm] = useState<{ lineKey: string; item?: InventoryItem } | null>(null);
  const [form, setForm] = useState({
    date: purchase?.date ?? TODAY.toISOString().slice(0, 10),
    supplierId: purchase?.supplierId ?? db.suppliers[0]?.id ?? "",
    paidBy: purchase?.paidBy ?? ("Own Pocket" as Purchase["paidBy"]),
    notes: purchase?.notes ?? "",
  });

  const packUoms = db.uoms.filter((u) => u.kind === "pack");
  const measureUoms = db.uoms.filter((u) => u.kind === "measure");
  const blankLine = (key: string): DraftLine => ({
    key,
    invoiceName: "",
    quantity: 1,
    unitPrice: 0,
    uom: measureUoms.find((u) => u.name === "pcs")?.name ?? measureUoms[0]?.name ?? "pcs",
    packSize: 1,
    packUnit: measureUoms.find((u) => u.name === "pcs")?.name ?? "pcs",
    category: db.expenseCategories.find((c) => c.name === "Other")?.name ?? db.expenseCategories[0]?.name ?? "Other",
  });

  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (!purchase) return [blankLine("1")];
    // a purchase's farm splits are per item, so they ride on that item's first line
    const seen = new Set<string>();
    return purchase.lines.map((l, idx) => {
      const item = db.items.find((i) => i.id === l.itemId);
      let splits: DraftSplit[] | undefined;
      if (l.itemId && !seen.has(l.itemId)) {
        seen.add(l.itemId);
        splits = (db.allocations ?? [])
          .filter((a) => a.purchaseId === purchase.id && a.itemId === l.itemId)
          .map((a, n) => ({ key: `${idx}-${n}`, farmId: a.farmId, quantity: String(a.quantity) }));
      }
      return {
        key: String(idx + 1),
        invoiceName: l.invoiceName,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        itemId: l.itemId,
        uom: l.uom ?? item?.packLabel ?? item?.unit ?? "pcs",
        packSize: l.packSize ?? (item ? packSizeOf(item) : 1),
        packUnit: l.packUnit ?? item?.unit ?? "pcs",
        category: l.category ?? item?.category ?? "Other",
        splits,
      };
    });
  });

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

  /** Link a line to a stock item and carry that item's usual pack, measure and category onto the line. */
  const linkItem = (key: string, item: InventoryItem | undefined) => {
    if (!item) {
      setLine(key, { itemId: undefined, splits: undefined });
      return;
    }
    setLine(key, {
      itemId: item.id,
      uom: item.packLabel ?? item.unit,
      packSize: packSizeOf(item),
      packUnit: item.unit,
      category: item.category,
    });
  };

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  /** Base units a stocked line brings in, and how much of it is already promised to farms. */
  const received = (l: DraftLine) => (l.itemId ? Number((l.quantity * l.packSize).toFixed(3)) : 0);
  const allocated = (l: DraftLine) => (l.splits ?? []).reduce((s, x) => s + (Number(x.quantity) || 0), 0);
  const overAllocated = lines.some((l) => l.itemId && allocated(l) > received(l) + 1e-9);

  const submit = () => {
    const valid = lines.filter((l) => l.invoiceName.trim() && l.quantity > 0 && l.packSize > 0);
    if (valid.length === 0 || overAllocated) return;

    const purchaseId = purchase?.id ?? newId("pu");
    const record: Purchase = {
      id: purchaseId,
      date: form.date,
      supplierId: form.supplierId,
      paidBy: form.paidBy,
      claimStatus:
        form.paidBy === "Own Pocket" ? (purchase?.paidBy === "Own Pocket" ? purchase.claimStatus : "To Claim") : undefined,
      receiptName: receipt?.name,
      receiptDataUrl: receipt?.dataUrl,
      notes: form.notes || undefined,
      lines: valid.map((l) => ({
        itemId: l.itemId,
        invoiceName: l.invoiceName.trim(),
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        uom: l.uom,
        packSize: l.packSize,
        packUnit: l.packUnit,
        category: l.category,
      })),
    };

    setDB((current) => {
      // editing = take the old record's stock and splits back out first, then apply the new one
      const prev = purchase ? reversePurchase(current, purchase) : current;
      const newAllocations: StockAllocation[] = [];
      const items = prev.items.map((item) => {
        const relevant = valid.filter((l) => l.itemId === item.id);
        if (relevant.length === 0) return item;
        const addedQty = relevant.reduce((s, l) => s + l.quantity * l.packSize, 0);
        const lastLine = relevant[relevant.length - 1];
        const unitCost = lastLine.unitPrice ? lastLine.unitPrice / lastLine.packSize : item.lastCostPerUnit;
        const farmStock = { ...(item.farmStock ?? {}) };
        for (const l of relevant)
          for (const sp of l.splits ?? []) {
            const q = Number(sp.quantity) || 0;
            if (!sp.farmId || q <= 0) continue;
            farmStock[sp.farmId] = Number(((farmStock[sp.farmId] ?? 0) + q).toFixed(3));
            newAllocations.push({ id: newId("al"), date: form.date, itemId: item.id, farmId: sp.farmId, quantity: q, unitCost, purchaseId, kind: "purchase" });
          }
        const newAliases = [...item.aliases];
        for (const l of relevant) {
          const nm = l.invoiceName.trim();
          if (nm && !newAliases.some((a) => a.supplierId === form.supplierId && a.aliasName.toLowerCase() === nm.toLowerCase()))
            newAliases.push({ supplierId: form.supplierId, aliasName: nm });
        }
        // remember the pack as bought, so the next purchase of this item starts from it
        const boughtInPack = packUoms.some((u) => u.name === lastLine.uom);
        return {
          ...item,
          stock: Number((item.stock + addedQty).toFixed(3)),
          farmStock,
          lastCostPerUnit: Number(unitCost.toFixed(4)),
          aliases: newAliases,
          ...(boughtInPack ? { packLabel: lastLine.uom, packSize: lastLine.packSize } : {}),
        };
      });
      return { ...prev, purchases: [...prev.purchases, record], items, allocations: [...(prev.allocations ?? []), ...newAllocations] };
    });
    onClose();
  };

  return (
    <>
      <Modal title={editing ? "Edit Purchase — receipt, items & stock" : "New Purchase — upload receipt, claim & update stock"} onClose={onClose} xwide>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Vendor">
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
                  {receipt.dataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={receipt.dataUrl} alt="Receipt preview" className="max-h-24 rounded border border-hairline" />
                  )}
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
              Line items — type the name as printed on the invoice, say how it was packed, then link it to a stock item (leave unlinked
              for one-time purchases)
            </p>
            <div className="hidden grid-cols-[minmax(0,2fr)_80px_130px_170px_110px_28px] gap-2 px-1 pb-1 text-[11px] font-medium tracking-wide text-muted lg:grid">
              <span>Name on invoice</span>
              <span>Qty</span>
              <span>UoM</span>
              <span>Pack size per UoM</span>
              <span>Unit price (RM / UoM)</span>
              <span />
            </div>
            <div className="space-y-3">
              {lines.map((l) => {
                const item = db.items.find((i) => i.id === l.itemId);
                return (
                  <div key={l.key} className="rounded-xl border border-hairline bg-surface-2 p-3">
                    <div className="grid grid-cols-2 items-center gap-2 lg:grid-cols-[minmax(0,2fr)_80px_130px_170px_110px_28px]">
                      <input
                        value={l.invoiceName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLine(l.key, { invoiceName: v });
                          if (!l.itemId) {
                            const s = suggestItem(v);
                            const found = s ? db.items.find((i) => i.id === s) : undefined;
                            if (found) linkItem(l.key, found);
                          }
                        }}
                        placeholder="Name on invoice"
                        className={`${lineClass} col-span-2 lg:col-span-1`}
                      />
                      <input
                        type="number"
                        value={l.quantity || ""}
                        onChange={(e) => setLine(l.key, { quantity: Number(e.target.value) || 0 })}
                        placeholder="Qty"
                        className={`${lineClass} tnum`}
                      />
                      <select
                        value={l.uom}
                        onChange={(e) => setLine(l.key, { uom: e.target.value })}
                        className={lineClass}
                        aria-label="Unit of measure"
                      >
                        {packUoms.map((u) => (
                          <option key={u.id}>{u.name}</option>
                        ))}
                        {measureUoms.map((u) => (
                          <option key={u.id}>{u.name}</option>
                        ))}
                        {![...packUoms, ...measureUoms].some((u) => u.name === l.uom) && <option>{l.uom}</option>}
                      </select>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          value={l.packSize || ""}
                          onChange={(e) => setLine(l.key, { packSize: Number(e.target.value) || 0 })}
                          placeholder="Size"
                          className={`${lineClass} w-full min-w-0 tnum`}
                          aria-label="Pack size"
                        />
                        <select
                          value={l.packUnit}
                          onChange={(e) => setLine(l.key, { packUnit: e.target.value })}
                          disabled={Boolean(item)}
                          title={item ? `Stock for ${item.name} is counted in ${item.unit}` : undefined}
                          className={`${lineClass} w-20 shrink-0 disabled:opacity-70`}
                          aria-label="Pack measure"
                        >
                          {measureUoms.map((u) => (
                            <option key={u.id}>{u.name}</option>
                          ))}
                          {!measureUoms.some((u) => u.name === l.packUnit) && <option>{l.packUnit}</option>}
                        </select>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={l.unitPrice || ""}
                        onChange={(e) => setLine(l.key, { unitPrice: Number(e.target.value) || 0 })}
                        placeholder="RM"
                        className={`${lineClass} tnum`}
                      />
                      <button
                        onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                        className="text-muted hover:text-critical"
                        aria-label="Remove line"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={l.category}
                        onChange={(e) => setLine(l.key, { category: e.target.value })}
                        className={lineClass}
                        aria-label="Expense category"
                      >
                        {db.expenseCategories.map((c) => (
                          <option key={c.id}>{c.name}</option>
                        ))}
                        {!db.expenseCategories.some((c) => c.name === l.category) && <option>{l.category}</option>}
                      </select>
                      <select
                        value={l.itemId ?? ""}
                        onChange={(e) => linkItem(l.key, db.items.find((i) => i.id === e.target.value))}
                        className={`${lineClass} min-w-48 flex-1`}
                        aria-label="Stock item"
                      >
                        <option value="">One-time — do not stock</option>
                        {db.items.map((i) => (
                          <option key={i.id} value={i.id}>→ {i.name}</option>
                        ))}
                      </select>
                      <button onClick={() => setItemForm({ lineKey: l.key })} className="text-xs font-medium text-accent hover:underline">
                        + New item
                      </button>
                      {item && (
                        <button onClick={() => setItemForm({ lineKey: l.key, item })} className="text-xs font-medium text-accent hover:underline">
                          Edit item
                        </button>
                      )}
                      <span className="ml-auto text-xs text-muted tnum">
                        {l.packSize > 0 && l.quantity > 0
                          ? `${l.quantity} ${l.uom} × ${l.packSize} ${l.packUnit} = ${(l.quantity * l.packSize).toLocaleString()} ${l.packUnit}`
                          : ""}
                        {l.packSize > 0 && l.unitPrice > 0 ? ` · ${fmtRM(l.unitPrice / l.packSize)}/${l.packUnit}` : ""}
                      </span>
                    </div>

                    {!item && l.invoiceName.trim() && (
                      <p className="mt-2 text-xs text-muted">
                        Not linked to a stock item — pick one above (→) or add a new item to put it in inventory and split it between farms.
                      </p>
                    )}
                    {item && (
                      <div className="mt-2 rounded-xl border border-hairline bg-surface p-3 text-xs">
                        <p className="text-ink-2">
                          Stock received: <span className="font-medium text-ink">{received(l).toLocaleString()} {item.unit}</span>
                        </p>
                        {(l.splits ?? []).map((sp) => (
                          <div key={sp.key} className="mt-2 flex items-center gap-2">
                            <select
                              value={sp.farmId}
                              onChange={(e) => setLine(l.key, { splits: (l.splits ?? []).map((x) => (x.key === sp.key ? { ...x, farmId: e.target.value } : x)) })}
                              className="rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-xs"
                            >
                              {db.farms.map((f) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={sp.quantity}
                              onChange={(e) => setLine(l.key, { splits: (l.splits ?? []).map((x) => (x.key === sp.key ? { ...x, quantity: e.target.value } : x)) })}
                              placeholder={item.unit}
                              className="w-24 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-xs tnum"
                            />
                            <span className="text-muted">{item.unit}</span>
                            <button
                              onClick={() => setLine(l.key, { splits: (l.splits ?? []).filter((x) => x.key !== sp.key) })}
                              className="text-muted hover:text-critical"
                              aria-label="Remove farm split"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <p className="mt-2 font-medium text-ink-2">Split between farms (optional — whatever you don&apos;t split stays in Main):</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <button
                            onClick={() =>
                              setLine(l.key, {
                                splits: [
                                  ...(l.splits ?? []),
                                  { key: String(Date.now()), farmId: db.farms.find((f) => !(l.splits ?? []).some((x) => x.farmId === f.id))?.id ?? db.farms[0]?.id ?? "", quantity: "" },
                                ],
                              })
                            }
                            className="text-accent hover:underline"
                          >
                            + Add a farm
                          </button>
                          <span className={allocated(l) > received(l) + 1e-9 ? "font-medium text-critical" : "text-muted"}>
                            Allocated {allocated(l).toLocaleString()} {item.unit} · balance in Main{" "}
                            {(received(l) - allocated(l)).toLocaleString()} {item.unit}
                            {allocated(l) > received(l) + 1e-9 ? " — more than received" : ""}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setLines([...lines, blankLine(String(Date.now()))])}
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
                Will be filed as a claim ({fmtRM(total)}) against the company{editing ? "" : ", status “To Claim”"}.
              </p>
            )}
            {overAllocated && <p className="mt-1 text-xs text-critical">A farm split is larger than the quantity received — fix it before saving.</p>}
            {lines.some((l) => l.itemId) && (
              <p className="mt-1 text-xs text-good">
                Stock will be {editing ? "recalculated" : "increased"} for: {lines.filter((l) => l.itemId).map((l) => db.items.find((i) => i.id === l.itemId)?.name).join(", ")}
              </p>
            )}
          </div>

          <Field label="Notes">
            <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit}>{editing ? "Save changes" : "Save Purchase"}</Button>
          </div>
        </div>
      </Modal>

      {itemForm && (
        <ItemForm
          item={itemForm.item}
          onClose={() => setItemForm(null)}
          onSaved={(saved) => linkItem(itemForm.lineKey, saved)}
        />
      )}
    </>
  );
}

/** Hand part of an already-saved purchase to farms - for splitting later, or for purchases made before splitting existed. */
function SplitPurchaseForm({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const { db, setDB } = useStore();
  const itemIds = [...new Set(purchase.lines.map((l) => l.itemId).filter(Boolean) as string[])];
  const [splits, setSplits] = useState<Record<string, DraftSplit[]>>(() => {
    const first = db.farms[0]?.id ?? "";
    return Object.fromEntries(itemIds.map((id) => [id, [{ key: `${id}-1`, farmId: first, quantity: "" }]]));
  });

  const rows = itemIds.map((id) => {
    const item = db.items.find((i) => i.id === id)!;
    const received = purchase.lines.filter((l) => l.itemId === id).reduce((s, l) => s + lineBaseQty(l, item), 0);
    const given = (db.allocations ?? []).filter((a) => a.purchaseId === purchase.id && a.itemId === id).reduce((s, a) => s + a.quantity, 0);
    const available = Math.max(0, Math.min(received - given, mainBalance(item)));
    const draft = (splits[id] ?? []).reduce((s, x) => s + (Number(x.quantity) || 0), 0);
    return { id, item, received, given, available, draft };
  });
  const invalid = rows.some((r) => r.draft > r.available + 1e-9);
  const nothing = rows.every((r) => r.draft <= 0);

  const setRow = (id: string, next: DraftSplit[]) => setSplits((s) => ({ ...s, [id]: next }));

  const submit = () => {
    if (invalid || nothing) return;
    const date = TODAY.toISOString().slice(0, 10);
    setDB((prev) => {
      const added: StockAllocation[] = [];
      const items = prev.items.map((item) => {
        const mine = (splits[item.id] ?? []).filter((x) => x.farmId && Number(x.quantity) > 0);
        if (mine.length === 0) return item;
        const farmStock = { ...(item.farmStock ?? {}) };
        for (const x of mine) {
          const q = Number(x.quantity);
          farmStock[x.farmId] = Number(((farmStock[x.farmId] ?? 0) + q).toFixed(3));
          added.push({ id: newId("al"), date, itemId: item.id, farmId: x.farmId, quantity: q, unitCost: item.lastCostPerUnit, purchaseId: purchase.id, kind: "purchase" });
        }
        return { ...item, farmStock };
      });
      return { ...prev, items, allocations: [...(prev.allocations ?? []), ...added] };
    });
    onClose();
  };

  return (
    <Modal title="Split this purchase between farms" onClose={onClose} wide>
      <div className="space-y-5">
        {rows.map(({ id, item, received, given, available, draft }) => (
          <div key={id} className="rounded-xl border border-hairline p-4">
            <p className="font-medium text-ink">{item.name}</p>
            <p className="mt-1 text-xs text-muted">
              Received {received.toLocaleString()} {item.unit} · already split {given.toLocaleString()} {item.unit} · can still split{" "}
              <span className="font-medium text-ink-2">{available.toLocaleString()} {item.unit}</span> (Main holds {mainBalance(item).toLocaleString()} {item.unit})
            </p>
            {(splits[id] ?? []).map((sp) => (
              <div key={sp.key} className="mt-3 flex items-center gap-2">
                <select
                  value={sp.farmId}
                  onChange={(e) => setRow(id, (splits[id] ?? []).map((x) => (x.key === sp.key ? { ...x, farmId: e.target.value } : x)))}
                  className="rounded-lg border border-hairline bg-surface px-2 py-2 text-sm"
                >
                  {db.farms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={sp.quantity}
                  onChange={(e) => setRow(id, (splits[id] ?? []).map((x) => (x.key === sp.key ? { ...x, quantity: e.target.value } : x)))}
                  placeholder={item.unit}
                  className="w-28 rounded-lg border border-hairline bg-surface px-2 py-2 text-sm tnum"
                />
                <span className="text-sm text-muted">{item.unit}</span>
                <button
                  onClick={() => setRow(id, (splits[id] ?? []).filter((x) => x.key !== sp.key))}
                  className="text-muted hover:text-critical"
                  aria-label="Remove farm split"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between gap-2 text-xs">
              <button
                onClick={() =>
                  setRow(id, [
                    ...(splits[id] ?? []),
                    { key: `${id}-${Date.now()}`, farmId: db.farms.find((f) => !(splits[id] ?? []).some((x) => x.farmId === f.id))?.id ?? db.farms[0]?.id ?? "", quantity: "" },
                  ])
                }
                className="text-accent hover:underline"
              >
                + Add a farm
              </button>
              <span className={draft > available + 1e-9 ? "font-medium text-critical" : "text-muted"}>
                Splitting {draft.toLocaleString()} {item.unit} · {Math.max(0, available - draft).toLocaleString()} {item.unit} stays in Main
                {draft > available + 1e-9 ? " — more than available" : ""}
              </span>
            </div>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save split</Button>
        </div>
      </div>
    </Modal>
  );
}
