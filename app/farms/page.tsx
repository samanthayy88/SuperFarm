"use client";

import { Fragment, useState } from "react";
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
} from "@/components/ui";
import {
  fmtDate,
  cycleSteps,
  cycleDurationDays,
  cycleDaysSoFar,
  currentStage,
  nextStage,
  averageCycleDaysByCrop,
} from "@/lib/utils";
import { Farm, Plot, PlotCycle, PlotCycleRecord, PLOT_STAGES, PLOT_STAGE_LABELS } from "@/lib/types";

export default function FarmsPage() {
  const { db, update, setDB } = useStore();

  const [farmForm, setFarmForm] = useState<{ mode: "add" } | { mode: "edit"; farm: Farm } | null>(null);
  const [plotForm, setPlotForm] = useState<
    { mode: "add"; farmId: string } | { mode: "edit"; plot: Plot } | null
  >(null);
  const [deleteFarm, setDeleteFarm] = useState<Farm | null>(null);
  const [deletePlot, setDeletePlot] = useState<Plot | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [historyFarm, setHistoryFarm] = useState<Farm | null>(null);
  const [completePlot, setCompletePlot] = useState<Plot | null>(null);

  /* ---------- deletion, with every linked record accounted for ---------- */

  const farmImpacts = (farm: Farm) => {
    const plots = db.plots.filter((p) => p.farmId === farm.id);
    const plotIds = new Set(plots.map((p) => p.id));
    const rows: string[] = [];
    const add = (n: number, one: string, many = one + "s") =>
      n > 0 && rows.push(`${n} ${n === 1 ? one : many}`);
    add(plots.length, "plot");
    add(db.harvests.filter((h) => plotIds.has(h.plotId)).length, "harvest record");
    add(db.tasks.filter((t) => t.farmId === farm.id).length, "scheduled task");
    add(db.applications.filter((a) => a.farmId === farm.id).length, "spray application");
    add(db.contracts.filter((c) => c.farmId === farm.id).length, "rental contract");
    add(db.projects.filter((p) => p.farmId === farm.id).length, "setup project");
    add(db.sales.filter((s) => s.farmId === farm.id).length, "sale record");
    return rows;
  };

  const plotImpacts = (plot: Plot) => {
    const rows: string[] = [];
    const add = (n: number, one: string, many = one + "s") =>
      n > 0 && rows.push(`${n} ${n === 1 ? one : many}`);
    add(db.harvests.filter((h) => h.plotId === plot.id).length, "harvest record");
    add(db.tasks.filter((t) => t.plotId === plot.id).length, "scheduled task");
    add(db.applications.filter((a) => a.plotId === plot.id).length, "spray application");
    return rows;
  };

  const doDeleteFarm = (farm: Farm) => {
    const plotIds = new Set(db.plots.filter((p) => p.farmId === farm.id).map((p) => p.id));
    setDB((prev) => ({
      ...prev,
      farms: prev.farms.filter((f) => f.id !== farm.id),
      plots: prev.plots.filter((p) => p.farmId !== farm.id),
      harvests: prev.harvests.filter((h) => !plotIds.has(h.plotId)),
      tasks: prev.tasks.filter((t) => t.farmId !== farm.id),
      applications: prev.applications.filter((a) => a.farmId !== farm.id),
      contracts: prev.contracts.filter((c) => c.farmId !== farm.id),
      projects: prev.projects.filter((p) => p.farmId !== farm.id),
      sales: prev.sales.filter((s) => s.farmId !== farm.id),
    }));
    setDeleteFarm(null);
  };

  const doDeletePlot = (plot: Plot) => {
    setDB((prev) => ({
      ...prev,
      plots: prev.plots.filter((p) => p.id !== plot.id),
      harvests: prev.harvests.filter((h) => h.plotId !== plot.id),
      tasks: prev.tasks.filter((t) => t.plotId !== plot.id),
      applications: prev.applications.filter((a) => a.plotId !== plot.id),
    }));
    setDeletePlot(null);
  };

  const setStatus = (plotId: string, status: Plot["status"]) =>
    update("plots", (list) => list.map((p) => (p.id === plotId ? { ...p, status } : p)));

  /** Archives the plot's current cycle into its history, clears the cycle
   *  dates and resets it to "Preparing" so the next planting can begin. */
  const completeCycle = (plot: Plot) => {
    update("plots", (list) =>
      list.map((p) => {
        if (p.id !== plot.id) return p;
        const hasDates = Object.keys(p.cycle ?? {}).length > 0;
        const history = hasDates
          ? [
              {
                id: newId("cyc"),
                cropId: p.cropId,
                variety: p.variety,
                workerId: p.workerId,
                cycle: p.cycle,
                archivedAt: new Date().toISOString().slice(0, 10),
              },
              ...(p.history ?? []),
            ]
          : (p.history ?? []);
        return { ...p, cycle: {}, history, status: "Preparing" };
      })
    );
    setCompletePlot(null);
  };

  /* ---------- summary ---------- */
  const totalAcres = db.farms.reduce((s, f) => s + f.sizeAcres, 0);
  const activePlots = db.plots.filter((p) => p.status === "Active").length;
  const cropsWithAvg = db.crops
    .map((c) => ({ crop: c, avg: averageCycleDaysByCrop(db.plots, c.id) }))
    .filter((x) => x.avg !== null);

  return (
    <div>
      <PageHeader
        title="Farms & Plots"
        subtitle="Each farm with its plots, crops, varieties and full crop cycle per plot"
        actions={<Button onClick={() => setFarmForm({ mode: "add" })}>+ Add Farm</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Farms" value={String(db.farms.length)} sub={`${totalAcres} acres total`} />
        <StatCard label="Plots" value={String(db.plots.length)} sub={`${activePlots} currently active`} />
        <StatCard
          label="Crops planted"
          value={String(new Set(db.plots.map((p) => p.cropId)).size)}
          sub={`${new Set(db.plots.map((p) => p.variety).filter(Boolean)).size} varieties`}
        />
        <StatCard
          label="Avg completed cycle"
          value={
            cropsWithAvg.length > 0
              ? `${Math.round(cropsWithAvg.reduce((s, x) => s + (x.avg as number), 0) / cropsWithAvg.length)} days`
              : "—"
          }
          sub={
            cropsWithAvg.length > 0
              ? cropsWithAvg.map((x) => `${x.crop.name} ${x.avg}d`).join(" · ")
              : "No cycle has reached fallow yet"
          }
        />
      </div>

      <div className="space-y-4">
        {db.farms.length === 0 && (
          <Card>
            <EmptyState message="No farms yet. Use “+ Add Farm” to create your first one." />
          </Card>
        )}

        {db.farms.map((farm) => {
          const plots = db.plots.filter((p) => p.farmId === farm.id);
          const contract = db.contracts.find((c) => c.farmId === farm.id);
          return (
            <Card
              key={farm.id}
              title={`${farm.name} — ${farm.location} (${farm.sizeAcres} acres)`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button small variant="ghost" onClick={() => setPlotForm({ mode: "add", farmId: farm.id })}>
                    + Add Plot
                  </Button>
                  <Button small variant="ghost" onClick={() => setHistoryFarm(farm)}>
                    History
                  </Button>
                  <Button small variant="ghost" onClick={() => setFarmForm({ mode: "edit", farm })}>
                    Edit farm
                  </Button>
                  <Button small variant="danger" onClick={() => setDeleteFarm(farm)}>
                    Delete
                  </Button>
                </div>
              }
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
                      <Th />
                      <Th>Plot</Th>
                      <Th>Crop</Th>
                      <Th>Variety</Th>
                      <Th right>Size</Th>
                      <Th>Managed by</Th>
                      <Th>Stage</Th>
                      <Th right>Cycle</Th>
                      <Th>Status</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {plots.map((p) => {
                      const crop = db.crops.find((c) => c.id === p.cropId)?.name ?? "—";
                      const worker = db.workers.find((w) => w.id === p.workerId)?.name ?? "—";
                      const steps = cycleSteps(p.cycle);
                      const stage = currentStage(p.cycle);
                      const upcoming = nextStage(p.cycle);
                      const total = cycleDurationDays(p.cycle);
                      const soFar = cycleDaysSoFar(p.cycle);
                      const done = Boolean(p.cycle?.fallow);
                      const isOpen = expanded === p.id;
                      return (
                        <Fragment key={p.id}>
                        <tr>
                          <Td>
                            <button
                              onClick={() => setExpanded(isOpen ? null : p.id)}
                              aria-expanded={isOpen}
                              aria-label={isOpen ? "Hide crop cycle" : "Show crop cycle"}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                            >
                              <span aria-hidden>{isOpen ? "▾" : "▸"}</span>
                            </button>
                          </Td>
                          <Td className="font-medium text-ink">{p.name}</Td>
                          <Td>{crop}</Td>
                          <Td>{p.variety || <span className="text-muted">—</span>}</Td>
                          <Td right>{p.sizeAcres} ac</Td>
                          <Td>{worker}</Td>
                          <Td>
                            {stage ? (
                              <>
                                <Badge tone={stage.stage === "fallow" ? "neutral" : "accent"}>{stage.label}</Badge>
                                {upcoming && (
                                  <p className="mt-0.5 text-xs text-muted">
                                    next: {upcoming.label} {fmtDate(upcoming.date)}
                                  </p>
                                )}
                              </>
                            ) : upcoming ? (
                              <span className="text-xs text-muted">starts {fmtDate(upcoming.date)}</span>
                            ) : (
                              <span className="text-xs text-muted">no dates yet</span>
                            )}
                          </Td>
                          <Td right>
                            {done && total !== null ? (
                              <>
                                <span className="font-medium text-ink">{total} d</span>
                                <p className="text-xs text-muted">complete</p>
                              </>
                            ) : soFar !== null ? (
                              <>
                                <span>{soFar} d</span>
                                <p className="text-xs text-muted">running</p>
                              </>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </Td>
                          <Td>
                            <select
                              value={p.status}
                              onChange={(e) => {
                                if (e.target.value === "Completed") setCompletePlot(p);
                                else setStatus(p.id, e.target.value as Plot["status"]);
                              }}
                              aria-label={`Status for ${p.name}`}
                              className={`rounded-md border border-hairline bg-surface px-2 py-1 text-xs font-medium ${
                                p.status === "Active"
                                  ? "text-good"
                                  : p.status === "Preparing"
                                    ? "text-accent"
                                    : "text-muted"
                              }`}
                            >
                              <option>Active</option>
                              <option>Preparing</option>
                              <option>Fallow</option>
                              <option value="Completed">Completed — archive to History</option>
                            </select>
                          </Td>
                          <Td>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setPlotForm({ mode: "edit", plot: p })}
                                className="rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeletePlot(p)}
                                className="rounded-md px-2 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
                              >
                                Delete
                              </button>
                            </div>
                          </Td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={10} className="border-b border-grid bg-surface-2 px-3 py-4">
                              <CycleDetail plot={p} steps={steps} total={total} soFar={soFar} done={done} />
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card>
          );
        })}
      </div>

      {farmForm && (
        <FarmForm
          farm={farmForm.mode === "edit" ? farmForm.farm : undefined}
          onClose={() => setFarmForm(null)}
        />
      )}
      {plotForm && (
        <PlotForm
          farmId={plotForm.mode === "add" ? plotForm.farmId : plotForm.plot.farmId}
          plot={plotForm.mode === "edit" ? plotForm.plot : undefined}
          onClose={() => setPlotForm(null)}
        />
      )}
      {historyFarm && <FarmHistoryModal farm={historyFarm} onClose={() => setHistoryFarm(null)} />}
      {completePlot && (
        <ConfirmDialog
          title={`Mark ${completePlot.name} as completed?`}
          message={`The current crop cycle will be saved to this farm's History, and “${completePlot.name}” will be reset to “Preparing” so you can record the next planting.`}
          confirmLabel="Mark Completed"
          onConfirm={() => completeCycle(completePlot)}
          onClose={() => setCompletePlot(null)}
        />
      )}
      {deleteFarm && (
        <ConfirmDialog
          title={`Delete ${deleteFarm.name}?`}
          message={`“${deleteFarm.name}” and everything recorded against it will be removed.`}
          impacts={farmImpacts(deleteFarm)}
          confirmLabel="Delete farm"
          onConfirm={() => doDeleteFarm(deleteFarm)}
          onClose={() => setDeleteFarm(null)}
        />
      )}
      {deletePlot && (
        <ConfirmDialog
          title={`Delete ${deletePlot.name}?`}
          message={`“${deletePlot.name}” will be removed from ${
            db.farms.find((f) => f.id === deletePlot.farmId)?.name ?? "this farm"
          }.`}
          impacts={plotImpacts(deletePlot)}
          confirmLabel="Delete plot"
          onConfirm={() => doDeletePlot(deletePlot)}
          onClose={() => setDeletePlot(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------ cycle detail ------------------------------ */

function CycleDetail({
  plot,
  steps,
  total,
  soFar,
  done,
}: {
  plot: Plot;
  steps: ReturnType<typeof cycleSteps>;
  total: number | null;
  soFar: number | null;
  done: boolean;
}) {
  const missing = PLOT_STAGES.filter((s) => !plot.cycle?.[s]);
  return (
    <div>
      <p className="mb-3 text-xs font-semibold tracking-wide text-muted">
        CROP CYCLE — {plot.name}
        {plot.variety ? ` · ${plot.variety}` : ""}
      </p>

      {steps.length === 0 ? (
        <p className="text-sm text-muted">
          No cycle dates recorded yet. Use <strong className="text-ink-2">Edit</strong> to add them.
        </p>
      ) : (
        <>
          <ol className="flex flex-wrap items-stretch gap-1">
            {steps.map((s) => (
              <li key={s.stage} className="flex items-center gap-1">
                {s.daysFromPrev !== null && (
                  <span className="whitespace-nowrap px-1 text-xs text-muted" aria-label="days between stages">
                    → {s.daysFromPrev}d →
                  </span>
                )}
                <span className="rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5">
                  <span className="block text-xs font-semibold text-ink">{s.label}</span>
                  <span className="block text-xs tnum text-muted">{fmtDate(s.date)}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-3 text-sm text-ink-2">
            {done && total !== null ? (
              <>
                Total cycle: <strong className="text-ink">{total} days</strong> from {steps[0].label.toLowerCase()} to
                fallow.
              </>
            ) : (
              <>
                <strong className="text-ink">{soFar} days</strong> since {steps[0].label.toLowerCase()} — cycle still
                running.
              </>
            )}
          </p>
        </>
      )}

      {missing.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Not recorded yet: {missing.map((m) => PLOT_STAGE_LABELS[m]).join(", ")}
        </p>
      )}
    </div>
  );
}

/* ------------------------------ farm history ------------------------------ */

function FarmHistoryModal({ farm, onClose }: { farm: Farm; onClose: () => void }) {
  const { db } = useStore();
  const plots = db.plots.filter((p) => p.farmId === farm.id);

  type Row = { plot: Plot; record: PlotCycleRecord };
  const rows: Row[] = plots
    .flatMap((plot) => (plot.history ?? []).map((record) => ({ plot, record })))
    .sort((a, b) => (a.record.archivedAt < b.record.archivedAt ? 1 : -1));

  return (
    <Modal title={`Planting History — ${farm.name}`} onClose={onClose} wide>
      {rows.length === 0 ? (
        <EmptyState message="No completed cycles yet. Past plantings appear here once a plot starts a new cycle." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Plot</Th>
              <Th>Crop</Th>
              <Th>Variety</Th>
              <Th>Managed by</Th>
              <Th>Cycle</Th>
              <Th right>Duration</Th>
              <Th right>Archived</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ plot, record }) => {
              const crop = db.crops.find((c) => c.id === record.cropId)?.name ?? "—";
              const worker = db.workers.find((w) => w.id === record.workerId)?.name ?? "—";
              const steps = cycleSteps(record.cycle);
              const duration = cycleDurationDays(record.cycle);
              return (
                <tr key={record.id}>
                  <Td className="font-medium text-ink">{plot.name}</Td>
                  <Td>{crop}</Td>
                  <Td>{record.variety || <span className="text-muted">—</span>}</Td>
                  <Td>{worker}</Td>
                  <Td>
                    {steps.length > 0 ? (
                      <span className="text-xs text-ink-2">
                        {steps[0].label} {fmtDate(steps[0].date)} → {steps[steps.length - 1].label}{" "}
                        {fmtDate(steps[steps.length - 1].date)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td right>{duration !== null ? `${duration} d` : <span className="text-muted">—</span>}</Td>
                  <Td right className="text-xs text-muted">
                    {fmtDate(record.archivedAt)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Modal>
  );
}

/* -------------------------------- farm form ------------------------------- */

function FarmForm({ farm, onClose }: { farm?: Farm; onClose: () => void }) {
  const { update } = useStore();
  const editing = Boolean(farm);
  const [form, setForm] = useState({
    name: farm?.name ?? "",
    location: farm?.location ?? "",
    sizeAcres: farm ? String(farm.sizeAcres) : "",
    partners: farm ? farm.partners.join(", ") : "",
    notes: farm?.notes ?? "",
  });

  const submit = () => {
    if (!form.name.trim()) return;
    const partners = form.partners
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      name: form.name.trim(),
      location: form.location.trim(),
      sizeAcres: Number(form.sizeAcres) || 0,
      partners: partners.length > 0 ? partners : ["Self (100%)"],
      notes: form.notes.trim() || undefined,
    };
    if (farm) {
      update("farms", (list) => list.map((f) => (f.id === farm.id ? { ...f, ...payload } : f)));
    } else {
      update("farms", (list) => [...list, { id: newId("f"), ...payload }]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? `Edit ${farm!.name}` : "Add Farm"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Farm name">
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Sungai Ruan Farm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <TextInput
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Town, State"
            />
          </Field>
          <Field label="Size (acres)">
            <TextInput
              type="number"
              value={form.sizeAcres}
              onChange={(e) => setForm({ ...form, sizeAcres: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Partners (comma separated)">
          <TextInput
            value={form.partners}
            onChange={(e) => setForm({ ...form, partners: e.target.value })}
            placeholder="Self (60%), Mr. Tan (40%)"
          />
        </Field>
        <Field label="Notes">
          <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Save Farm"}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------- plot form ------------------------------- */

function PlotForm({ farmId, plot, onClose }: { farmId: string; plot?: Plot; onClose: () => void }) {
  const { db, update } = useStore();
  const editing = Boolean(plot);
  const [form, setForm] = useState({
    farmId: plot?.farmId ?? farmId,
    name: plot?.name ?? "",
    sizeAcres: plot ? String(plot.sizeAcres) : "",
    cropId: plot?.cropId ?? db.crops[0]?.id ?? "",
    variety: plot?.variety ?? "",
    workerId: plot?.workerId ?? db.workers[0]?.id ?? "",
    status: plot?.status ?? ("Preparing" as Plot["status"]),
  });
  const [cycle, setCycle] = useState<PlotCycle>(plot?.cycle ?? {});
  const [history, setHistory] = useState<PlotCycleRecord[]>(plot?.history ?? []);
  const [confirmNewCycle, setConfirmNewCycle] = useState(false);

  const setStageDate = (stage: (typeof PLOT_STAGES)[number], value: string) =>
    setCycle((c) => {
      const next = { ...c };
      if (value) next[stage] = value;
      else delete next[stage];
      return next;
    });

  const startNewCycle = () => {
    if (Object.keys(cycle).length > 0) {
      setHistory((h) => [
        {
          id: newId("cyc"),
          cropId: form.cropId,
          variety: form.variety.trim() || undefined,
          workerId: form.workerId,
          cycle,
          archivedAt: new Date().toISOString().slice(0, 10),
        },
        ...h,
      ]);
    }
    setCycle({});
    setForm((f) => ({ ...f, status: "Preparing" }));
    setConfirmNewCycle(false);
  };

  // warn when dates run backwards through the cycle
  const outOfOrder = PLOT_STAGES.filter((s, i) => {
    if (!cycle[s]) return false;
    const earlier = PLOT_STAGES.slice(0, i).filter((e) => cycle[e]);
    return earlier.some((e) => (cycle[e] as string) > (cycle[s] as string));
  });

  const submit = () => {
    if (!form.name.trim()) return;
    const payload = {
      farmId: form.farmId,
      name: form.name.trim(),
      sizeAcres: Number(form.sizeAcres) || 0,
      cropId: form.cropId,
      variety: form.variety.trim() || undefined,
      workerId: form.workerId,
      status: form.status,
      cycle,
      history,
    };
    if (plot) {
      update("plots", (list) => list.map((p) => (p.id === plot.id ? { ...p, ...payload } : p)));
    } else {
      update("plots", (list) => [...list, { id: newId("p"), ...payload }]);
    }
    onClose();
  };

  const farmName = db.farms.find((f) => f.id === form.farmId)?.name;

  return (
    <>
    <Modal title={editing ? `Edit ${plot!.name} — ${farmName}` : `Add Plot — ${farmName}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Plot name">
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Plot D"
            />
          </Field>
          <Field label="Size (acres)">
            <TextInput
              type="number"
              value={form.sizeAcres}
              onChange={(e) => setForm({ ...form, sizeAcres: e.target.value })}
            />
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
          <Field label="Variety">
            <TextInput
              value={form.variety}
              onChange={(e) => setForm({ ...form, variety: e.target.value })}
              placeholder="e.g. Kulai Red, Bara F1"
            />
          </Field>
          <Field label="Managed by worker">
            <Select value={form.workerId} onChange={(e) => setForm({ ...form, workerId: e.target.value })}>
              {db.workers
                .filter((w) => w.active)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Plot["status"] })}
            >
              <option>Preparing</option>
              <option>Active</option>
              <option>Fallow</option>
            </Select>
          </Field>
          {editing && db.farms.length > 1 && (
            <Field label="Farm">
              <Select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })}>
                {db.farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className="rounded-lg border border-hairline bg-surface-2 p-3">
          <div className="mb-1 flex items-start justify-between gap-3">
            <p className="text-xs font-semibold tracking-wide text-ink-2">CROP CYCLE DATES</p>
            {editing && (
              <Button small variant="ghost" onClick={() => setConfirmNewCycle(true)}>
                Start New Cycle
              </Button>
            )}
          </div>
          <p className="mb-3 text-xs text-muted">
            Fill in each milestone as it happens. Leave a stage blank if it does not apply — the total cycle
            is measured from the first date you record to the last.
            {history.length > 0 && ` ${history.length} past ${history.length === 1 ? "cycle" : "cycles"} saved to History.`}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PLOT_STAGES.map((stage) => (
              <Field key={stage} label={PLOT_STAGE_LABELS[stage]}>
                <TextInput
                  type="date"
                  value={cycle[stage] ?? ""}
                  onChange={(e) => setStageDate(stage, e.target.value)}
                />
              </Field>
            ))}
          </div>
          <CycleSummary cycle={cycle} outOfOrder={outOfOrder} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Save Plot"}</Button>
        </div>
      </div>
    </Modal>
    {confirmNewCycle && (
      <ConfirmDialog
        title="Start a new cycle?"
        message={`The current crop cycle dates will be saved to ${farmName}'s History, and the dates here will be cleared so you can record the new planting. This only takes effect once you save the plot.`}
        confirmLabel="Start New Cycle"
        onConfirm={startNewCycle}
        onClose={() => setConfirmNewCycle(false)}
      />
    )}
    </>
  );
}

function CycleSummary({
  cycle,
  outOfOrder,
}: {
  cycle: PlotCycle;
  outOfOrder: readonly (typeof PLOT_STAGES)[number][];
}) {
  const filled = PLOT_STAGES.filter((s) => cycle[s]);
  if (filled.length === 0) return null;

  const first = cycle[filled[0]] as string;
  const last = cycle[filled[filled.length - 1]] as string;
  const days = Math.round((new Date(last).getTime() - new Date(first).getTime()) / 86400000);

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      {outOfOrder.length > 0 && (
        <p className="mb-2 text-xs text-warning">
          {outOfOrder.map((s) => PLOT_STAGE_LABELS[s]).join(", ")}{" "}
          {outOfOrder.length === 1 ? "is" : "are"} dated before an earlier stage — check the dates are right.
        </p>
      )}
      {filled.length > 1 ? (
        <p className="text-sm text-ink-2">
          Cycle so far: <strong className="text-ink">{days} days</strong> ({PLOT_STAGE_LABELS[filled[0]]} →{" "}
          {PLOT_STAGE_LABELS[filled[filled.length - 1]]})
        </p>
      ) : (
        <p className="text-sm text-muted">Add a second date to see the cycle length.</p>
      )}
    </div>
  );
}
