"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import {
  PageHeader,
  Card,
  Button,
  Modal,
  Field,
  TextInput,
  EmptyState,
  ConfirmDialog,
  Tabs,
} from "@/components/ui";
import { Collector, Supplier } from "@/lib/types";

export default function CollectorsVendorsPage() {
  const [tab, setTab] = useState("Collectors");
  return (
    <div>
      <PageHeader title="Collectors & Vendors" subtitle="Business, tax and banking details for produce buyers and input suppliers" />
      <Tabs tabs={["Collectors", "Vendors"]} active={tab} onChange={setTab} />
      {tab === "Collectors" && <CollectorsTab />}
      {tab === "Vendors" && <VendorsTab />}
    </div>
  );
}

/* --------------------------------- shared ---------------------------------- */

function BusinessDetails({
  picName,
  phone,
  email,
  paymentTermDays,
  businessRegNo,
  tinNumber,
  officeAddress,
  bankAccount,
}: {
  picName?: string;
  phone: string;
  email?: string;
  paymentTermDays?: number;
  businessRegNo?: string;
  tinNumber?: string;
  officeAddress?: string;
  bankAccount?: { bankName: string; recipientName: string; accountNumber: string };
}) {
  return (
    <>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
        <span>
          <span className="text-muted">PIC:</span> {picName || "—"}
        </span>
        <span>
          <span className="text-muted">Phone:</span> {phone || "—"}
        </span>
        <span>
          <span className="text-muted">Email:</span> {email || "—"}
        </span>
        <span>
          <span className="text-muted">Payment term:</span>{" "}
          {paymentTermDays !== undefined ? `${paymentTermDays} days` : "—"}
        </span>
        <span>
          <span className="text-muted">Business Reg No:</span> {businessRegNo || "—"}
        </span>
        <span>
          <span className="text-muted">TIN:</span> {tinNumber || "—"}
        </span>
        <span>
          <span className="text-muted">Office:</span> {officeAddress || "—"}
        </span>
      </div>
      {bankAccount && (
        <p className="mt-2 text-xs text-muted">
          Bank: {bankAccount.bankName} · {bankAccount.recipientName} · {bankAccount.accountNumber}
        </p>
      )}
    </>
  );
}

/* -------------------------------- collectors -------------------------------- */

function CollectorsTab() {
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
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setForm({ mode: "add" })}>+ Add Collector</Button>
      </div>

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
  const [form, setForm] = useState({
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

/* ---------------------------------- vendors ---------------------------------- */

function VendorsTab() {
  const { db, update } = useStore();
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; vendor: Supplier } | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<Supplier | null>(null);

  const purchaseCount = (s: Supplier) => db.purchases.filter((p) => p.supplierId === s.id).length;

  const doDelete = (s: Supplier) => {
    update("suppliers", (list) => list.filter((x) => x.id !== s.id));
    // aliases are owned by the supplier that invoices under that name — meaningless once it's gone
    update("items", (list) => list.map((item) => ({ ...item, aliases: item.aliases.filter((a) => a.supplierId !== s.id) })));
    setDeleteVendor(null);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setForm({ mode: "add" })}>+ Add Vendor</Button>
      </div>

      {db.suppliers.length === 0 ? (
        <Card>
          <EmptyState message="No vendors yet. Use “+ Add Vendor” to add your first one." />
        </Card>
      ) : (
        <div className="space-y-4">
          {db.suppliers.map((s) => (
            <Card
              key={s.id}
              title={s.name}
              actions={
                <div className="flex gap-2">
                  <Button small variant="ghost" onClick={() => setForm({ mode: "edit", vendor: s })}>
                    Edit
                  </Button>
                  <Button small variant="danger" onClick={() => setDeleteVendor(s)}>
                    Delete
                  </Button>
                </div>
              }
            >
              <BusinessDetails {...s} />
            </Card>
          ))}
        </div>
      )}

      {form && <VendorForm vendor={form.mode === "edit" ? form.vendor : undefined} onClose={() => setForm(null)} />}
      {deleteVendor && (
        <ConfirmDialog
          title={`Delete ${deleteVendor.name}?`}
          message={`“${deleteVendor.name}” will be removed.${
            purchaseCount(deleteVendor) > 0
              ? ` ${purchaseCount(deleteVendor)} purchase record(s) reference them — those are kept, just showing a blank vendor.`
              : ""
          } Their invoice-name mappings on stock items are removed with them.`}
          confirmLabel="Delete vendor"
          onConfirm={() => doDelete(deleteVendor)}
          onClose={() => setDeleteVendor(null)}
        />
      )}
    </div>
  );
}

function VendorForm({ vendor, onClose }: { vendor?: Supplier; onClose: () => void }) {
  const { update } = useStore();
  const editing = Boolean(vendor);
  const [form, setForm] = useState({
    name: vendor?.name ?? "",
    picName: vendor?.picName ?? "",
    phone: vendor?.phone ?? "",
    email: vendor?.email ?? "",
    paymentTermDays: vendor?.paymentTermDays !== undefined ? String(vendor.paymentTermDays) : "",
    businessRegNo: vendor?.businessRegNo ?? "",
    tinNumber: vendor?.tinNumber ?? "",
    officeAddress: vendor?.officeAddress ?? "",
    bankName: vendor?.bankAccount?.bankName ?? "",
    recipientName: vendor?.bankAccount?.recipientName ?? "",
    accountNumber: vendor?.bankAccount?.accountNumber ?? "",
  });

  const submit = () => {
    if (!form.name.trim()) return;
    const hasBank = form.bankName.trim() || form.recipientName.trim() || form.accountNumber.trim();
    const payload = {
      name: form.name.trim(),
      picName: form.picName.trim() || undefined,
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      paymentTermDays: form.paymentTermDays.trim() ? Number(form.paymentTermDays) || 0 : undefined,
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
    if (vendor) {
      update("suppliers", (list) => list.map((s) => (s.id === vendor.id ? { ...s, ...payload } : s)));
    } else {
      update("suppliers", (list) => [...list, { id: newId("sp"), ...payload }]);
    }
    onClose();
  };

  return (
    <Modal title={editing ? `Edit ${vendor!.name}` : "Add Vendor"} onClose={onClose} wide>
      <BusinessProfileFields form={form} setForm={setForm} />
      <div className="flex justify-end gap-2 pt-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit}>{editing ? "Save changes" : "Save Vendor"}</Button>
      </div>
    </Modal>
  );
}

/* ----------------------------- shared form fields ---------------------------- */

interface BusinessFormState {
  name: string;
  picName: string;
  phone: string;
  email: string;
  paymentTermDays: string;
  businessRegNo: string;
  tinNumber: string;
  officeAddress: string;
  bankName: string;
  recipientName: string;
  accountNumber: string;
}

function BusinessProfileFields({
  form,
  setForm,
}: {
  form: BusinessFormState;
  setForm: (f: BusinessFormState) => void;
}) {
  const set = (patch: Partial<BusinessFormState>) => setForm({ ...form, ...patch });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Business name">
          <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="PIC name">
          <TextInput value={form.picName} onChange={(e) => set({ picName: e.target.value })} placeholder="Person in charge" />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Payment term (days)">
          <TextInput type="number" value={form.paymentTermDays} onChange={(e) => set({ paymentTermDays: e.target.value })} />
        </Field>
        <Field label="Business Registration No.">
          <TextInput value={form.businessRegNo} onChange={(e) => set({ businessRegNo: e.target.value })} />
        </Field>
        <Field label="TIN Number">
          <TextInput value={form.tinNumber} onChange={(e) => set({ tinNumber: e.target.value })} />
        </Field>
      </div>
      <Field label="Office address">
        <TextInput value={form.officeAddress} onChange={(e) => set({ officeAddress: e.target.value })} />
      </Field>

      <div className="rounded-lg border border-hairline bg-surface-2 p-3">
        <p className="mb-3 text-xs font-semibold tracking-wide text-ink-2">BANK ACCOUNT (for payouts)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Bank name">
            <TextInput value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} />
          </Field>
          <Field label="Recipient name">
            <TextInput value={form.recipientName} onChange={(e) => set({ recipientName: e.target.value })} />
          </Field>
          <Field label="Account number">
            <TextInput value={form.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} />
          </Field>
        </div>
      </div>
    </div>
  );
}
