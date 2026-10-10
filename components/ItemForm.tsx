"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { Modal, Field, TextInput, Select, Button, ConfirmDialog } from "@/components/ui";
import { InventoryItem } from "@/lib/types";
import { allocatedTotal, packSizeOf } from "@/lib/stock";

/** Add or edit a stock item. `onSaved` receives the saved item (used to link a purchase line to a new item). */
export default function ItemForm({
  item,
  presetCategory,
  onClose,
  onSaved,
}: {
  item?: InventoryItem;
  /** Category a new sub-category starts in (when added from a category or a purchase line). */
  presetCategory?: string;
  onClose: () => void;
  onSaved?: (item: InventoryItem) => void;
}) {
  const { db, update } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const measures = db.uoms.filter((u) => u.kind === "measure");
  const packs = db.uoms.filter((u) => u.kind === "pack");
  const categories = db.expenseCategories;
  const [form, setForm] = useState({
    name: item?.name ?? "",
    category: item?.category ?? presetCategory ?? categories[0]?.name ?? "Other",
    unit: item?.unit ?? measures[0]?.name ?? "kg",
    packLabel: item?.packLabel ?? "",
    packSize: item ? String(packSizeOf(item)) : "1",
    minStock: item ? String(item.minStock) : "0",
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
      packLabel: form.packLabel || undefined,
      packSize: size,
      minStock: Number(form.minStock) || 0,
      trackInventory: true,
    };
    if (item) {
      const saved: InventoryItem = { ...item, ...payload, stock: newStock };
      update("items", (list) => list.map((i) => (i.id === item.id ? saved : i)));
      onSaved?.(saved);
    } else {
      const saved: InventoryItem = { id: newId("i"), stock: 0, lastCostPerUnit: 0, aliases: [], farmStock: {}, ...payload };
      update("items", (list) => [...list, saved]);
      onSaved?.(saved);
    }
    onClose();
  };

  return (
    <Modal title={item ? `Edit ${item.name}` : "Add Sub-category"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Sub-category name (the standard product, whatever the invoice calls it)">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. NPK 15-15-15" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expense category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
              {!categories.some((c) => c.name === form.category) && <option>{form.category}</option>}
            </Select>
          </Field>
          <Field label="Count stock in (smallest unit)">
            <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {measures.map((u) => (
                <option key={u.id}>{u.name}</option>
              ))}
              {!measures.some((u) => u.name === form.unit) && <option>{form.unit}</option>}
            </Select>
          </Field>
          <Field label="Usual pack (UoM)">
            <Select value={form.packLabel} onChange={(e) => setForm({ ...form, packLabel: e.target.value })}>
              <option value="">— none —</option>
              {packs.map((u) => (
                <option key={u.id}>{u.name}</option>
              ))}
              {form.packLabel && !packs.some((u) => u.name === form.packLabel) && <option>{form.packLabel}</option>}
            </Select>
          </Field>
          <Field label={`${form.unit} in one pack`}>
            <TextInput type="number" value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-muted">
          {size > 1
            ? `Buying 1 ${form.packLabel || "pack"} adds ${size} ${form.unit} to stock, and you can split it between farms in ${form.unit}. You can still change the pack size on each purchase line.`
            : `Stock is counted one ${form.unit} at a time.`}
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
        <div className="flex items-center justify-between gap-2 pt-2">
          {item ? (
            <button onClick={() => setConfirmDelete(true)} className="rounded-full px-3 py-1.5 text-xs text-critical transition-colors hover:bg-critical-soft">
              Delete sub-category
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit}>{item ? "Save changes" : "Add Sub-category"}</Button>
          </div>
        </div>
        {confirmDelete && item && (
          <DeleteItem
            item={item}
            onCancel={() => setConfirmDelete(false)}
            onDeleted={() => {
              update("items", (list) => list.filter((i) => i.id !== item.id));
              onClose();
            }}
          />
        )}
      </div>
    </Modal>
  );
}

/** Deleting a sub-category is only safe once nothing refers to it and no stock is left. */
function DeleteItem({ item, onCancel, onDeleted }: { item: InventoryItem; onCancel: () => void; onDeleted: () => void }) {
  const { db } = useStore();
  const lines = db.purchases.reduce((n, p) => n + p.lines.filter((l) => l.itemId === item.id).length, 0);
  const rounds = db.applications.filter((a) => a.products.some((p) => p.itemId === item.id)).length;
  const usage = db.usageLogs.filter((u) => u.itemId === item.id).length;
  const reasons: string[] = [];
  if (item.stock > 0) reasons.push(`${item.stock.toLocaleString()} ${item.unit} is still in stock`);
  if (lines) reasons.push(`${lines} purchase line(s) use it`);
  if (rounds) reasons.push(`${rounds} spray round(s) use it`);
  if (usage) reasons.push(`${usage} usage record(s) use it`);

  if (reasons.length > 0)
    return (
      <Modal title={`Can't delete “${item.name}”`} onClose={onCancel}>
        <p className="text-sm text-ink-2">It can only be removed when nothing refers to it: {reasons.join("; ")}.</p>
        <p className="mt-2 text-xs text-muted">Rename it, or point those records at a different sub-category first.</p>
        <div className="mt-4 flex justify-end">
          <Button onClick={onCancel}>OK</Button>
        </div>
      </Modal>
    );
  return (
    <ConfirmDialog
      title={`Delete “${item.name}”?`}
      message="Nothing uses this sub-category and no stock is held, so nothing else changes."
      confirmLabel="Delete sub-category"
      onConfirm={onDeleted}
      onClose={onCancel}
    />
  );
}
