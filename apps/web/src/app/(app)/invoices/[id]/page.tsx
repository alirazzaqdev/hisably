"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MessageCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { customersApi } from "@/lib/api/customers";
import { suppliersApi } from "@/lib/api/suppliers";
import { invoicesApi, type InvoiceStatus, type QuotationStatus } from "@/lib/api/invoices";
import { quotationsApi } from "@/lib/api/quotations";
import { InvoiceStatusBadge } from "../status-badge";
import { QuotationStatusBadge } from "../../quotations/status-badge";

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && typeof error.detail === "string") return error.detail;
  return fallback;
}

const NEXT_STATUS: Partial<Record<InvoiceStatus, { label: string; status: InvoiceStatus }[]>> = {
  draft: [{ label: "Mark as sent", status: "sent" }],
  sent: [
    { label: "Mark as paid", status: "paid" },
    { label: "Mark as partially paid", status: "partially_paid" },
  ],
  partially_paid: [{ label: "Mark as paid", status: "paid" }],
};

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [validityOpen, setValidityOpen] = useState(false);
  const [validityDate, setValidityDate] = useState("");

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

  const quotationStatusMutation = useMutation({
    mutationFn: ({ status, dueDate }: { status: QuotationStatus; dueDate?: string }) =>
      quotationsApi.setStatus(id, status, dueDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["quotation-counts"] });
      toast({ title: "Quotation updated", variant: "success" });
      setValidityOpen(false);
      setValidityDate("");
    },
    onError: (error) => {
      toast({ title: "Couldn't update quotation", description: errorMessage(error, "Try again."), variant: "danger" });
    },
  });

  function submitValidityDate() {
    if (!validityDate) return;
    quotationStatusMutation.mutate({ status: "pending", dueDate: validityDate });
  }

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

  async function shareViaWhatsApp() {
    if (!invoice) return;
    setSharing(true);
    try {
      const shared = await invoicesApi.share(invoice.id);
      const pdfUrl = invoicesApi.publicPdfUrl(shared.public_token!);
      const message = `Invoice ${shared.invoice_number ?? shared.draft_number}: ${pdfUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    } finally {
      setSharing(false);
    }
  }

  if (isLoading || !invoice) {
    return <p className="text-body text-muted-foreground">Loading…</p>;
  }

  const isQuotation = invoice.type === "quotation";
  const quotationStatus: QuotationStatus = invoice.effective_quotation_status ?? invoice.quotation_status ?? "draft";

  const canEdit = isQuotation
    ? quotationStatus === "draft"
    : invoice.status === "draft" || invoice.status === "sent";
  const canVoid = !isQuotation && invoice.status !== "void";
  const canDelete = isQuotation ? quotationStatus === "draft" : invoice.status === "draft";
  const canCreditNote = invoice.type === "tax_invoice" && invoice.status !== "draft" && invoice.status !== "void";
  const canDebitNote = invoice.type === "purchase_bill" && invoice.status !== "draft" && invoice.status !== "void";
  const canConvertToInvoice =
    (invoice.type === "proforma" && invoice.status !== "void") || (isQuotation && quotationStatus === "approved");
  const canConvertToProforma = isQuotation && quotationStatus === "approved";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-foreground">{invoice.invoice_number ?? invoice.draft_number}</h1>
          <div className="mt-1">
            {isQuotation ? <QuotationStatusBadge status={quotationStatus} /> : <InvoiceStatusBadge status={invoice.status} />}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={downloadPdf} disabled={downloading}>
            <Download className="h-4 w-4" />
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
          <Button variant="secondary" onClick={shareViaWhatsApp} disabled={sharing}>
            <MessageCircle className="h-4 w-4" />
            {sharing ? "Preparing…" : "Share via WhatsApp"}
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
            {isQuotation && invoice.site_image_url && (
              <div className="mt-4">
                <p className="text-body-sm font-medium text-foreground">Site image</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={invoice.site_image_url}
                  alt="Site"
                  className="mt-2 max-h-64 rounded-md border border-border object-contain"
                />
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
                <span className="text-muted-foreground">{isQuotation ? "Valid until" : "Due date"}</span>
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
              {isQuotation && quotationStatus === "draft" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setValidityDate("");
                    setValidityOpen(true);
                  }}
                  disabled={quotationStatusMutation.isPending}
                >
                  Finalize quotation
                </Button>
              )}
              {isQuotation && quotationStatus === "pending" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => quotationStatusMutation.mutate({ status: "approved" })}
                    disabled={quotationStatusMutation.isPending}
                  >
                    Mark as approved
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => quotationStatusMutation.mutate({ status: "rejected" })}
                    disabled={quotationStatusMutation.isPending}
                  >
                    Mark as rejected
                  </Button>
                </>
              )}
              {isQuotation && quotationStatus === "expired" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setValidityDate("");
                    setValidityOpen(true);
                  }}
                  disabled={quotationStatusMutation.isPending}
                >
                  Renew quotation
                </Button>
              )}
              {!isQuotation &&
                NEXT_STATUS[invoice.status]?.map((action) => (
                  <Button
                    key={action.status}
                    variant="secondary"
                    onClick={() => statusMutation.mutate(action.status)}
                    disabled={statusMutation.isPending}
                  >
                    {action.label}
                  </Button>
                ))}
              {canConvertToProforma && (
                <Button asChild variant="secondary">
                  <Link href={`/invoices/new?from=${invoice.id}&type=proforma`}>Convert to proforma</Link>
                </Button>
              )}
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

      {isQuotation && (
        <Dialog open={validityOpen} onOpenChange={(open) => !open && setValidityOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{quotationStatus === "expired" ? "Renew quotation" : "Finalize quotation"}</DialogTitle>
              <DialogDescription>
                {quotationStatus === "expired"
                  ? "This quotation expired. Choose a new validity date to move it back to Pending."
                  : "Set a validity date to send this quotation to the customer as Pending."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validity_date">Valid until</Label>
              <Input
                id="validity_date"
                type="date"
                value={validityDate}
                onChange={(e) => setValidityDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="button" onClick={submitValidityDate} disabled={!validityDate || quotationStatusMutation.isPending}>
                {quotationStatusMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
