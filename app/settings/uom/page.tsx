"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Table, Th, Td, Button, Modal, Field, TextInput, Select, EmptyState, ConfirmDialog, Badge } from "@/components/ui";
import { UnitOfMeasure } from "@/lib/types";

export default function UomPage() {
  const { db } = useStore();
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; uom: UnitOfMeasure } | null>(null);
  const [del, setDel] = useState<UnitOfMeasure | null>(null);

  /** Where a unit's name is used: stock items and purchase lines. */
  const usage = (u: UnitOfMeasure) => {
    const items = db.items.filter((i) => i.unit === u.name || i.packLabel === u.name).length;
    const lines = db.purchases.reduce((n, p) => n + p.lines.filter((l) => l.uom === u.name || l.packUnit === u.name).length, 0);
    return { items, lines, total: items + lines };
  };

  return (
    <div>
      <PageHeader
        title="Units of Measure"
        subtitle="The units you pick on purchase lines and stock items — packs you buy (bag, bottle, roll) and measures stock is counted in (kg, L, pcs)"
        actions={<Button onClick={() => setForm({ mode: "add" })}>+ Add Unit</Button>}
      />
      <Card>
        {db.uoms.length === 0 ? (
          <EmptyState message="No units yet. Use “+ Add Unit” to create one." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Unit</Th>
                <Th>Type</Th>
                <Th right>Used in</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {db.uoms.map((u) => {
                const use = usage(u);
                return (
                  <tr key={u.id}>
                    <Td className="font-medium text-ink">{u.name}</Td>
                    <Td>
                      <Badge tone={u.kind === "pack" ? "accent" : "neutral"}>{u.kind === "pack" ? "Pack (what you buy)" : "Measure (kg / L / pcs)"}</Badge>
                    </Td>
                    <Td right>{use.total === 0 ? <span className="text-muted">Not used</span> : `${use.items} item(s) · ${use.lines} purchase line(s)`}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setForm({ mode: "edit", uom: u })}
                          className="rounded-full border border-hairline px-3 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDel(u)}
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
      {form && <UomForm uom={form.mode === "edit" ? form.uom : undefined} onClose={() => setForm(null)} />}
      {del && <DeleteUom uom={del} inUse={usage(del).total} onClose={() => setDel(null)} />}
    </div>
  );
}

function UomForm({ uom, onClose }: { uom?: UnitOfMeasure; onClose: () => void }) {
  const { db, setDB } = useStore();
  const [name, setName] = useState(uom?.name ?? "");
  const [kind, setKind] = useState<UnitOfMeasure["kind"]>(uom?.kind ?? "pack");
  const trimmed = name.trim();
  const duplicate = db.uoms.some((u) => u.id !== uom?.id && u.name.toLowerCase() === trimmed.toLowerCase());

  const submit = () => {
    if (!trimmed || duplicate) return;
    setDB((prev) => {
      if (!uom) return { ...prev, uoms: [...prev.uoms, { id: newId("u"), name: trimmed, kind }] };
      const old = uom.name;
      // a rename flows through to every item and purchase line that used the old name
      return {
        ...prev,
        uoms: prev.uoms.map((u) => (u.id === uom.id ? { ...u, name: trimmed, kind } : u)),
        items:
          old === trimmed
            ? prev.items
            : prev.items.map((i) => ({ ...i, unit: i.unit === old ? trimmed : i.unit, packLabel: i.packLabel === old ? trimmed : i.packLabel })),
        purchases:
          old === trimmed
            ? prev.purchases
            : prev.purchases.map((p) => ({
                ...p,
                lines: p.lines.map((l) => ({ ...l, uom: l.uom === old ? trimmed : l.uom, packUnit: l.packUnit === old ? trimmed : l.packUnit })),
              })),
      };
    });
    onClose();
  };

  return (
    <Modal title={uom ? `Edit ${uom.name}` : "Add Unit of Measure"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. sack, carton, kg" />
        </Field>
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as UnitOfMeasure["kind"])}>
            <option value="pack">Pack — what you buy (bag, bottle, box, roll)</option>
            <option value="measure">Measure — what stock is counted in (kg, L, pcs)</option>
          </Select>
        </Field>
        {duplicate && <p className="text-xs text-critical">A unit with this name already exists.</p>}
        {uom && <p className="text-xs text-muted">Renaming updates every stock item and purchase line that uses it.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{uom ? "Save changes" : "Add Unit"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteUom({ uom, inUse, onClose }: { uom: UnitOfMeasure; inUse: number; onClose: () => void }) {
  const { update } = useStore();
  if (inUse > 0)
    return (
      <Modal title={`Can't delete “${uom.name}”`} onClose={onClose}>
        <p className="text-sm text-ink-2">
          It is used by {inUse} stock item(s) or purchase line(s). Rename it instead, or change those records first.
        </p>
        <div className="mt-4 flex justify-end">
          <Button onClick={onClose}>OK</Button>
        </div>
      </Modal>
    );
  return (
    <ConfirmDialog
      title={`Delete “${uom.name}”?`}
      message="It isn't used anywhere, so nothing else changes. It will disappear from the dropdowns."
      confirmLabel="Delete unit"
      onConfirm={() => {
        update("uoms", (list) => list.filter((u) => u.id !== uom.id));
        onClose();
      }}
      onClose={onClose}
    />
  );
}
