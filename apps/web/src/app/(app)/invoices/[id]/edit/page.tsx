"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoicesApi } from "@/lib/api/invoices";
import { InvoiceForm } from "../../invoice-form";

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoices", id],
    queryFn: () => invoicesApi.get(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-foreground">Edit invoice</h1>
      {isLoading && <p className="text-body text-muted-foreground">Loading…</p>}
      {invoice && <InvoiceForm invoice={invoice} />}
    </div>
  );
}
