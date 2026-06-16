import { Suspense } from "react";
import { InvoiceForm } from "../../invoices/invoice-form";

export default function NewQuotationPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">New quotation</h1>
      <Suspense fallback={<p className="text-body text-muted-foreground">Loading…</p>}>
        <InvoiceForm defaultType="quotation" />
      </Suspense>
    </div>
  );
}
