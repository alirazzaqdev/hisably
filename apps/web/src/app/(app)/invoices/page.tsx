"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { customersApi } from "@/lib/api/customers";
import { suppliersApi } from "@/lib/api/suppliers";
import { invoicesApi, type InvoiceType } from "@/lib/api/invoices";
import { InvoiceStatusBadge } from "./status-badge";

const TYPE_LABELS: Record<InvoiceType, string> = {
  tax_invoice: "Tax invoice",
  quotation: "Quotation",
  proforma: "Proforma",
  credit_note: "Credit note",
  debit_note: "Debit note",
  purchase_bill: "Purchase bill",
};

const TYPE_FILTERS: { value: InvoiceType | ""; label: string }[] = [
  { value: "", label: "All types" },
  ...(Object.entries(TYPE_LABELS) as [InvoiceType, string][]).map(([value, label]) => ({ value, label })),
];

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<InvoiceType | "">("");

  const { data, isLoading } = useQuery({
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
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-foreground">Invoices</h1>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="h-4 w-4" />
            New invoice
          </Link>
        </Button>
      </div>

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

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
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
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                  No invoices yet.
                </td>
              </tr>
            )}
            {data?.items.map((invoice) => (
              <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="font-medium text-foreground hover:text-accent-700"
                  >
                    {invoice.invoice_number ?? invoice.draft_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{TYPE_LABELS[invoice.type]}</td>
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
    </div>
  );
}
