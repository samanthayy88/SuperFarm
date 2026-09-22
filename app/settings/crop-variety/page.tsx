"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import {
  PageHeader,
  Card,
  Table,
  Th,
  Td,
  Button,
  Modal,
  Field,
  TextInput,
  EmptyState,
  ConfirmDialog,
} from "@/components/ui";
import { Crop, Variety } from "@/lib/types";

export default function CropVarietyPage() {
  const { db, update, setDB } = useStore();
  const [cropForm, setCropForm] = useState<{ mode: "add" } | { mode: "edit"; crop: Crop } | null>(null);
  const [deleteCrop, setDeleteCrop] = useState<Crop | null>(null);
  const [varietyForm, setVarietyForm] = useState<
    { cropId: string; mode: "add" } | { cropId: string; mode: "edit"; variety: Variety } | null
  >(null);
  const [deleteVariety, setDeleteVariety] = useState<Variety | null>(null);

  const cropImpacts = (crop: Crop) => {
    const rows: string[] = [];
    const add = (n: number, one: string, many = one + "s") => n > 0 && rows.push(`${n} ${n === 1 ? one : many}`);
    add(db.varieties.filter((v) => v.cropId === crop.id).length, "variety", "varieties");
    return rows;
  };

  const cropUsage = (crop: Crop) => {
    const rows: string[] = [];
    const add = (n: number, label: string) => n > 0 && rows.push(`${n} ${label}`);
    add(db.plots.filter((p) => p.cropId === crop.id).length, "plot(s) currently growing this crop");
    add(db.harvests.filter((h) => h.cropId === crop.id).length, "harvest record(s)");
    add(db.sales.filter((s) => s.cropId === crop.id).length, "sale record(s)");
    add(db.commissionSettings.filter((c) => c.cropId === crop.id).length, "worker commission setting(s)");
    add(db.harvestTargets.filter((t) => t.cropId === crop.id).length, "harvest target(s)");
    return rows;
  };

  const doDeleteCrop = (crop: Crop) => {
    setDB((prev) => ({
      ...prev,
      crops: prev.crops.filter((c) => c.id !== crop.id),
      varieties: prev.varieties.filter((v) => v.cropId !== crop.id),
    }));
    setDeleteCrop(null);
  };

  const doDeleteVariety = (v: Variety) => {
    update("varieties", (list) => list.filter((x) => x.id !== v.id));
    setDeleteVariety(null);
  };

  const usage = deleteCrop ? cropUsage(deleteCrop) : [];

  return (
    <div>
      <PageHeader
        title="Crop & Variety"
        subtitle="Crops and their varieties, used in dropdowns across the dashboard"
        actions={<Button onClick={() => setCropForm({ mode: "add" })}>+ Add Crop</Button>}
      />

      <div className="space-y-4">
        {db.crops.length === 0 && (
          <Card>
            <EmptyState message="No crops yet. Use “+ Add Crop” to add your first one." />
          </Card>
        )}

        {db.crops.map((crop) => {
          const varieties = db.varieties.filter((v) => v.cropId === crop.id);
          return (
            <Card
              key={crop.id}
              title={crop.name}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button small variant="ghost" onClick={() => setVarietyForm({ cropId: crop.id, mode: "add" })}>
                    + Add Variety
                  </Button>
                  <Button small variant="ghost" onClick={() => setCropForm({ mode: "edit", crop })}>
                    Edit
                  </Button>
                  <Button small variant="danger" onClick={() => setDeleteCrop(crop)}>
                    Delete
                  </Button>
                </div>
              }
            >
              <p className="mb-3 text-sm text-ink-2">
                Default commission: <span className="font-medium text-ink">RM {crop.commissionRatePerKg.toFixed(2)}/kg</span>
                <span className="ml-1 text-xs text-muted">(workers without a specific setting earn this rate)</span>
              </p>

              {varieties.length === 0 ? (
                <EmptyState message="No varieties yet." />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Variety</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {varieties.map((v) => (
                      <tr key={v.id}>
                        <Td className="font-medium text-ink">{v.name}</Td>
                        <Td>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setVarietyForm({ cropId: crop.id, mode: "edit", variety: v })}
                              className="rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteVariety(v)}
                              className="rounded-md px-2 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
                            >
                              Delete
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          );
        })}
      </div>

      {cropForm && (
        <CropForm crop={cropForm.mode === "edit" ? cropForm.crop : undefined} onClose={() => setCropForm(null)} />
      )}
      {varietyForm && (
        <VarietyForm
          cropId={varietyForm.cropId}
          variety={varietyForm.mode === "edit" ? varietyForm.variety : undefined}
          onClose={() => setVarietyForm(null)}
        />
      )}
      {deleteCrop && (
        <ConfirmDialog
          title={`Delete ${deleteCrop.name}?`}
          message={`“${deleteCrop.name}” will be removed from the crop list and dropdowns.${
            usage.length > 0
              ? ` It's still referenced by ${usage.join(", ")} — those records are kept as-is and will just show a blank crop.`
              : ""
          }`}
          impacts={cropImpacts(deleteCrop)}
          confirmLabel="Delete crop"
          onConfirm={() => doDeleteCrop(deleteCrop)}
          onClose={() => setDeleteCrop(null)}
        />
      )}
      {deleteVariety && (
        <ConfirmDialog
          title={`Delete “${deleteVariety.name}”?`}
          message="This variety will no longer appear in dropdowns. Records that already used it keep the name as-is."
          confirmLabel="Delete variety"
          onConfirm={() => doDeleteVariety(deleteVariety)}
          onClose={() => setDeleteVariety(null)}
        />
      )}
    </div>
  );
}

function CropForm({ crop, onClose }: { crop?: Crop; onClose: () => void }) {
  const { update } = useStore();
  const editing = Boolean(crop);
  const [form, setForm] = useState({
    name: crop?.name ?? "",
    commissionRatePerKg: crop ? String(crop.commissionRatePerKg) : "",
  });

  const submit = () => {
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), commissionRatePerKg: Number(form.commissionRatePerKg) || 0 };
    if (crop) {
      update("crops", (list) => list.map((c) => (c.id === crop.id ? { ...c, ...payload } : c)));
    } else {
      update("crops", (list) => [...list, { id: newId("c"), ...payload }]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? `Edit ${crop!.name}` : "Add Crop"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Crop name">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chili" />
        </Field>
        <Field label="Default commission rate (RM per kg)">
          <TextInput
            type="number"
            step="0.01"
            value={form.commissionRatePerKg}
            onChange={(e) => setForm({ ...form, commissionRatePerKg: e.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Save Crop"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function VarietyForm({ cropId, variety, onClose }: { cropId: string; variety?: Variety; onClose: () => void }) {
  const { update } = useStore();
  const editing = Boolean(variety);
  const [name, setName] = useState(variety?.name ?? "");

  const submit = () => {
    if (!name.trim()) return;
    if (variety) {
      update("varieties", (list) => list.map((v) => (v.id === variety.id ? { ...v, name: name.trim() } : v)));
    } else {
      update("varieties", (list) => [...list, { id: newId("vr"), cropId, name: name.trim() }]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? "Edit Variety" : "Add Variety"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Variety name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kulai Red" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Save Variety"}</Button>
        </div>
      </div>
    </Modal>
  );
}
