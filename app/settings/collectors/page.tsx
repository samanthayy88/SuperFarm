"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Button, Modal, EmptyState, ConfirmDialog } from "@/components/ui";
import { BusinessDetails, BusinessProfileFields, BusinessFormState } from "@/components/BusinessProfileFields";
import { Collector } from "@/lib/types";

export default function CollectorsPage() {
  const { db, update } = useStore();
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; collector: Collector } | null>(null);
  const [deleteCollector, setDeleteCollector] = useState<Collector | null>(null);

  const salesCount = (c: Collector) => db.sales.filter((s) => s.collectorId === c.id).length;

  const doDelete = (c: Collector) => {
    update("collectors", (list) => list.filter((x) => x.id !== c.id));
    setDeleteCollector(null);
  };

  return (
    <div>
      <PageHeader
        title="Collectors"
        subtitle="Business, tax and banking details for produce buyers"
        actions={<Button onClick={() => setForm({ mode: "add" })}>+ Add Collector</Button>}
      />

      {db.collectors.length === 0 ? (
        <Card>
          <EmptyState message="No collectors yet. Use “+ Add Collector” to add your first one." />
        </Card>
      ) : (
        <div className="space-y-4">
          {db.collectors.map((c) => (
            <Card
              key={c.id}
              title={c.name}
              actions={
                <div className="flex gap-2">
                  <Button small variant="ghost" onClick={() => setForm({ mode: "edit", collector: c })}>
                    Edit
                  </Button>
                  <Button small variant="danger" onClick={() => setDeleteCollector(c)}>
                    Delete
                  </Button>
                </div>
              }
            >
              <BusinessDetails {...c} />
            </Card>
          ))}
        </div>
      )}

      {form && (
        <CollectorForm collector={form.mode === "edit" ? form.collector : undefined} onClose={() => setForm(null)} />
      )}
      {deleteCollector && (
        <ConfirmDialog
          title={`Delete ${deleteCollector.name}?`}
          message={`“${deleteCollector.name}” will be removed.${
            salesCount(deleteCollector) > 0
              ? ` ${salesCount(deleteCollector)} sale record(s) reference them — those are kept, just showing a blank collector.`
              : ""
          }`}
          confirmLabel="Delete collector"
          onConfirm={() => doDelete(deleteCollector)}
          onClose={() => setDeleteCollector(null)}
        />
      )}
    </div>
  );
}

function CollectorForm({ collector, onClose }: { collector?: Collector; onClose: () => void }) {
  const { update } = useStore();
  const editing = Boolean(collector);
  const [form, setForm] = useState<BusinessFormState>({
    name: collector?.name ?? "",
    picName: collector?.picName ?? "",
    phone: collector?.phone ?? "",
    email: collector?.email ?? "",
    paymentTermDays: collector ? String(collector.paymentTermDays) : "3",
    businessRegNo: collector?.businessRegNo ?? "",
    tinNumber: collector?.tinNumber ?? "",
    officeAddress: collector?.officeAddress ?? "",
    bankName: collector?.bankAccount?.bankName ?? "",
    recipientName: collector?.bankAccount?.recipientName ?? "",
    accountNumber: collector?.bankAccount?.accountNumber ?? "",
  });

  const submit = () => {
    if (!form.name.trim()) return;
    const hasBank = form.bankName.trim() || form.recipientName.trim() || form.accountNumber.trim();
    const payload = {
      name: form.name.trim(),
      picName: form.picName.trim() || undefined,
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      paymentTermDays: Number(form.paymentTermDays) || 0,
      businessRegNo: form.businessRegNo.trim() || undefined,
      tinNumber: form.tinNumber.trim() || undefined,
      officeAddress: form.officeAddress.trim() || undefined,
      bankAccount: hasBank
        ? {
            bankName: form.bankName.trim(),
            recipientName: form.recipientName.trim(),
            accountNumber: form.accountNumber.trim(),
          }
        : undefined,
    };
    if (collector) {
      update("collectors", (list) => list.map((c) => (c.id === collector.id ? { ...c, ...payload } : c)));
    } else {
      update("collectors", (list) => [...list, { id: newId("cl"), ...payload }]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? `Edit ${collector!.name}` : "Add Collector"} onClose={onClose} wide>
      <BusinessProfileFields form={form} setForm={setForm} />
      <div className="flex justify-end gap-2 pt-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit}>{editing ? "Save changes" : "Save Collector"}</Button>
      </div>
    </Modal>
  );
}
