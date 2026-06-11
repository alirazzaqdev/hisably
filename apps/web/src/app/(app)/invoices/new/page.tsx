import { Suspense } from "react";
import { InvoiceForm } from "../invoice-form";

export default function NewInvoicePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">New invoice</h1>
      <Suspense fallback={<p className="text-body text-muted-foreground">Loading…</p>}>
        <InvoiceForm />
      </Suspense>
    </div>
  );
}
