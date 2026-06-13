"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { customersApi } from "@/lib/api/customers";
import {
  jobRegisterApi,
  type JobRegisterRow,
  type JobRegisterRowInput,
} from "@/lib/api/job-register";
import { createOrQueue } from "@/lib/offline/sync-engine";

const WORK_STATUSES = [
  { value: "not_completed", label: "Not Completed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
] as const;

const TAX_INVOICE_STATUSES = [
  { value: "not_submitted", label: "Not Submitted" },
  { value: "submitted", label: "Submitted" },
] as const;

const PAYMENT_STATUSES = [
  { value: "lpo_not_received", label: "LPO Not Received" },
  { value: "pending", label: "Pending" },
  { value: "received", label: "Received" },
  { value: "not_received", label: "Not Received" },
] as const;

function emptyForm(): JobRegisterRowInput {
  return {
    qt_no: "",
    lpo_no: "",
    villa_no: "",
    description: "",
    rate: "0",
    customer_id: null,
    company_text: "",
    work_status: "not_completed",
    tax_invoice_status: "not_submitted",
    payment_status: "pending",
    remarks: "",
  };
}

function fromRow(row: JobRegisterRow): JobRegisterRowInput {
  return {
    qt_no: row.qt_no ?? "",
    lpo_no: row.lpo_no ?? "",
    villa_no: row.villa_no ?? "",
    description: row.description,
    rate: row.rate,
    override_total: row.override_total,
    customer_id: row.customer_id,
    company_text: row.company_text ?? "",
    work_status: row.work_status,
    tax_invoice_status: row.tax_invoice_status,
    payment_status: row.payment_status,
    remarks: row.remarks ?? "",
  };
}

export function JobRegisterRowForm({ row, onDone, onCancel }: { row?: JobRegisterRow; onDone: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(row);

  const [form, setForm] = useState<JobRegisterRowInput>(row ? fromRow(row) : emptyForm());
  const [overrideEnabled, setOverrideEnabled] = useState(row?.override_total != null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });

  function update<K extends keyof JobRegisterRowInput>(key: K, value: JobRegisterRowInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const rate = Number(form.rate ?? "0") || 0;
  const previewVat = Math.round(rate * 0.05 * 100) / 100;
  const previewTotal = overrideEnabled && form.override_total ? Number(form.override_total) : rate + previewVat;

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: JobRegisterRowInput = {
        ...form,
        override_total: overrideEnabled ? form.override_total || "0" : null,
      };
      if (isEditing) {
        return jobRegisterApi.updateRow(row!.id, { ...payload, clear_override_total: !overrideEnabled });
      }
      return createOrQueue("job_register_row", payload, jobRegisterApi.createRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-register", "rows"] });
      queryClient.invalidateQueries({ queryKey: ["job-register", "summary"] });
      onDone();
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => jobRegisterApi.removeRow(row!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-register", "rows"] });
      queryClient.invalidateQueries({ queryKey: ["job-register", "summary"] });
      onDone();
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  }

  return (
    <form className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qt_no">QT No.</Label>
          <Input id="qt_no" value={form.qt_no ?? ""} onChange={(e) => update("qt_no", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lpo_no">LPO No.</Label>
          <Input id="lpo_no" value={form.lpo_no ?? ""} onChange={(e) => update("lpo_no", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="villa_no">Villa / Project No.</Label>
          <Input id="villa_no" value={form.villa_no ?? ""} onChange={(e) => update("villa_no", e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          required
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="customer_id">Company (customer)</Label>
          <Select
            id="customer_id"
            value={form.customer_id ?? ""}
            onChange={(e) => update("customer_id", e.target.value || null)}
          >
            <option value="">— none —</option>
            {customers?.items.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company_text">Company (free text)</Label>
          <Input
            id="company_text"
            placeholder="Used if no customer linked"
            value={form.company_text ?? ""}
            onChange={(e) => update("company_text", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rate">Rate</Label>
          <Input
            id="rate"
            type="number"
            step="0.01"
            value={form.rate ?? "0"}
            onChange={(e) => update("rate", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>VAT (5%, auto)</Label>
          <Input value={previewVat.toFixed(2)} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="override_total">Total</Label>
          <Input
            id="override_total"
            type="number"
            step="0.01"
            disabled={!overrideEnabled}
            placeholder={(rate + previewVat).toFixed(2)}
            value={overrideEnabled ? form.override_total ?? "" : previewTotal.toFixed(2)}
            onChange={(e) => update("override_total", e.target.value)}
          />
          <label className="flex items-center gap-2 text-body-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={overrideEnabled}
              onChange={(e) => setOverrideEnabled(e.target.checked)}
            />
            Override total (odd amount)
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="work_status">Work Status</Label>
          <Select
            id="work_status"
            value={form.work_status}
            onChange={(e) => update("work_status", e.target.value as JobRegisterRowInput["work_status"])}
          >
            {WORK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tax_invoice_status">Tax-Invoice Status</Label>
          <Select
            id="tax_invoice_status"
            value={form.tax_invoice_status}
            onChange={(e) => update("tax_invoice_status", e.target.value as JobRegisterRowInput["tax_invoice_status"])}
          >
            {TAX_INVOICE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment_status">Payment Status</Label>
          <Select
            id="payment_status"
            value={form.payment_status}
            onChange={(e) => update("payment_status", e.target.value as JobRegisterRowInput["payment_status"])}
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="remarks">Remarks</Label>
        <Input id="remarks" value={form.remarks ?? ""} onChange={(e) => update("remarks", e.target.value)} />
      </div>

      <FormError>{formError}</FormError>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {isEditing && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}

export { WORK_STATUSES, TAX_INVOICE_STATUSES, PAYMENT_STATUSES };
