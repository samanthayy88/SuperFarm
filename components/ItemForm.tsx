"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { Modal, Field, TextInput, Select, Button } from "@/components/ui";
import { InventoryItem } from "@/lib/types";
import { allocatedTotal, packSizeOf } from "@/lib/stock";

/** Add or edit a stock item. `onSaved` receives the saved item (used to link a purchase line to a new item). */
export default function ItemForm({
  item,
  onClose,
  onSaved,
}: {
  item?: InventoryItem;
  onClose: () => void;
  onSaved?: (item: InventoryItem) => void;
}) {
  const { db, update } = useStore();
  const measures = db.uoms.filter((u) => u.kind === "measure");
  const packs = db.uoms.filter((u) => u.kind === "pack");
  const categories = db.expenseCategories;
  const [form, setForm] = useState({
    name: item?.name ?? "",
    category: item?.category ?? categories[0]?.name ?? "Other",
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
    <Modal title={item ? `Edit ${item.name}` : "Add Stock Item"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Item name">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pruning scissors" />
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
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{item ? "Save changes" : "Add Item"}</Button>
        </div>
      </div>
    </Modal>
  );
}
