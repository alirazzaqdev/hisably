"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { accountsApi } from "@/lib/api/accounts";
import { customersApi } from "@/lib/api/customers";
import { paymentsApi, type PaymentInput, type PaymentMethod } from "@/lib/api/payments";
import { createOrQueue } from "@/lib/offline/sync-engine";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });
  const { data: receivables } = useQuery({
    queryKey: ["receivables"],
    queryFn: () => paymentsApi.receivables(),
  });
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list(),
  });

  const [customerId, setCustomerId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState(todayIso());
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const customerReceivables = useMemo(
    () => receivables?.filter((r) => r.customer_id === customerId) ?? [],
    [receivables, customerId]
  );

  function toggleAllocation(invoiceId: string, balance: string, checked: boolean) {
    setAllocations((prev) => {
      const next = { ...prev };
      if (checked) {
        next[invoiceId] = balance;
      } else {
        delete next[invoiceId];
      }
      return next;
    });
  }

  function updateAllocation(invoiceId: string, value: string) {
    setAllocations((prev) => ({ ...prev, [invoiceId]: value }));
  }

  const allocatedTotal = Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: PaymentInput = {
        customer_id: customerId || null,
        account_id: accountId || null,
        amount,
        method,
        reference_no: referenceNo || null,
        payment_date: paymentDate,
        notes: notes || null,
        cheque_number: method === "cheque" ? chequeNumber || null : null,
        cheque_date: method === "cheque" ? chequeDate || null : null,
        allocations: Object.entries(allocations)
          .filter(([, value]) => Number(value) > 0)
          .map(([invoice_id, value]) => ({ invoice_id, amount: value })),
      };
      return createOrQueue("payment", payload, paymentsApi.create);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push("/payments");
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Record payment</CardTitle>
        <CardDescription>Record a payment received from a customer and allocate it to invoices.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer">Customer</Label>
              <Select
                id="customer"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setAllocations({});
                }}
              >
                <option value="">No customer</option>
                {customers?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="method">Method</Label>
              <Select id="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account">Account</Label>
              <Select id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">No account</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment_date">Payment date</Label>
              <Input
                id="payment_date"
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="reference_no">Reference no.</Label>
              <Input id="reference_no" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </div>
            {method === "cheque" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cheque_number">Cheque number</Label>
                  <Input
                    id="cheque_number"
                    required
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cheque_date">Cheque date</Label>
                  <Input
                    id="cheque_date"
                    type="date"
                    required
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {customerId && (
            <div className="flex flex-col gap-2">
              <Label>Allocate to invoices</Label>
              {customerReceivables.length === 0 && (
                <p className="text-body-sm text-muted-foreground">No outstanding invoices for this customer.</p>
              )}
              {customerReceivables.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-left text-body-sm">
                    <thead className="border-b border-border bg-muted text-caption text-muted-foreground">
                      <tr>
                        <th className="w-10 px-3 py-2" />
                        <th className="px-3 py-2 font-medium">Invoice</th>
                        <th className="px-3 py-2 text-right font-medium">Balance due</th>
                        <th className="w-32 px-3 py-2 text-right font-medium">Allocate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerReceivables.map((r) => {
                        const checked = r.invoice_id in allocations;
                        return (
                          <tr key={r.invoice_id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleAllocation(r.invoice_id, r.balance_due, e.target.checked)}
                              />
                            </td>
                            <td className="px-3 py-2">{r.invoice_number ?? r.draft_number}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {r.currency} {r.balance_due}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={!checked}
                                value={allocations[r.invoice_id] ?? ""}
                                onChange={(e) => updateAllocation(r.invoice_id, e.target.value)}
                                className="text-right"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-body-sm text-muted-foreground">Allocated total: {allocatedTotal.toFixed(2)}</p>
            </div>
          )}

          <FormError>{formError}</FormError>

          <div className="flex gap-3">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/payments")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
