"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Button, Modal, EmptyState, ConfirmDialog } from "@/components/ui";
import { BusinessDetails, BusinessProfileFields, BusinessFormState } from "@/components/BusinessProfileFields";
import { Supplier } from "@/lib/types";

export default function VendorsPage() {
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
      <PageHeader
        title="Vendors"
        subtitle="Business, tax and banking details for input suppliers"
        actions={<Button onClick={() => setForm({ mode: "add" })}>+ Add Vendor</Button>}
      />

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
  const [form, setForm] = useState<BusinessFormState>({
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
