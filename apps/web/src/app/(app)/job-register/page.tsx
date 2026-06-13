"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Download, Plus } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { customersApi } from "@/lib/api/customers";
import { downloadCsv } from "@/lib/csv";
import {
  jobRegisterApi,
  type JobPaymentStatus,
  type JobRegisterListParams,
  type JobRegisterRow,
  type JobTaxInvoiceStatus,
  type JobWorkStatus,
} from "@/lib/api/job-register";
import { ReceiptsSection } from "./receipts-section";
import {
  JobRegisterRowForm,
  PAYMENT_STATUSES,
  TAX_INVOICE_STATUSES,
  WORK_STATUSES,
} from "./row-form";

const WORK_STATUS_VARIANTS: Record<JobWorkStatus, BadgeProps["variant"]> = {
  not_completed: "neutral",
  in_progress: "warning",
  completed: "success",
};

const TAX_INVOICE_STATUS_VARIANTS: Record<JobTaxInvoiceStatus, BadgeProps["variant"]> = {
  not_submitted: "neutral",
  submitted: "success",
};

const PAYMENT_STATUS_VARIANTS: Record<JobPaymentStatus, BadgeProps["variant"]> = {
  lpo_not_received: "neutral",
  pending: "warning",
  received: "success",
  not_received: "danger",
};

type GroupBy = "none" | "company" | "payment_status";

const PAYMENT_STATUS_LABELS: Record<JobPaymentStatus, string> = {
  lpo_not_received: "LPO Not Received",
  pending: "Pending",
  received: "Received",
  not_received: "Not Received",
};

export default function JobRegisterPage() {
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<JobRegisterListParams>({});
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const listParams: JobRegisterListParams = { ...filters, search: search || undefined, pageSize: 200 };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["job-register", "rows", listParams],
    queryFn: () => jobRegisterApi.list(listParams),
  });

  const { data: summary } = useQuery({
    queryKey: ["job-register", "summary", listParams],
    queryFn: () => jobRegisterApi.summary(listParams),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });

  const customerName = (row: JobRegisterRow) =>
    customers?.items.find((c) => c.id === row.customer_id)?.name ?? row.company_text ?? "—";

  const statusMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<JobRegisterRow>) =>
      jobRegisterApi.updateRow(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-register", "rows"] });
      queryClient.invalidateQueries({ queryKey: ["job-register", "summary"] });
    },
  });

  function updateFilter<K extends keyof JobRegisterListParams>(key: K, value: JobRegisterListParams[K]) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  }

  const rows = useMemo(() => data?.items ?? [], [data]);

  function exportCsv() {
    downloadCsv("job-register.csv", [
      [
        "QT No.",
        "LPO No.",
        "Villa / Project",
        "Description",
        "Company",
        "Rate",
        "VAT",
        "Total",
        "Work Status",
        "Tax Invoice Status",
        "Payment Status",
        "Remarks",
      ],
      ...rows.map((row) => [
        row.qt_no ?? "",
        row.lpo_no ?? "",
        row.villa_no ?? "",
        row.description,
        customerName(row),
        row.rate,
        row.vat,
        row.total,
        WORK_STATUSES.find((s) => s.value === row.work_status)?.label ?? row.work_status,
        TAX_INVOICE_STATUSES.find((s) => s.value === row.tax_invoice_status)?.label ?? row.tax_invoice_status,
        PAYMENT_STATUSES.find((s) => s.value === row.payment_status)?.label ?? row.payment_status,
        row.remarks ?? "",
      ]),
    ]);
  }

  const groups = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: null, label: null, rows }];
    }
    const map = new Map<string, { label: string; rows: JobRegisterRow[] }>();
    for (const row of rows) {
      const key =
        groupBy === "company"
          ? customers?.items.find((c) => c.id === row.customer_id)?.name ?? row.company_text ?? "Unassigned"
          : PAYMENT_STATUS_LABELS[row.payment_status];
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(key, { label: key, rows: [row] });
      }
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, label: value.label, rows: value.rows }));
  }, [rows, groupBy, customers]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Job / Project Register"
        description="Track quotations, LPOs, and payment status across jobs."
        action={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => setShowAddForm((v) => !v)}>
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-body-sm text-muted-foreground">Total Work Value</CardTitle>
          </CardHeader>
          <CardContent className="text-h2 tabular-nums">{summary?.total_work_value ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-body-sm text-muted-foreground">Total Submitted</CardTitle>
          </CardHeader>
          <CardContent className="text-h2 tabular-nums">{summary?.total_submitted ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-body-sm text-muted-foreground">Total Received</CardTitle>
          </CardHeader>
          <CardContent className="text-h2 tabular-nums">{summary?.total_received ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-body-sm text-muted-foreground">Balance</CardTitle>
          </CardHeader>
          <CardContent className="text-h2 tabular-nums">{summary?.balance ?? "—"}</CardContent>
        </Card>
      </div>

      {showAddForm && (
        <JobRegisterRowForm onDone={() => setShowAddForm(false)} onCancel={() => setShowAddForm(false)} />
      )}

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter_search">Search</Label>
              <Input
                id="filter_search"
                placeholder="Description, villa, LPO, QT no."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter_customer">Company</Label>
              <Select
                id="filter_customer"
                value={filters.customer_id ?? ""}
                onChange={(e) => updateFilter("customer_id", e.target.value)}
              >
                <option value="">All</option>
                {customers?.items.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter_work_status">Work Status</Label>
              <Select
                id="filter_work_status"
                value={filters.work_status ?? ""}
                onChange={(e) => updateFilter("work_status", e.target.value as JobWorkStatus)}
              >
                <option value="">All</option>
                {WORK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter_tax_invoice_status">Tax-Invoice Status</Label>
              <Select
                id="filter_tax_invoice_status"
                value={filters.tax_invoice_status ?? ""}
                onChange={(e) => updateFilter("tax_invoice_status", e.target.value as JobTaxInvoiceStatus)}
              >
                <option value="">All</option>
                {TAX_INVOICE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter_payment_status">Payment Status</Label>
              <Select
                id="filter_payment_status"
                value={filters.payment_status ?? ""}
                onChange={(e) => updateFilter("payment_status", e.target.value as JobPaymentStatus)}
              >
                <option value="">All</option>
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group_by">Group by</Label>
              <Select id="group_by" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
                <option value="none">None</option>
                <option value="company">Company</option>
                <option value="payment_status">Payment Status</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter_date_from">From date</Label>
              <Input
                id="filter_date_from"
                type="date"
                value={filters.date_from ?? ""}
                onChange={(e) => updateFilter("date_from", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter_date_to">To date</Label>
              <Input
                id="filter_date_to"
                type="date"
                value={filters.date_to ?? ""}
                onChange={(e) => updateFilter("date_to", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-body font-medium text-foreground">No rows recorded yet</p>
            <p className="text-body-sm text-muted-foreground">Add a row to start tracking jobs and payments.</p>
          </div>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />
            Add row
          </Button>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[960px] text-left text-body">
          <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">QT / LPO</th>
              <th className="px-4 py-3 font-medium">Villa / Project</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 text-right font-medium">Rate</th>
              <th className="px-4 py-3 text-right font-medium">VAT</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Work Status</th>
              <th className="px-4 py-3 font-medium">Tax Invoice</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows
                key={group.key ?? "all"}
                group={group}
                customerName={customerName}
                editingRowId={editingRowId}
                setEditingRowId={setEditingRowId}
                statusMutation={statusMutation}
              />
            ))}
          </tbody>
        </table>
      </div>
      )}

      <ReceiptsSection />
    </div>
  );
}

function GroupRows({
  group,
  customerName,
  editingRowId,
  setEditingRowId,
  statusMutation,
}: {
  group: { key: string | null; label: string | null; rows: JobRegisterRow[] };
  customerName: (row: JobRegisterRow) => string;
  editingRowId: string | null;
  setEditingRowId: (id: string | null) => void;
  statusMutation: ReturnType<typeof useMutation<JobRegisterRow, Error, { id: string } & Partial<JobRegisterRow>>>;
}) {
  const groupTotal = group.rows.reduce((sum, row) => sum + Number(row.total), 0);

  return (
    <>
      {group.label && (
        <tr className="bg-muted/50">
          <td className="px-4 py-2 font-medium" colSpan={6}>
            {group.label}
          </td>
          <td className="px-4 py-2 text-right font-medium tabular-nums" colSpan={5}>
            Total: {groupTotal.toFixed(2)}
          </td>
        </tr>
      )}
      {group.rows.map((row) =>
        editingRowId === row.id ? (
          <tr key={row.id}>
            <td className="p-4" colSpan={11}>
              <JobRegisterRowForm row={row} onDone={() => setEditingRowId(null)} onCancel={() => setEditingRowId(null)} />
            </td>
          </tr>
        ) : (
          <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/50">
            <td className="px-4 py-3 text-muted-foreground">
              <button type="button" className="text-left hover:text-accent-700" onClick={() => setEditingRowId(row.id)}>
                {row.qt_no || row.lpo_no || "—"}
              </button>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{row.villa_no || "—"}</td>
            <td className="px-4 py-3">
              <button type="button" className="text-left font-medium hover:text-accent-700" onClick={() => setEditingRowId(row.id)}>
                {row.description}
              </button>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{customerName(row)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.rate}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.vat}</td>
            <td className="px-4 py-3 text-right font-medium tabular-nums">{row.total}</td>
            <td className="px-4 py-3">
              <Select
                value={row.work_status}
                onChange={(e) => statusMutation.mutate({ id: row.id, work_status: e.target.value as JobWorkStatus })}
                className="h-8 py-0 text-body-sm"
              >
                {WORK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Badge variant={WORK_STATUS_VARIANTS[row.work_status]} className="mt-1">
                {WORK_STATUSES.find((s) => s.value === row.work_status)?.label}
              </Badge>
            </td>
            <td className="px-4 py-3">
              <Select
                value={row.tax_invoice_status}
                onChange={(e) =>
                  statusMutation.mutate({ id: row.id, tax_invoice_status: e.target.value as JobTaxInvoiceStatus })
                }
                className="h-8 py-0 text-body-sm"
              >
                {TAX_INVOICE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Badge variant={TAX_INVOICE_STATUS_VARIANTS[row.tax_invoice_status]} className="mt-1">
                {TAX_INVOICE_STATUSES.find((s) => s.value === row.tax_invoice_status)?.label}
              </Badge>
            </td>
            <td className="px-4 py-3">
              <Select
                value={row.payment_status}
                onChange={(e) =>
                  statusMutation.mutate({ id: row.id, payment_status: e.target.value as JobPaymentStatus })
                }
                className="h-8 py-0 text-body-sm"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Badge variant={PAYMENT_STATUS_VARIANTS[row.payment_status]} className="mt-1">
                {PAYMENT_STATUSES.find((s) => s.value === row.payment_status)?.label}
              </Badge>
            </td>
            <td className="px-4 py-3 text-right">
              <Button size="sm" variant="ghost" onClick={() => setEditingRowId(row.id)}>
                Edit
              </Button>
            </td>
          </tr>
        )
      )}
    </>
  );
}
