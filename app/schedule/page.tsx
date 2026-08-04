"use client";

import { useMemo, useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Table, Th, Td, Button, Modal, Field, TextInput, Select, EmptyState, Tabs } from "@/components/ui";
import { fmtDate, TODAY } from "@/lib/utils";
import { ScheduleTask } from "@/lib/types";

function isoAddDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SchedulePage() {
  const { db, update } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState("Calendar");
  const [filters, setFilters] = useState({
    from: isoAddDays(TODAY, -2),
    to: isoAddDays(TODAY, 7),
    workerId: "",
    farmId: "",
    plotId: "",
  });

  const filtered = useMemo(() => {
    return db.tasks
      .filter((t) => t.date >= filters.from && t.date <= filters.to)
      .filter((t) => !filters.workerId || t.workerId === filters.workerId)
      .filter((t) => !filters.farmId || t.farmId === filters.farmId)
      .filter((t) => !filters.plotId || t.plotId === filters.plotId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [db.tasks, filters]);

  const plotsForFarm = filters.farmId ? db.plots.filter((p) => p.farmId === filters.farmId) : db.plots;

  const cycleStatus = (id: string) => {
    const order: ScheduleTask["status"][] = ["Planned", "In Progress", "Done"];
    update("tasks", (list) =>
      list.map((t) => (t.id === id ? { ...t, status: order[(order.indexOf(t.status) + 1) % 3] } : t))
    );
  };

  // group by date for calendar view
  const dates = [...new Set(filtered.map((t) => t.date))].sort();

  return (
    <div>
      <PageHeader
        title="Work Schedule"
        subtitle="Plan and supervise daily work by worker, farm, plot and date range"
        actions={<Button onClick={() => setShowForm(true)}>+ Schedule Task</Button>}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <TextInput type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </Field>
          <Field label="To">
            <TextInput type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </Field>
          <Field label="Worker">
            <Select value={filters.workerId} onChange={(e) => setFilters({ ...filters, workerId: e.target.value })}>
              <option value="">All workers</option>
              {db.workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Farm">
            <Select
              value={filters.farmId}
              onChange={(e) => setFilters({ ...filters, farmId: e.target.value, plotId: "" })}
            >
              <option value="">All farms</option>
              {db.farms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Plot">
            <Select value={filters.plotId} onChange={(e) => setFilters({ ...filters, plotId: e.target.value })}>
              <option value="">All plots</option>
              {plotsForFarm.map((p) => (
                <option key={p.id} value={p.id}>
                  {db.farms.find((f) => f.id === p.farmId)?.name?.split(" ")[0]} — {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2 pb-0.5">
            <Button variant="ghost" onClick={() => setFilters({ from: isoAddDays(TODAY, 0), to: isoAddDays(TODAY, 0), workerId: "", farmId: "", plotId: "" })}>
              Today
            </Button>
            <Button variant="ghost" onClick={() => setFilters({ ...filters, from: isoAddDays(TODAY, 0), to: isoAddDays(TODAY, 6) })}>
              Next 7 days
            </Button>
            <Button variant="ghost" onClick={() => setFilters({ from: isoAddDays(TODAY, -30), to: isoAddDays(TODAY, 30), workerId: "", farmId: "", plotId: "" })}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <Tabs tabs={["Calendar", "By Worker", "List"]} active={view} onChange={setView} />

      {filtered.length === 0 ? (
        <Card><EmptyState message="No tasks match the current filters." /></Card>
      ) : view === "Calendar" ? (
        <div className="space-y-4">
          {dates.map((date) => {
            const dayTasks = filtered.filter((t) => t.date === date);
            const isToday = date === TODAY.toISOString().slice(0, 10);
            return (
              <Card
                key={date}
                title={`${new Date(date).toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" })}${isToday ? "  ·  TODAY" : ""}`}
              >
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {dayTasks.map((t) => {
                    const worker = db.workers.find((w) => w.id === t.workerId)?.name ?? "—";
                    const farm = db.farms.find((f) => f.id === t.farmId)?.name ?? "—";
                    const plot = db.plots.find((p) => p.id === t.plotId)?.name;
                    return (
                      <button
                        key={t.id}
                        onClick={() => cycleStatus(t.id)}
                        className="rounded border border-hairline bg-surface-2 p-3 text-left transition-colors hover:border-accent/50"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{worker}</span>
                          <Badge tone={t.status === "Done" ? "good" : t.status === "In Progress" ? "accent" : "neutral"}>
                            {t.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-ink-2">{t.task}</p>
                        <p className="mt-1 text-xs text-muted">{farm}{plot ? ` · ${plot}` : ""}</p>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      ) : view === "By Worker" ? (
        <div className="space-y-4">
          {db.workers
            .filter((w) => filtered.some((t) => t.workerId === w.id))
            .map((w) => {
              const wTasks = filtered.filter((t) => t.workerId === w.id);
              return (
                <Card key={w.id} title={`${w.name} — ${wTasks.length} task(s)`}>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Date</Th>
                        <Th>Farm / Plot</Th>
                        <Th>Task</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {wTasks.map((t) => (
                        <tr key={t.id}>
                          <Td>{fmtDate(t.date)}</Td>
                          <Td>
                            {db.farms.find((f) => f.id === t.farmId)?.name}
                            {t.plotId ? ` · ${db.plots.find((p) => p.id === t.plotId)?.name}` : ""}
                          </Td>
                          <Td>{t.task}</Td>
                          <Td>
                            <button onClick={() => cycleStatus(t.id)}>
                              <Badge tone={t.status === "Done" ? "good" : t.status === "In Progress" ? "accent" : "neutral"}>
                                {t.status}
                              </Badge>
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
              );
            })}
        </div>
      ) : (
        <Card title={`${filtered.length} task(s)`}>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Worker</Th>
                <Th>Farm</Th>
                <Th>Plot</Th>
                <Th>Task</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <Td>{fmtDate(t.date)}</Td>
                  <Td>{db.workers.find((w) => w.id === t.workerId)?.name ?? "—"}</Td>
                  <Td>{db.farms.find((f) => f.id === t.farmId)?.name ?? "—"}</Td>
                  <Td>{db.plots.find((p) => p.id === t.plotId)?.name ?? "—"}</Td>
                  <Td>{t.task}</Td>
                  <Td>
                    <button onClick={() => cycleStatus(t.id)}>
                      <Badge tone={t.status === "Done" ? "good" : t.status === "In Progress" ? "accent" : "neutral"}>
                        {t.status}
                      </Badge>
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {showForm && <TaskForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function TaskForm({ onClose }: { onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    date: TODAY.toISOString().slice(0, 10),
    farmId: db.farms[0]?.id ?? "",
    plotId: "",
    workerId: db.workers[0]?.id ?? "",
    task: "",
    repeatDays: "1",
  });

  const plots = db.plots.filter((p) => p.farmId === form.farmId);

  const submit = () => {
    if (!form.task) return;
    const repeat = Math.max(1, Number(form.repeatDays) || 1);
    const items: ScheduleTask[] = [];
    for (let i = 0; i < repeat; i++) {
      const d = new Date(form.date);
      d.setDate(d.getDate() + i);
      items.push({
        id: newId("t"),
        date: d.toISOString().slice(0, 10),
        farmId: form.farmId,
        plotId: form.plotId || undefined,
        workerId: form.workerId,
        task: form.task,
        status: "Planned",
      });
    }
    update("tasks", (list) => [...list, ...items]);
    onClose();
  };

  return (
    <Modal title="Schedule Task" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Repeat for (days)">
            <TextInput type="number" min="1" value={form.repeatDays} onChange={(e) => setForm({ ...form, repeatDays: e.target.value })} />
          </Field>
        </div>
        <Field label="Worker">
          <Select value={form.workerId} onChange={(e) => setForm({ ...form, workerId: e.target.value })}>
            {db.workers.filter((w) => w.active).map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Farm">
          <Select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value, plotId: "" })}>
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Plot (optional)">
          <Select value={form.plotId} onChange={(e) => setForm({ ...form, plotId: e.target.value })}>
            <option value="">Whole farm</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Task">
          <TextInput value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} placeholder="e.g. Harvest chili, Spray round, Weeding" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Schedule</Button>
        </div>
      </div>
    </Modal>
  );
}
