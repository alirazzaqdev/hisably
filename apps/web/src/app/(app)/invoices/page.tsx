"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { customersApi } from "@/lib/api/customers";
import { suppliersApi } from "@/lib/api/suppliers";
import { invoicesApi, type InvoiceType } from "@/lib/api/invoices";
import { InvoiceStatusBadge } from "./status-badge";

const TYPE_LABELS: Partial<Record<InvoiceType, string>> = {
  tax_invoice: "Tax invoice",
  proforma: "Proforma",
  credit_note: "Credit note",
  debit_note: "Debit note",
  purchase_bill: "Purchase bill",
};

const TYPE_FILTERS: { value: InvoiceType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "tax_invoice", label: "Tax invoice" },
  { value: "proforma", label: "Proforma" },
  { value: "credit_note", label: "Credit note" },
  { value: "debit_note", label: "Debit note" },
  { value: "purchase_bill", label: "Purchase bill" },
];

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<InvoiceType | "">("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invoices", search, typeFilter],
    queryFn: () => invoicesApi.list({ search: search || undefined, type: typeFilter || undefined, pageSize: 50 }),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", "all"],
    queryFn: () => suppliersApi.list({ pageSize: 100 }),
  });

  const customerName = (id: string | null) => customers?.items.find((c) => c.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers?.items.find((s) => s.id === id)?.name ?? "—";
  const partyName = (invoice: { customer_id: string | null; supplier_id: string | null }) =>
    invoice.supplier_id ? supplierName(invoice.supplier_id) : customerName(invoice.customer_id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices"
        action={
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="h-4 w-4" />
              New invoice
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number"
            className="pl-9"
          />
        </div>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as InvoiceType | "")}
          className="w-auto"
        >
          {TYPE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
      )}

      {!isLoading && !isError && data?.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-body font-medium text-foreground">No invoices yet</p>
            <p className="text-body-sm text-muted-foreground">
              {search || typeFilter
                ? "No invoices match your search or filter."
                : "Create your first invoice to get started."}
            </p>
          </div>
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="h-4 w-4" />
              New invoice
            </Link>
          </Button>
        </div>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
            <table className="w-full text-left text-body">
              <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice #</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Party</th>
                  <th className="px-4 py-3 font-medium">Issue date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium text-foreground hover:text-accent-700"
                      >
                        {invoice.invoice_number ?? invoice.draft_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{TYPE_LABELS[invoice.type] ?? invoice.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{partyName(invoice)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{invoice.issue_date}</td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {invoice.currency} {invoice.grand_total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {data.items.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{invoice.invoice_number ?? invoice.draft_number}</p>
                    <p className="text-body-sm text-muted-foreground">
                      {TYPE_LABELS[invoice.type] ?? invoice.type} · {partyName(invoice)}
                    </p>
                  </div>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 text-body-sm">
                  <span className="text-muted-foreground">{invoice.issue_date}</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {invoice.currency} {invoice.grand_total}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
