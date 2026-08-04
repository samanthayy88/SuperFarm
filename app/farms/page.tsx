"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Table, Th, Td, Button, Modal, Field, TextInput, Select, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { Farm, Plot } from "@/lib/types";

export default function FarmsPage() {
  const { db } = useStore();
  const [showFarmForm, setShowFarmForm] = useState(false);
  const [plotFormFarm, setPlotFormFarm] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Farms & Plots"
        subtitle="Each farm with its plots, crops and the worker managing each plot"
        actions={<Button onClick={() => setShowFarmForm(true)}>+ Add Farm</Button>}
      />

      <div className="space-y-4">
        {db.farms.map((farm) => {
          const plots = db.plots.filter((p) => p.farmId === farm.id);
          const contract = db.contracts.find((c) => c.farmId === farm.id);
          return (
            <Card
              key={farm.id}
              title={`${farm.name} — ${farm.location} (${farm.sizeAcres} acres)`}
              actions={<Button small variant="ghost" onClick={() => setPlotFormFarm(farm.id)}>+ Add Plot</Button>}
            >
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
                <span>
                  <span className="text-muted">Partners:</span> {farm.partners.join(", ")}
                </span>
                {contract && (
                  <span>
                    <span className="text-muted">Landlord:</span> {contract.landlord}
                  </span>
                )}
                {farm.notes && <span className="text-muted italic">{farm.notes}</span>}
              </div>
              {plots.length === 0 ? (
                <EmptyState message="No plots yet." />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Plot</Th>
                      <Th right>Size</Th>
                      <Th>Crop</Th>
                      <Th>Managed by</Th>
                      <Th>Planted</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {plots.map((p) => {
                      const crop = db.crops.find((c) => c.id === p.cropId)?.name ?? "—";
                      const worker = db.workers.find((w) => w.id === p.workerId)?.name ?? "—";
                      return (
                        <tr key={p.id}>
                          <Td className="font-medium">{p.name}</Td>
                          <Td right>{p.sizeAcres} ac</Td>
                          <Td>{crop}</Td>
                          <Td>{worker}</Td>
                          <Td>{fmtDate(p.plantedDate)}</Td>
                          <Td>
                            <Badge tone={p.status === "Active" ? "good" : p.status === "Preparing" ? "accent" : "neutral"}>
                              {p.status}
                            </Badge>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card>
          );
        })}
      </div>

      {showFarmForm && <FarmForm onClose={() => setShowFarmForm(false)} />}
      {plotFormFarm && <PlotForm farmId={plotFormFarm} onClose={() => setPlotFormFarm(null)} />}
    </div>
  );
}

function FarmForm({ onClose }: { onClose: () => void }) {
  const { update } = useStore();
  const [form, setForm] = useState({ name: "", location: "", sizeAcres: "", partners: "" });

  const submit = () => {
    if (!form.name) return;
    const farm: Farm = {
      id: newId("f"),
      name: form.name,
      location: form.location,
      sizeAcres: Number(form.sizeAcres) || 0,
      partners: form.partners ? form.partners.split(",").map((s) => s.trim()) : ["Self (100%)"],
    };
    update("farms", (list) => [...list, farm]);
    onClose();
  };

  return (
    <Modal title="Add Farm" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Farm name">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sungai Ruan Farm" />
        </Field>
        <Field label="Location">
          <TextInput value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Town, State" />
        </Field>
        <Field label="Size (acres)">
          <TextInput type="number" value={form.sizeAcres} onChange={(e) => setForm({ ...form, sizeAcres: e.target.value })} />
        </Field>
        <Field label="Partners (comma separated, e.g. Self (60%), Mr. Tan (40%))">
          <TextInput value={form.partners} onChange={(e) => setForm({ ...form, partners: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Farm</Button>
        </div>
      </div>
    </Modal>
  );
}

function PlotForm({ farmId, onClose }: { farmId: string; onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    name: "",
    sizeAcres: "",
    cropId: db.crops[0]?.id ?? "",
    workerId: db.workers[0]?.id ?? "",
    plantedDate: new Date().toISOString().slice(0, 10),
    status: "Preparing" as Plot["status"],
  });

  const submit = () => {
    if (!form.name) return;
    const plot: Plot = {
      id: newId("p"),
      farmId,
      name: form.name,
      sizeAcres: Number(form.sizeAcres) || 0,
      cropId: form.cropId,
      workerId: form.workerId,
      plantedDate: form.plantedDate,
      status: form.status,
    };
    update("plots", (list) => [...list, plot]);
    onClose();
  };

  const farmName = db.farms.find((f) => f.id === farmId)?.name;

  return (
    <Modal title={`Add Plot — ${farmName}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Plot name">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Plot D" />
        </Field>
        <Field label="Size (acres)">
          <TextInput type="number" value={form.sizeAcres} onChange={(e) => setForm({ ...form, sizeAcres: e.target.value })} />
        </Field>
        <Field label="Crop">
          <Select value={form.cropId} onChange={(e) => setForm({ ...form, cropId: e.target.value })}>
            {db.crops.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Managed by worker">
          <Select value={form.workerId} onChange={(e) => setForm({ ...form, workerId: e.target.value })}>
            {db.workers.filter((w) => w.active).map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Planted / planned date">
          <TextInput type="date" value={form.plantedDate} onChange={(e) => setForm({ ...form, plantedDate: e.target.value })} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Plot["status"] })}>
            <option>Preparing</option>
            <option>Active</option>
            <option>Fallow</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Plot</Button>
        </div>
      </div>
    </Modal>
  );
}
