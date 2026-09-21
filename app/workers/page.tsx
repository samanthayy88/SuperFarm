"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import {
  PageHeader,
  Card,
  Badge,
  Table,
  Th,
  Td,
  Button,
  Modal,
  Field,
  TextInput,
  Select,
  EmptyState,
  ConfirmDialog,
  StatCard,
  Tabs,
} from "@/components/ui";
import { fmtRM, fmtDate, harvestTargetActualKg } from "@/lib/utils";
import { Worker, WorkerCommissionSetting, WorkerHarvestTarget } from "@/lib/types";
import GroupedBarChart, { GroupedBarDatum } from "@/components/GroupedBarChart";
import VarietySelect from "@/components/VarietySelect";

export default function WorkersPage() {
  const { db, setDB } = useStore();
  const [tab, setTab] = useState("Workers");
  const [workerForm, setWorkerForm] = useState<{ mode: "add" } | { mode: "edit"; worker: Worker } | null>(null);
  const [deleteWorker, setDeleteWorker] = useState<Worker | null>(null);

  const workerImpacts = (w: Worker) => {
    const rows: string[] = [];
    const add = (n: number, one: string, many = one + "s") =>
      n > 0 && rows.push(`${n} ${n === 1 ? one : many}`);
    add(db.workerExpenses.filter((e) => e.workerId === w.id).length, "expense record");
    add(db.commissionSettings.filter((c) => c.workerId === w.id).length, "commission setting");
    add(db.harvestTargets.filter((t) => t.workerId === w.id).length, "harvest target");
    return rows;
  };

  const doDeleteWorker = (w: Worker) => {
    setDB((prev) => ({
      ...prev,
      workers: prev.workers.filter((x) => x.id !== w.id),
      workerExpenses: prev.workerExpenses.filter((e) => e.workerId !== w.id),
      commissionSettings: prev.commissionSettings.filter((c) => c.workerId !== w.id),
      harvestTargets: prev.harvestTargets.filter((t) => t.workerId !== w.id),
    }));
    setDeleteWorker(null);
  };

  const activeWorkers = db.workers.filter((w) => w.active).length;
  const managedPlots = deleteWorker ? db.plots.filter((p) => p.workerId === deleteWorker.id).length : 0;

  return (
    <div>
      <PageHeader
        title="My Workers"
        subtitle="Worker profiles, harvest commission settings and harvest targets"
        actions={
          tab === "Workers" ? <Button onClick={() => setWorkerForm({ mode: "add" })}>+ Add Worker</Button> : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active workers" value={String(activeWorkers)} sub={`${db.workers.length} total`} />
        <StatCard label="Farms represented" value={String(new Set(db.workers.map((w) => w.farmId)).size)} />
        <StatCard
          label="Commission settings"
          value={String(db.commissionSettings.length)}
          sub="Worker-specific rates"
        />
        <StatCard label="Harvest targets" value={String(db.harvestTargets.length)} sub="Being tracked" />
      </div>

      <Tabs tabs={["Workers", "Commission Settings", "Harvest Targets"]} active={tab} onChange={setTab} />

      {tab === "Workers" &&
        (db.workers.length === 0 ? (
          <Card>
            <EmptyState message="No workers yet. Use “+ Add Worker” to add your first one." />
          </Card>
        ) : (
          <div className="space-y-4">
            {db.workers.map((w) => {
              const farm = db.farms.find((f) => f.id === w.farmId)?.name ?? "—";
              const plots = db.plots.filter((p) => p.workerId === w.id);
              return (
                <Card
                  key={w.id}
                  title={w.name}
                  actions={
                    <div className="flex gap-2">
                      <Button small variant="ghost" onClick={() => setWorkerForm({ mode: "edit", worker: w })}>
                        Edit
                      </Button>
                      <Button small variant="danger" onClick={() => setDeleteWorker(w)}>
                        Delete
                      </Button>
                    </div>
                  }
                >
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-ink-2">
                    <span>
                      <span className="text-muted">ID/Passport:</span> {w.idNumber || "—"}
                    </span>
                    {w.dob && (
                      <span>
                        <span className="text-muted">DOB:</span> {fmtDate(w.dob)}
                      </span>
                    )}
                    <span>
                      <span className="text-muted">Phone:</span> {w.phone || "—"}
                    </span>
                    <span>
                      <span className="text-muted">Nationality:</span> {w.nationality || "—"}
                    </span>
                    <span>
                      <span className="text-muted">Joined:</span> {fmtDate(w.joinDate)}
                    </span>
                    <span>
                      <span className="text-muted">Base salary:</span> {fmtRM(w.baseSalary)}
                    </span>
                    <span>
                      <span className="text-muted">Farm in charge:</span> {farm}
                    </span>
                    <span>
                      <span className="text-muted">Plot(s) in charge:</span>{" "}
                      {plots.length > 0
                        ? plots
                            .map((p) => `${db.farms.find((f) => f.id === p.farmId)?.name?.split(" ")[0]} ${p.name}`)
                            .join(", ")
                        : "—"}
                    </span>
                    {!w.active && <Badge tone="neutral">Inactive</Badge>}
                  </div>
                </Card>
              );
            })}
          </div>
        ))}

      {tab === "Commission Settings" && <CommissionSettingsTab />}
      {tab === "Harvest Targets" && <HarvestTargetsTab />}

      {workerForm && (
        <WorkerForm
          worker={workerForm.mode === "edit" ? workerForm.worker : undefined}
          onClose={() => setWorkerForm(null)}
        />
      )}
      {deleteWorker && (
        <ConfirmDialog
          title={`Delete ${deleteWorker.name}?`}
          message={`“${deleteWorker.name}” will be removed.${
            managedPlots > 0
              ? ` ${managedPlots} plot(s) currently list them as manager — you'll want to reassign those in Farms & Plots.`
              : ""
          } Harvest and schedule history under their name is kept for records.`}
          impacts={workerImpacts(deleteWorker)}
          confirmLabel="Delete worker"
          onConfirm={() => doDeleteWorker(deleteWorker)}
          onClose={() => setDeleteWorker(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------- worker form ------------------------------ */

function WorkerForm({ worker, onClose }: { worker?: Worker; onClose: () => void }) {
  const { db, update } = useStore();
  const editing = Boolean(worker);
  const [form, setForm] = useState({
    name: worker?.name ?? "",
    idNumber: worker?.idNumber ?? "",
    dob: worker?.dob ?? "",
    phone: worker?.phone ?? "",
    nationality: worker?.nationality ?? "",
    joinDate: worker?.joinDate ?? new Date().toISOString().slice(0, 10),
    baseSalary: worker ? String(worker.baseSalary) : "",
    farmId: worker?.farmId ?? db.farms[0]?.id ?? "",
    active: worker?.active ?? true,
  });

  const submit = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      idNumber: form.idNumber.trim(),
      dob: form.dob || undefined,
      phone: form.phone.trim(),
      nationality: form.nationality.trim(),
      joinDate: form.joinDate,
      baseSalary: Number(form.baseSalary) || 0,
      farmId: form.farmId,
      active: form.active,
    };
    if (worker) {
      update("workers", (list) => list.map((w) => (w.id === worker.id ? { ...w, ...payload } : w)));
    } else {
      update("workers", (list) => [...list, { id: newId("w"), ...payload }]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? `Edit ${worker!.name}` : "Add Worker"} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Full name">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="ID / Passport no.">
            <TextInput value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
          </Field>
          <Field label="Date of birth">
            <TextInput type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </Field>
          <Field label="Phone">
            <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Nationality">
            <TextInput value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
          </Field>
          <Field label="Join date">
            <TextInput type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
          </Field>
          <Field label="Base salary (RM/month)">
            <TextInput
              type="number"
              value={form.baseSalary}
              onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Farm in charge">
          <Select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })}>
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Active (included in payroll)
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Save Worker"}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------- commission settings ---------------------------- */

function CommissionSettingsTab() {
  const { db, update } = useStore();
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; setting: WorkerCommissionSetting } | null>(
    null
  );
  const [deleteSetting, setDeleteSetting] = useState<WorkerCommissionSetting | null>(null);

  const doDelete = (s: WorkerCommissionSetting) => {
    update("commissionSettings", (list) => list.filter((x) => x.id !== s.id));
    setDeleteSetting(null);
  };

  return (
    <Card
      title="Harvest commission settings"
      actions={
        <Button small onClick={() => setForm({ mode: "add" })}>
          + Add Setting
        </Button>
      }
    >
      {db.commissionSettings.length === 0 ? (
        <EmptyState message="No worker-specific commission settings yet. Workers earn the crop's default rate until one is added here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Worker</Th>
              <Th>Farm</Th>
              <Th>Plot</Th>
              <Th>Crop</Th>
              <Th>Variety</Th>
              <Th right>Rate (RM/kg)</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {db.commissionSettings.map((s) => {
              const worker = db.workers.find((w) => w.id === s.workerId)?.name ?? "—";
              const farm = db.farms.find((f) => f.id === s.farmId)?.name ?? "—";
              const plot = db.plots.find((p) => p.id === s.plotId)?.name ?? "—";
              const crop = db.crops.find((c) => c.id === s.cropId)?.name ?? "—";
              return (
                <tr key={s.id}>
                  <Td className="font-medium text-ink">{worker}</Td>
                  <Td>{farm}</Td>
                  <Td>{plot}</Td>
                  <Td>{crop}</Td>
                  <Td>{s.variety || <span className="text-muted">Any</span>}</Td>
                  <Td right>RM {s.ratePerKg.toFixed(2)}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setForm({ mode: "edit", setting: s })}
                        className="rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteSetting(s)}
                        className="rounded-md px-2 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
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

      {form && (
        <CommissionSettingForm setting={form.mode === "edit" ? form.setting : undefined} onClose={() => setForm(null)} />
      )}
      {deleteSetting && (
        <ConfirmDialog
          title="Delete this commission setting?"
          message="This worker will go back to earning the crop's default rate for this plot."
          confirmLabel="Delete setting"
          onConfirm={() => doDelete(deleteSetting)}
          onClose={() => setDeleteSetting(null)}
        />
      )}
    </Card>
  );
}

function CommissionSettingForm({
  setting,
  onClose,
}: {
  setting?: WorkerCommissionSetting;
  onClose: () => void;
}) {
  const { db, update } = useStore();
  const editing = Boolean(setting);
  const [form, setForm] = useState({
    workerId: setting?.workerId ?? db.workers[0]?.id ?? "",
    farmId: setting?.farmId ?? db.farms[0]?.id ?? "",
    plotId: setting?.plotId ?? "",
    cropId: setting?.cropId ?? db.crops[0]?.id ?? "",
    variety: setting?.variety ?? "",
    ratePerKg: setting ? String(setting.ratePerKg) : "",
  });

  const plotsForFarm = db.plots.filter((p) => p.farmId === form.farmId);
  const plotId = form.plotId && plotsForFarm.some((p) => p.id === form.plotId) ? form.plotId : plotsForFarm[0]?.id ?? "";

  const setFarm = (farmId: string) => {
    const firstPlot = db.plots.find((p) => p.farmId === farmId);
    setForm({ ...form, farmId, plotId: firstPlot?.id ?? "", variety: firstPlot?.variety ?? "" });
  };

  const setPlot = (id: string) => {
    const plot = db.plots.find((p) => p.id === id);
    setForm({ ...form, plotId: id, variety: plot?.variety ?? form.variety });
  };

  const submit = () => {
    if (!plotId || !form.ratePerKg) return;
    const payload = {
      workerId: form.workerId,
      farmId: form.farmId,
      plotId,
      cropId: form.cropId,
      variety: form.variety.trim() || undefined,
      ratePerKg: Number(form.ratePerKg) || 0,
    };
    if (setting) {
      update("commissionSettings", (list) => list.map((s) => (s.id === setting.id ? { ...s, ...payload } : s)));
    } else {
      update("commissionSettings", (list) => [...list, { id: newId("cs"), ...payload }]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? "Edit Commission Setting" : "Add Commission Setting"} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Worker">
            <Select value={form.workerId} onChange={(e) => setForm({ ...form, workerId: e.target.value })}>
              {db.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Crop">
            <Select value={form.cropId} onChange={(e) => setForm({ ...form, cropId: e.target.value })}>
              {db.crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Farm">
            <Select value={form.farmId} onChange={(e) => setFarm(e.target.value)}>
              {db.farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plot">
            <Select value={plotId} onChange={(e) => setPlot(e.target.value)}>
              {plotsForFarm.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Variety (blank = any variety)">
            <VarietySelect cropId={form.cropId} varieties={db.varieties} value={form.variety} onChange={(v) => setForm({ ...form, variety: v })} />
          </Field>
          <Field label="Rate (RM per kg)">
            <TextInput
              type="number"
              step="0.01"
              value={form.ratePerKg}
              onChange={(e) => setForm({ ...form, ratePerKg: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Save Setting"}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------- harvest targets ------------------------------ */

function HarvestTargetsTab() {
  const { db, update } = useStore();
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; target: WorkerHarvestTarget } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkerHarvestTarget | null>(null);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    farmId: "",
    plotId: "",
    cropId: "",
    variety: "",
    workerId: "",
  });

  const filtered = db.harvestTargets.filter((t) => {
    if (filters.startDate && t.endDate < filters.startDate) return false;
    if (filters.endDate && t.startDate > filters.endDate) return false;
    if (filters.farmId && t.farmId !== filters.farmId) return false;
    if (filters.plotId && t.plotId !== filters.plotId) return false;
    if (filters.cropId && t.cropId !== filters.cropId) return false;
    if (filters.variety && (t.variety ?? "").toLowerCase() !== filters.variety.trim().toLowerCase()) return false;
    if (filters.workerId && t.workerId !== filters.workerId) return false;
    return true;
  });

  const chartData: GroupedBarDatum[] = db.workers
    .map((w) => {
      const own = filtered.filter((t) => t.workerId === w.id);
      if (own.length === 0) return null;
      const target = own.reduce((s, t) => s + t.targetKg, 0);
      const actual = own.reduce((s, t) => s + harvestTargetActualKg(db, t), 0);
      return { label: w.name.replace(" (demo)", ""), values: [target, actual] };
    })
    .filter((d): d is GroupedBarDatum => d !== null);

  const plotsForFarmFilter = db.plots.filter((p) => !filters.farmId || p.farmId === filters.farmId);

  const doDelete = (t: WorkerHarvestTarget) => {
    update("harvestTargets", (list) => list.filter((x) => x.id !== t.id));
    setDeleteTarget(null);
  };

  return (
    <Card
      title="Harvest targets — target vs actual"
      actions={
        <Button small onClick={() => setForm({ mode: "add" })}>
          + Add Target
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Field label="From">
          <TextInput
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </Field>
        <Field label="To">
          <TextInput
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </Field>
        <Field label="Farm">
          <Select
            value={filters.farmId}
            onChange={(e) => setFilters({ ...filters, farmId: e.target.value, plotId: "" })}
          >
            <option value="">All farms</option>
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plot">
          <Select value={filters.plotId} onChange={(e) => setFilters({ ...filters, plotId: e.target.value })}>
            <option value="">All plots</option>
            {plotsForFarmFilter.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Crop">
          <Select value={filters.cropId} onChange={(e) => setFilters({ ...filters, cropId: e.target.value })}>
            <option value="">All crops</option>
            {db.crops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Variety">
          <VarietySelect
            cropId={filters.cropId}
            varieties={db.varieties}
            value={filters.variety}
            onChange={(v) => setFilters({ ...filters, variety: v })}
          />
        </Field>
        <Field label="Worker">
          <Select value={filters.workerId} onChange={(e) => setFilters({ ...filters, workerId: e.target.value })}>
            <option value="">All workers</option>
            {db.workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {chartData.length > 0 && (
        <div className="mb-5">
          <GroupedBarChart data={chartData} seriesNames={["Target", "Actual"]} formatValue={(v) => `${v.toLocaleString()} kg`} />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState message="No harvest targets match this filter." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Worker</Th>
              <Th>Date range</Th>
              <Th>Farm</Th>
              <Th>Plot</Th>
              <Th>Crop</Th>
              <Th>Variety</Th>
              <Th right>Target</Th>
              <Th right>Actual</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const worker = db.workers.find((w) => w.id === t.workerId)?.name ?? "—";
              const farm = db.farms.find((f) => f.id === t.farmId)?.name ?? "—";
              const plot = db.plots.find((p) => p.id === t.plotId)?.name ?? "—";
              const crop = db.crops.find((c) => c.id === t.cropId)?.name ?? "—";
              const actual = harvestTargetActualKg(db, t);
              const met = actual >= t.targetKg;
              const pct = t.targetKg > 0 ? Math.min(100, Math.round((actual / t.targetKg) * 100)) : 0;
              return (
                <tr key={t.id}>
                  <Td className="font-medium text-ink">{worker}</Td>
                  <Td className="text-xs">
                    {fmtDate(t.startDate)} → {fmtDate(t.endDate)}
                  </Td>
                  <Td>{farm}</Td>
                  <Td>{plot}</Td>
                  <Td>{crop}</Td>
                  <Td>{t.variety || <span className="text-muted">Any</span>}</Td>
                  <Td right>{t.targetKg.toLocaleString()} kg</Td>
                  <Td right>
                    <div className="flex flex-col items-end gap-1">
                      <span className={met ? "font-medium text-good" : "text-ink-2"}>{actual.toLocaleString()} kg</span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                        <div className={`h-full ${met ? "bg-good" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setForm({ mode: "edit", target: t })}
                        className="rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        className="rounded-md px-2 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
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

      {form && (
        <HarvestTargetForm target={form.mode === "edit" ? form.target : undefined} onClose={() => setForm(null)} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete this harvest target?"
          message="This target record will be permanently removed."
          confirmLabel="Delete target"
          onConfirm={() => doDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </Card>
  );
}

function HarvestTargetForm({ target, onClose }: { target?: WorkerHarvestTarget; onClose: () => void }) {
  const { db, update } = useStore();
  const editing = Boolean(target);
  const [form, setForm] = useState({
    workerId: target?.workerId ?? db.workers[0]?.id ?? "",
    startDate: target?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: target?.endDate ?? new Date().toISOString().slice(0, 10),
    farmId: target?.farmId ?? db.farms[0]?.id ?? "",
    plotId: target?.plotId ?? "",
    cropId: target?.cropId ?? db.crops[0]?.id ?? "",
    variety: target?.variety ?? "",
    targetKg: target ? String(target.targetKg) : "",
  });

  const plotsForFarm = db.plots.filter((p) => p.farmId === form.farmId);
  const plotId = form.plotId && plotsForFarm.some((p) => p.id === form.plotId) ? form.plotId : plotsForFarm[0]?.id ?? "";

  const setFarm = (farmId: string) => {
    const firstPlot = db.plots.find((p) => p.farmId === farmId);
    setForm({
      ...form,
      farmId,
      plotId: firstPlot?.id ?? "",
      cropId: firstPlot?.cropId ?? form.cropId,
      variety: firstPlot?.variety ?? "",
    });
  };

  const setPlot = (id: string) => {
    const plot = db.plots.find((p) => p.id === id);
    setForm({ ...form, plotId: id, cropId: plot?.cropId ?? form.cropId, variety: plot?.variety ?? form.variety });
  };

  const submit = () => {
    if (!plotId || !form.targetKg) return;
    const payload = {
      workerId: form.workerId,
      startDate: form.startDate,
      endDate: form.endDate < form.startDate ? form.startDate : form.endDate,
      farmId: form.farmId,
      plotId,
      cropId: form.cropId,
      variety: form.variety.trim() || undefined,
      targetKg: Number(form.targetKg) || 0,
    };
    if (target) {
      update("harvestTargets", (list) => list.map((t) => (t.id === target.id ? { ...t, ...payload } : t)));
    } else {
      update("harvestTargets", (list) => [...list, { id: newId("ht"), ...payload }]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? "Edit Harvest Target" : "Add Harvest Target"} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Worker">
            <Select value={form.workerId} onChange={(e) => setForm({ ...form, workerId: e.target.value })}>
              {db.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target volume (kg)">
            <TextInput
              type="number"
              value={form.targetKg}
              onChange={(e) => setForm({ ...form, targetKg: e.target.value })}
            />
          </Field>
          <Field label="Start date">
            <TextInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="End date">
            <TextInput type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
          <Field label="Farm">
            <Select value={form.farmId} onChange={(e) => setFarm(e.target.value)}>
              {db.farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plot">
            <Select value={plotId} onChange={(e) => setPlot(e.target.value)}>
              {plotsForFarm.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Crop">
            <Select value={form.cropId} onChange={(e) => setForm({ ...form, cropId: e.target.value })}>
              {db.crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Variety (blank = any)">
            <VarietySelect cropId={form.cropId} varieties={db.varieties} value={form.variety} onChange={(v) => setForm({ ...form, variety: v })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Save Target"}</Button>
        </div>
      </div>
    </Modal>
  );
}
