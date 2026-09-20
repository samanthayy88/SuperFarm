"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Tabs,
  ConfirmDialog,
  inputClass,
} from "@/components/ui";
import { fmtDate, TODAY } from "@/lib/utils";
import { ScheduleTask } from "@/lib/types";

function isoAddDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const statusTone = (s: ScheduleTask["status"]) =>
  s === "Done" ? "good" : s === "In Progress" ? "accent" : "neutral";

export default function SchedulePage() {
  const { db, update } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<ScheduleTask | null>(null);
  const [removeTask, setRemoveTask] = useState<ScheduleTask | null>(null);
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

  const doDelete = (task: ScheduleTask) => {
    update("tasks", (list) => list.filter((t) => t.id !== task.id));
    setRemoveTask(null);
  };

  /** Edit / delete pair, shared by the table views. */
  const RowActions = ({ task }: { task: ScheduleTask }) => (
    <div className="flex gap-1">
      <button
        onClick={() => setEditTask(task)}
        className="rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        Edit
      </button>
      <button
        onClick={() => setRemoveTask(task)}
        className="rounded-md px-2 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
      >
        Delete
      </button>
    </div>
  );

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
                      <div
                        key={t.id}
                        className="rounded-lg border border-hairline bg-surface-2 p-3 transition-colors hover:border-accent/50"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-ink">{worker}</span>
                          <button onClick={() => cycleStatus(t.id)} title="Click to change status">
                            <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                          </button>
                        </div>
                        <p className="text-sm text-ink-2">{t.task}</p>
                        <p className="mt-1 text-xs text-muted">{farm}{plot ? ` · ${plot}` : ""}</p>
                        <div className="mt-2 flex gap-1 border-t border-hairline pt-2">
                          <button
                            onClick={() => setEditTask(t)}
                            className="rounded-md px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setRemoveTask(t)}
                            className="rounded-md px-2 py-1 text-xs text-critical transition-colors hover:bg-critical-soft"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
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
                        <Th />
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
                            <button onClick={() => cycleStatus(t.id)} title="Click to change status">
                              <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                            </button>
                          </Td>
                          <Td><RowActions task={t} /></Td>
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
                <Th />
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
                    <button onClick={() => cycleStatus(t.id)} title="Click to change status">
                      <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                    </button>
                  </Td>
                  <Td><RowActions task={t} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {showForm && <TaskForm onClose={() => setShowForm(false)} />}
      {editTask && <EditTaskForm task={editTask} onClose={() => setEditTask(null)} />}
      {removeTask && (
        <ConfirmDialog
          title="Delete this task?"
          message={`“${removeTask.task}” on ${fmtDate(removeTask.date)} for ${
            db.workers.find((w) => w.id === removeTask.workerId)?.name ?? "this worker"
          } will be removed from the schedule.`}
          confirmLabel="Delete task"
          onConfirm={() => doDelete(removeTask)}
          onClose={() => setRemoveTask(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------ create form ------------------------------- */

interface TaskRow {
  key: string;
  text: string;
}

const blankRow = (): TaskRow => ({ key: Math.random().toString(36).slice(2), text: "" });

function TaskForm({ onClose }: { onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    date: TODAY.toISOString().slice(0, 10),
    farmId: db.farms[0]?.id ?? "",
    workerId: db.workers[0]?.id ?? "",
    repeatDays: "1",
  });
  // empty = the whole farm; otherwise one task per selected plot
  const [plotIds, setPlotIds] = useState<string[]>([]);
  const [rows, setRows] = useState<TaskRow[]>([blankRow()]);
  // live input elements by row key, so focus can be moved imperatively
  const inputs = useRef(new Map<string, HTMLInputElement>());
  // a row created this render that should take focus once it exists
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    inputs.current.get(key)?.focus();
    pendingFocus.current = null;
  }, [rows]);

  const plots = db.plots.filter((p) => p.farmId === form.farmId);
  const filled = rows.filter((r) => r.text.trim());
  const repeat = Math.max(1, Number(form.repeatDays) || 1);
  const targets = plotIds.length > 0 ? plotIds.length : 1;
  const totalTasks = filled.length * targets * repeat;

  const togglePlot = (id: string) =>
    setPlotIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Typing in the last row grows the list, so there is always a free row. */
  const setText = (key: string, text: string) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.key === key ? { ...r, text } : r));
      const isLast = prev[prev.length - 1].key === key;
      return isLast && text.trim() ? [...next, blankRow()] : next;
    });
  };

  const addRow = () => {
    const row = blankRow();
    pendingFocus.current = row.key;
    setRows((prev) => [...prev, row]);
  };

  const removeRow = (key: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : [blankRow()]));

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = rows[index + 1];
    if (next) inputs.current.get(next.key)?.focus();
    else addRow();
  };

  const submit = () => {
    if (filled.length === 0) return;
    // undefined = whole farm
    const plotTargets: (string | undefined)[] = plotIds.length > 0 ? plotIds : [undefined];
    const items: ScheduleTask[] = [];
    for (let day = 0; day < repeat; day++) {
      const d = new Date(form.date);
      d.setDate(d.getDate() + day);
      const date = d.toISOString().slice(0, 10);
      for (const plotId of plotTargets) {
        for (const row of filled) {
          items.push({
            id: newId("t"),
            date,
            farmId: form.farmId,
            plotId,
            workerId: form.workerId,
            task: row.text.trim(),
            status: "Planned",
          });
        }
      }
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
          <Select
            value={form.farmId}
            onChange={(e) => {
              setForm({ ...form, farmId: e.target.value });
              setPlotIds([]);
            }}
          >
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </Field>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-2">Plots</span>
            {plots.length > 0 && (
              <span className="flex gap-2 text-xs">
                <button
                  onClick={() => setPlotIds(plots.map((p) => p.id))}
                  className="font-medium text-accent hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={() => setPlotIds([])}
                  className="font-medium text-muted hover:text-ink-2 hover:underline"
                >
                  Clear
                </button>
              </span>
            )}
          </div>
          {plots.length === 0 ? (
            <p className="text-xs text-muted">This farm has no plots — the task will cover the whole farm.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {plots.map((p) => {
                  const on = plotIds.includes(p.id);
                  const crop = db.crops.find((c) => c.id === p.cropId)?.name;
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlot(p.id)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        on
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-hairline bg-surface text-ink-2 hover:bg-surface-2"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {p.name}
                      {crop && <span className="ml-1 opacity-70">· {crop}</span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted">
                {plotIds.length === 0
                  ? "None selected — the task covers the whole farm."
                  : `${plotIds.length} plot${plotIds.length === 1 ? "" : "s"} selected — each gets its own task.`}
              </p>
            </>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Tasks</span>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={row.key} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-right text-xs tnum text-muted">{i + 1}</span>
                <input
                  ref={(el) => {
                    if (el) inputs.current.set(row.key, el);
                    else inputs.current.delete(row.key);
                  }}
                  value={row.text}
                  onChange={(e) => setText(row.key, e.target.value)}
                  onKeyDown={(e) => onRowKeyDown(e, i)}
                  placeholder={i === 0 ? "e.g. Harvest chili, Spray round, Weeding" : "Add another task"}
                  aria-label={`Task ${i + 1}`}
                  className={inputClass}
                />
                <button
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1 && !row.text}
                  aria-label={`Remove task ${i + 1}`}
                  className="shrink-0 px-1 text-muted transition-colors hover:text-critical disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button onClick={addRow} className="mt-2 text-xs font-medium text-accent hover:underline">
            + Add task
          </button>
          <p className="mt-1 text-xs text-muted">
            A new row appears as you type, or press Enter to add one.
          </p>
        </div>

        {totalTasks > 0 && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
            Will schedule <strong className="text-ink">{totalTasks}</strong>{" "}
            {totalTasks === 1 ? "task" : "tasks"}
            {(targets > 1 || repeat > 1) && (
              <>
                {" "}
                — {filled.length} {filled.length === 1 ? "task" : "tasks"}
                {targets > 1 && ` × ${targets} plots`}
                {repeat > 1 && ` × ${repeat} days`}
              </>
            )}
            .
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Schedule</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------- edit form -------------------------------- */

function EditTaskForm({ task, onClose }: { task: ScheduleTask; onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    date: task.date,
    farmId: task.farmId,
    plotId: task.plotId ?? "",
    workerId: task.workerId,
    task: task.task,
    status: task.status,
  });

  const plots = db.plots.filter((p) => p.farmId === form.farmId);

  const submit = () => {
    if (!form.task.trim()) return;
    update("tasks", (list) =>
      list.map((t) =>
        t.id === task.id
          ? {
              ...t,
              date: form.date,
              farmId: form.farmId,
              plotId: form.plotId || undefined,
              workerId: form.workerId,
              task: form.task.trim(),
              status: form.status,
            }
          : t
      )
    );
    onClose();
  };

  return (
    <Modal title="Edit Task" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Task">
          <TextInput value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ScheduleTask["status"] })}
            >
              <option>Planned</option>
              <option>In Progress</option>
              <option>Done</option>
            </Select>
          </Field>
        </div>
        <Field label="Worker">
          <Select value={form.workerId} onChange={(e) => setForm({ ...form, workerId: e.target.value })}>
            {db.workers.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Farm">
            <Select
              value={form.farmId}
              onChange={(e) => setForm({ ...form, farmId: e.target.value, plotId: "" })}
            >
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
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}
