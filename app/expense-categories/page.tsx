"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Table, Th, Td, Button, Modal, Field, TextInput, EmptyState, ConfirmDialog, Badge } from "@/components/ui";
import { ExpenseCategory, InventoryItem } from "@/lib/types";
import ItemForm from "@/components/ItemForm";

export default function ExpenseCategoriesPage() {
  const { db } = useStore();
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; cat: ExpenseCategory } | null>(null);
  const [del, setDel] = useState<ExpenseCategory | null>(null);
  const [subForm, setSubForm] = useState<{ category: string; item?: InventoryItem } | null>(null);

  const usage = (c: ExpenseCategory) => {
    const items = db.items.filter((i) => i.category === c.name).length;
    const lines = db.purchases.reduce((n, p) => n + p.lines.filter((l) => l.category === c.name).length, 0);
    return { items, lines, total: items + lines };
  };

  return (
    <div>
      <PageHeader
        title="Expense Category"
        subtitle="Categories and their sub-categories. A sub-category is the standard product — pick it on a purchase or spray round and the same product is recorded whatever name the supplier prints on the invoice"
        actions={<Button onClick={() => setForm({ mode: "add" })}>+ Add Category</Button>}
      />
      <Card>
        {db.expenseCategories.length === 0 ? (
          <EmptyState message="No categories yet. Use “+ Add Category” to create one." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th>Sub-categories (standard products)</Th>
                <Th>Costing</Th>
                <Th right>Used in</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {db.expenseCategories.map((c) => {
                const use = usage(c);
                return (
                  <tr key={c.id}>
                    <Td className="font-medium text-ink">{c.name}</Td>
                    <Td>
                      <div className="flex w-[28rem] max-w-full flex-wrap items-center gap-1.5">
                        {db.items.filter((i) => i.category === c.name).map((i) => (
                          <button
                            key={i.id}
                            onClick={() => setSubForm({ category: c.name, item: i })}
                            title="Edit sub-category"
                            className="rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-accent/40 hover:text-accent"
                          >
                            {i.name}
                          </button>
                        ))}
                        <button
                          onClick={() => setSubForm({ category: c.name })}
                          className="rounded-full px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
                        >
                          + Add sub-category
                        </button>
                      </div>
                    </Td>
                    <Td>
                      {c.durable ? (
                        <Badge tone="accent">Charged when given to a farm</Badge>
                      ) : (
                        <Badge tone="neutral">Charged when used</Badge>
                      )}
                    </Td>
                    <Td right>{use.total === 0 ? <span className="text-muted">Not used</span> : `${use.items} item(s) · ${use.lines} purchase line(s)`}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setForm({ mode: "edit", cat: c })}
                          className="rounded-full border border-hairline px-3 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDel(c)}
                          className="rounded-full px-3 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
                        >
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {form && <CategoryForm cat={form.mode === "edit" ? form.cat : undefined} onClose={() => setForm(null)} />}
      {subForm && <ItemForm item={subForm.item} presetCategory={subForm.category} onClose={() => setSubForm(null)} />}
      {del && <DeleteCategory cat={del} inUse={usage(del).total} onClose={() => setDel(null)} />}
    </div>
  );
}

function CategoryForm({ cat, onClose }: { cat?: ExpenseCategory; onClose: () => void }) {
  const { db, setDB } = useStore();
  const [name, setName] = useState(cat?.name ?? "");
  const [durable, setDurable] = useState(cat?.durable ?? false);
  const trimmed = name.trim();
  const duplicate = db.expenseCategories.some((c) => c.id !== cat?.id && c.name.toLowerCase() === trimmed.toLowerCase());

  const submit = () => {
    if (!trimmed || duplicate) return;
    setDB((prev) => {
      if (!cat) return { ...prev, expenseCategories: [...prev.expenseCategories, { id: newId("ec"), name: trimmed, durable }] };
      const old = cat.name;
      return {
        ...prev,
        expenseCategories: prev.expenseCategories.map((c) => (c.id === cat.id ? { ...c, name: trimmed, durable } : c)),
        items: old === trimmed ? prev.items : prev.items.map((i) => (i.category === old ? { ...i, category: trimmed } : i)),
        purchases:
          old === trimmed
            ? prev.purchases
            : prev.purchases.map((p) => ({ ...p, lines: p.lines.map((l) => (l.category === old ? { ...l, category: trimmed } : l)) })),
      };
    });
    onClose();
  };

  return (
    <Modal title={cat ? `Edit ${cat.name}` : "Add Expense Category"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Category name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Irrigation parts" />
        </Field>
        <label className="flex items-start gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={durable} onChange={(e) => setDurable(e.target.checked)} className="mt-1" />
          <span>
            Not used up (tools, netting, crates). Its cost is charged to a farm when you give it stock, instead of when it is used.
          </span>
        </label>
        {duplicate && <p className="text-xs text-critical">A category with this name already exists.</p>}
        {cat && <p className="text-xs text-muted">Renaming updates every stock item and purchase line in this category.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{cat ? "Save changes" : "Add Category"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteCategory({ cat, inUse, onClose }: { cat: ExpenseCategory; inUse: number; onClose: () => void }) {
  const { update } = useStore();
  if (inUse > 0)
    return (
      <Modal title={`Can't delete “${cat.name}”`} onClose={onClose}>
        <p className="text-sm text-ink-2">
          It is used by {inUse} stock item(s) or purchase line(s). Rename it, or move those to another category first.
        </p>
        <div className="mt-4 flex justify-end">
          <Button onClick={onClose}>OK</Button>
        </div>
      </Modal>
    );
  return (
    <ConfirmDialog
      title={`Delete “${cat.name}”?`}
      message="It isn't used anywhere, so nothing else changes. It will disappear from the dropdowns."
      confirmLabel="Delete category"
      onConfirm={() => {
        update("expenseCategories", (list) => list.filter((c) => c.id !== cat.id));
        onClose();
      }}
      onClose={onClose}
    />
  );
}
