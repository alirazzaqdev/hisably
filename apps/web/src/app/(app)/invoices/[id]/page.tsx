"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { customersApi } from "@/lib/api/customers";
import { suppliersApi } from "@/lib/api/suppliers";
import { invoicesApi, type InvoiceStatus } from "@/lib/api/invoices";
import { InvoiceStatusBadge } from "../status-badge";

const NEXT_STATUS: Partial<Record<InvoiceStatus, { label: string; status: InvoiceStatus }[]>> = {
  draft: [{ label: "Mark as sent", status: "sent" }],
  sent: [
    { label: "Mark as paid", status: "paid" },
    { label: "Mark as partially paid", status: "partially_paid" },
  ],
  partially_paid: [{ label: "Mark as paid", status: "paid" }],
};

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoices", id],
    queryFn: () => invoicesApi.get(id),
  });

  const { data: customer } = useQuery({
    queryKey: ["customers", invoice?.customer_id],
    queryFn: () => customersApi.get(invoice!.customer_id!),
    enabled: Boolean(invoice?.customer_id),
  });

  const { data: supplier } = useQuery({
    queryKey: ["suppliers", invoice?.supplier_id],
    queryFn: () => suppliersApi.get(invoice!.supplier_id!),
    enabled: Boolean(invoice?.supplier_id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: InvoiceStatus) => invoicesApi.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
    },
  });

  const voidMutation = useMutation({
    mutationFn: () => invoicesApi.setStatus(id, "void", "Voided by user"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => invoicesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push("/invoices");
    },
  });

  async function downloadPdf() {
    if (!invoice) return;
    setDownloading(true);
    try {
      const blob = await invoicesApi.pdfBlob(invoice.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading || !invoice) {
    return <p className="text-body text-muted-foreground">Loading…</p>;
  }

  const canEdit = invoice.status === "draft" || invoice.status === "sent";
  const canVoid = invoice.status !== "void";
  const canDelete = invoice.status === "draft";
  const canCreditNote = invoice.type === "tax_invoice" && invoice.status !== "draft" && invoice.status !== "void";
  const canDebitNote = invoice.type === "purchase_bill" && invoice.status !== "draft" && invoice.status !== "void";
  const canConvertToInvoice = (invoice.type === "quotation" || invoice.type === "proforma") && invoice.status !== "void";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-foreground">{invoice.invoice_number ?? invoice.draft_number}</h1>
          <div className="mt-1">
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={downloadPdf} disabled={downloading}>
            <Download className="h-4 w-4" />
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
          {canEdit && (
            <Button asChild variant="secondary">
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-body-sm">
                <thead className="border-b border-border bg-muted text-caption text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Unit price</th>
                    <th className="px-3 py-2 text-right font-medium">VAT</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.line_items.map((line) => (
                    <tr key={line.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{line.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.unit_price}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.vat_rate}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.line_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col gap-1 self-end sm:ml-auto sm:w-64">
              <div className="flex items-center justify-between text-body-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {invoice.currency} {invoice.subtotal}
                </span>
              </div>
              <div className="flex items-center justify-between text-body-sm text-muted-foreground">
                <span>Discount</span>
                <span className="tabular-nums">
                  {invoice.currency} {invoice.discount_total}
                </span>
              </div>
              <div className="flex items-center justify-between text-body-sm text-muted-foreground">
                <span>VAT</span>
                <span className="tabular-nums">
                  {invoice.currency} {invoice.vat_total}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 text-body font-semibold text-foreground">
                <span>Total</span>
                <span className="tabular-nums">
                  {invoice.currency} {invoice.grand_total}
                </span>
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-4">
                <p className="text-body-sm font-medium text-foreground">Notes</p>
                <p className="text-body-sm text-muted-foreground">{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div className="mt-4">
                <p className="text-body-sm font-medium text-foreground">Terms &amp; conditions</p>
                <p className="text-body-sm text-muted-foreground">{invoice.terms}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-body-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{invoice.supplier_id ? "Supplier" : "Customer"}</span>
                <span className="text-foreground">{(invoice.supplier_id ? supplier?.name : customer?.name) ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Issue date</span>
                <span className="text-foreground">{invoice.issue_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due date</span>
                <span className="text-foreground">{invoice.due_date ?? "—"}</span>
              </div>
              {invoice.void_reason && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Void reason</span>
                  <span className="text-foreground">{invoice.void_reason}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {NEXT_STATUS[invoice.status]?.map((action) => (
                <Button
                  key={action.status}
                  variant="secondary"
                  onClick={() => statusMutation.mutate(action.status)}
                  disabled={statusMutation.isPending}
                >
                  {action.label}
                </Button>
              ))}
              {canConvertToInvoice && (
                <Button asChild variant="secondary">
                  <Link href={`/invoices/new?from=${invoice.id}&type=tax_invoice`}>Convert to invoice</Link>
                </Button>
              )}
              {canCreditNote && (
                <Button asChild variant="secondary">
                  <Link href={`/invoices/new?from=${invoice.id}&type=credit_note`}>Create credit note</Link>
                </Button>
              )}
              {canDebitNote && (
                <Button asChild variant="secondary">
                  <Link href={`/invoices/new?from=${invoice.id}&type=debit_note`}>Create debit note</Link>
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  Delete draft
                </Button>
              )}
              {canVoid && invoice.status !== "draft" && (
                <Button variant="destructive" onClick={() => voidMutation.mutate()} disabled={voidMutation.isPending}>
                  Void invoice
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
