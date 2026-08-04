"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Badge, Table, Th, Td, Button, Modal, Field, TextInput, Select, StatCard } from "@/components/ui";
import { fmtRM0, fmtDate, daysBetween, TODAY } from "@/lib/utils";
import { SetupProject } from "@/lib/types";

export default function ProjectsPage() {
  const { db, update } = useStore();
  const [showForm, setShowForm] = useState(false);

  const totalQuoted = db.projects.reduce((s, p) => s + p.quotedCharge, 0);
  const totalPaid = db.projects.reduce((s, p) => s + p.amountPaid, 0);
  const delayed = db.projects.filter((p) => p.status === "Delayed").length;

  const setStatus = (id: string, status: SetupProject["status"]) => {
    update("projects", (list) =>
      list.map((p) =>
        p.id === id
          ? { ...p, status, actualEndDate: status === "Completed" ? TODAY.toISOString().slice(0, 10) : p.actualEndDate }
          : p
      )
    );
  };

  return (
    <div>
      <PageHeader
        title="Setup Projects"
        subtitle="Third-party contractor jobs — land clearing, fencing, tilling — charges and progress"
        actions={<Button onClick={() => setShowForm(true)}>+ Add Project</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total contractor charges" value={fmtRM0(totalQuoted)} />
        <StatCard label="Paid to contractors" value={fmtRM0(totalPaid)} />
        <StatCard label="Balance owing" value={fmtRM0(totalQuoted - totalPaid)} tone={totalQuoted - totalPaid > 0 ? "warning" : "good"} />
        <StatCard label="Delayed projects" value={String(delayed)} tone={delayed > 0 ? "critical" : "good"} />
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Job</Th>
              <Th>Farm</Th>
              <Th>Contractor</Th>
              <Th right>Quoted</Th>
              <Th right>Paid</Th>
              <Th>Timeline</Th>
              <Th>Status</Th>
              <Th>Update</Th>
            </tr>
          </thead>
          <tbody>
            {db.projects.map((p) => {
              const farm = db.farms.find((f) => f.id === p.farmId)?.name ?? "—";
              const overdueDays =
                p.status !== "Completed" && new Date(p.expectedEndDate) < TODAY
                  ? daysBetween(p.expectedEndDate, TODAY)
                  : 0;
              const lateBy =
                p.status === "Completed" && p.actualEndDate && new Date(p.actualEndDate) > new Date(p.expectedEndDate)
                  ? daysBetween(p.expectedEndDate, p.actualEndDate)
                  : 0;
              return (
                <tr key={p.id}>
                  <Td className="font-medium">
                    {p.jobType}
                    {p.notes && <p className="mt-0.5 text-xs font-normal text-muted">{p.notes}</p>}
                  </Td>
                  <Td>{farm}</Td>
                  <Td>{p.contractor}</Td>
                  <Td right>{fmtRM0(p.quotedCharge)}</Td>
                  <Td right>
                    {fmtRM0(p.amountPaid)}
                    {p.amountPaid < p.quotedCharge && (
                      <p className="mt-0.5 text-xs text-muted">owing {fmtRM0(p.quotedCharge - p.amountPaid)}</p>
                    )}
                  </Td>
                  <Td>
                    <span className="text-ink-2">{fmtDate(p.startDate)} → {fmtDate(p.expectedEndDate)}</span>
                    {p.actualEndDate && <p className="mt-0.5 text-xs text-muted">done {fmtDate(p.actualEndDate)}</p>}
                    {overdueDays > 0 && <p className="mt-0.5 text-xs text-critical">{overdueDays} days past deadline</p>}
                    {lateBy > 0 && <p className="mt-0.5 text-xs text-serious">finished {lateBy} days late</p>}
                  </Td>
                  <Td>
                    <Badge tone={p.status === "Completed" ? "good" : p.status === "Delayed" ? "critical" : "accent"}>
                      {p.status}
                    </Badge>
                  </Td>
                  <Td>
                    <select
                      value={p.status}
                      onChange={(e) => setStatus(p.id, e.target.value as SetupProject["status"])}
                      className="rounded border border-hairline bg-surface-2 px-2 py-1 text-xs text-ink-2"
                    >
                      <option>In Progress</option>
                      <option>Delayed</option>
                      <option>Completed</option>
                    </select>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {showForm && <ProjectForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function ProjectForm({ onClose }: { onClose: () => void }) {
  const { db, update } = useStore();
  const [form, setForm] = useState({
    farmId: db.farms[0]?.id ?? "",
    contractor: "",
    jobType: "",
    quotedCharge: "",
    amountPaid: "",
    startDate: "",
    expectedEndDate: "",
    notes: "",
  });

  const submit = () => {
    if (!form.contractor || !form.jobType) return;
    const p: SetupProject = {
      id: newId("pr"),
      farmId: form.farmId,
      contractor: form.contractor,
      jobType: form.jobType,
      quotedCharge: Number(form.quotedCharge) || 0,
      amountPaid: Number(form.amountPaid) || 0,
      startDate: form.startDate,
      expectedEndDate: form.expectedEndDate,
      status: "In Progress",
      notes: form.notes || undefined,
    };
    update("projects", (list) => [...list, p]);
    onClose();
  };

  return (
    <Modal title="Add Setup Project" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Farm">
          <Select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })}>
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Job type (e.g. Land Clearing, Fencing, Tilling)">
          <TextInput value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })} />
        </Field>
        <Field label="Contractor">
          <TextInput value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quoted charge (RM)">
            <TextInput type="number" value={form.quotedCharge} onChange={(e) => setForm({ ...form, quotedCharge: e.target.value })} />
          </Field>
          <Field label="Paid so far (RM)">
            <TextInput type="number" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} />
          </Field>
          <Field label="Start date">
            <TextInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="Expected completion">
            <TextInput type="date" value={form.expectedEndDate} onChange={(e) => setForm({ ...form, expectedEndDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save Project</Button>
        </div>
      </div>
    </Modal>
  );
}
