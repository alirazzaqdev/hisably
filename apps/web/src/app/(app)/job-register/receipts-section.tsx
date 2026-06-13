"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { customersApi } from "@/lib/api/customers";
import { jobRegisterApi, type JobReceiptInput } from "@/lib/api/job-register";
import { createOrQueue } from "@/lib/offline/sync-engine";

function emptyForm(): JobReceiptInput {
  return {
    customer_id: null,
    company_text: "",
    amount: "",
    receipt_date: new Date().toISOString().slice(0, 10),
    note: "",
  };
}

export function ReceiptsSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<JobReceiptInput>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const { data: receipts, isLoading, isError } = useQuery({
    queryKey: ["job-register", "receipts"],
    queryFn: () => jobRegisterApi.listReceipts(),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });

  function update<K extends keyof JobReceiptInput>(key: K, value: JobReceiptInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const createMutation = useMutation({
    mutationFn: () => createOrQueue("job_receipt", form, jobRegisterApi.createReceipt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-register", "receipts"] });
      queryClient.invalidateQueries({ queryKey: ["job-register", "summary"] });
      setForm(emptyForm());
      setShowForm(false);
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
    mutationFn: (id: string) => jobRegisterApi.removeReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-register", "receipts"] });
      queryClient.invalidateQueries({ queryKey: ["job-register", "summary"] });
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    createMutation.mutate();
  }

  const total = receipts?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payment Receipts Log</CardTitle>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          Add receipt
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showForm && (
          <form className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="receipt_customer">Company (customer)</Label>
                <Select
                  id="receipt_customer"
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
                <Label htmlFor="receipt_company_text">Company (free text)</Label>
                <Input
                  id="receipt_company_text"
                  value={form.company_text ?? ""}
                  onChange={(e) => update("company_text", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="receipt_amount">Amount</Label>
                <Input
                  id="receipt_amount"
                  type="number"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => update("amount", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="receipt_date">Date</Label>
                <Input
                  id="receipt_date"
                  type="date"
                  required
                  value={form.receipt_date}
                  onChange={(e) => update("receipt_date", e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="receipt_note">Note</Label>
              <Input id="receipt_note" value={form.note ?? ""} onChange={(e) => update("note", e.target.value)} />
            </div>
            <FormError>{formError}</FormError>
            <div className="flex gap-3">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving…" : "Save receipt"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {isLoading && <div className="py-8 text-center text-body text-muted-foreground">Loading…</div>}
        {isError && (
          <div className="py-8 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
        )}
        {!isLoading && !isError && (receipts?.length ?? 0) === 0 && (
          <div className="py-8 text-center text-body text-muted-foreground">No receipts recorded yet.</div>
        )}

        {!isLoading && !isError && receipts && receipts.length > 0 && (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden overflow-hidden rounded-lg border border-border md:block">
              <table className="w-full text-left text-body">
                <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 text-muted-foreground">{receipt.receipt_date}</td>
                      <td className="px-4 py-3">
                        {customers?.items.find((c) => c.id === receipt.customer_id)?.name ?? receipt.company_text ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{receipt.note ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{receipt.amount}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(receipt.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/50 font-medium">
                    <td className="px-4 py-3" colSpan={3}>
                      Total received
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{total.toFixed(2)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-3 md:hidden">
              {receipts.map((receipt) => (
                <div key={receipt.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">
                        {customers?.items.find((c) => c.id === receipt.customer_id)?.name ?? receipt.company_text ?? "—"}
                      </p>
                      <p className="text-body-sm text-muted-foreground">{receipt.receipt_date}</p>
                      {receipt.note && <p className="text-body-sm text-muted-foreground">{receipt.note}</p>}
                    </div>
                    <p className="text-body font-medium tabular-nums text-foreground">{receipt.amount}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-start"
                    onClick={() => deleteMutation.mutate(receipt.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4 font-medium">
                <span className="text-body text-foreground">Total received</span>
                <span className="tabular-nums text-foreground">{total.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
