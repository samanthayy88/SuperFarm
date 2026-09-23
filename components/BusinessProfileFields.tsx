"use client";

import { Field, TextInput } from "@/components/ui";

/** Read-only display of a collector/vendor's business, tax and banking details. */
export function BusinessDetails({
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

export interface BusinessFormState {
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

/** Shared add/edit form fields for a collector or vendor's business profile. */
export function BusinessProfileFields({
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
