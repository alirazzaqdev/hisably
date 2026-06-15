"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError, FormSuccess } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { accountsApi } from "@/lib/api/accounts";
import { customersApi } from "@/lib/api/customers";
import { invoicesApi } from "@/lib/api/invoices";
import { paymentsApi, type PaymentMethod, type PaymentUpdateInput } from "@/lib/api/payments";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export default function PaymentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: payment, isLoading } = useQuery({
    queryKey: ["payments", id],
    queryFn: () => paymentsApi.get(id),
  });
  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list(),
  });
  const { data: invoices } = useQuery({
    queryKey: ["invoices", "all"],
    queryFn: () => invoicesApi.list({ pageSize: 100 }),
  });
  const { data: receivables } = useQuery({
    queryKey: ["receivables"],
    queryFn: () => paymentsApi.receivables(),
  });

  const [accountId, setAccountId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [newAllocations, setNewAllocations] = useState<Record<string, string>>({});
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationSuccess, setAllocationSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!payment) return;
    setAccountId(payment.account_id ?? "");
    setMethod(payment.method);
    setReferenceNo(payment.reference_no ?? "");
    setPaymentDate(payment.payment_date);
    setNotes(payment.notes ?? "");
    setChequeNumber(payment.cheque_number ?? "");
    setChequeDate(payment.cheque_date ?? "");
  }, [payment]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["payments", id] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["receivables"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: PaymentUpdateInput = {
        account_id: accountId || null,
        method,
        reference_no: referenceNo || null,
        payment_date: paymentDate,
        notes: notes || null,
        cheque_number: method === "cheque" ? chequeNumber || null : null,
        cheque_date: method === "cheque" ? chequeDate || null : null,
      };
      return paymentsApi.update(id, payload);
    },
    onSuccess: () => {
      setFormError(null);
      setFormSuccess("Payment updated.");
      invalidate();
    },
    onError: (error) => {
      setFormSuccess(null);
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  const voidMutation = useMutation({
    mutationFn: () => paymentsApi.void(id, voidReason),
    onSuccess: () => {
      setFormError(null);
      invalidate();
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  const allocateMutation = useMutation({
    mutationFn: () =>
      paymentsApi.addAllocations(
        id,
        Object.entries(newAllocations)
          .filter(([, amount]) => Number(amount) > 0)
          .map(([invoice_id, amount]) => ({ invoice_id, amount }))
      ),
    onSuccess: () => {
      setAllocationError(null);
      setAllocationSuccess("Allocation saved.");
      setNewAllocations({});
      invalidate();
    },
    onError: (error) => {
      setAllocationSuccess(null);
      if (error instanceof ApiError && typeof error.detail === "string") {
        setAllocationError(error.detail);
        return;
      }
      setAllocationError("Something went wrong. Please try again.");
    },
  });

  function toggleAllocation(invoiceId: string, balance: string, checked: boolean) {
    setNewAllocations((prev) => {
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
    setNewAllocations((prev) => ({ ...prev, [invoiceId]: value }));
  }

  function handleAllocate(event: React.FormEvent) {
    event.preventDefault();
    setAllocationError(null);
    setAllocationSuccess(null);
    const total = Object.values(newAllocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
    if (total <= 0) {
      setAllocationError("Enter at least one allocation amount.");
      return;
    }
    allocateMutation.mutate();
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    saveMutation.mutate();
  }

  function handleVoid() {
    if (!voidReason.trim()) {
      setFormError("Please enter a reason for voiding this payment.");
      return;
    }
    if (!window.confirm("Void this payment? This will reverse its effect on the account balance and linked invoices.")) {
      return;
    }
    setFormError(null);
    voidMutation.mutate();
  }

  const customerById = new Map(customers?.items.map((c) => [c.id, c]) ?? []);
  const invoiceById = new Map(invoices?.items.map((inv) => [inv.id, inv]) ?? []);
  const isVoided = !!payment?.voided_at;

  const allocatedTotal = payment?.allocations.reduce((sum, a) => sum + Number(a.amount_allocated), 0) ?? 0;
  const unallocatedAmount = payment ? Number(payment.amount) - allocatedTotal : 0;
  const newAllocationTotal = Object.values(newAllocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const customerReceivables = useMemo(
    () =>
      (receivables ?? []).filter(
        (r) => r.customer_id === payment?.customer_id && !payment?.allocations.some((a) => a.invoice_id === r.invoice_id)
      ),
    [receivables, payment]
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/payments" className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to payments
        </Link>
      </div>

      {isLoading && <p className="text-body text-muted-foreground">Loading…</p>}

      {payment && (
        <>
          <Card className="max-w-2xl">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Payment details</CardTitle>
                {isVoided && <Badge variant="danger">Voided</Badge>}
              </div>
              <CardDescription>
                {payment.customer_id ? customerById.get(payment.customer_id)?.name ?? "Customer" : "On-account receipt"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isVoided && (
                <div className="mb-4 rounded-md border border-danger-500/30 bg-danger-50 p-3 text-body-sm text-danger-500">
                  Voided on {new Date(payment.voided_at as string).toLocaleString()}
                  {payment.void_reason && <> — {payment.void_reason}</>}
                </div>
              )}

              {payment.allocations.length > 0 && (
                <div className="mb-4 flex flex-col gap-2">
                  <Label>Allocated to</Label>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-left text-body-sm">
                      <thead className="border-b border-border bg-muted text-caption text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Invoice</th>
                          <th className="px-3 py-2 text-right font-medium">Allocated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payment.allocations.map((a) => {
                          const inv = invoiceById.get(a.invoice_id);
                          return (
                            <tr key={a.id} className="border-b border-border last:border-0">
                              <td className="px-3 py-2">
                                {inv ? (
                                  <Link href={`/invoices/${a.invoice_id}`} className="text-accent-700 hover:underline">
                                    {inv.invoice_number ?? inv.draft_number}
                                  </Link>
                                ) : (
                                  a.invoice_id.slice(0, 8)
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{a.amount_allocated}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <form className="flex flex-col gap-5" onSubmit={handleSave}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>Amount</Label>
                    <Input value={payment.amount} disabled />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="payment_date">Payment date</Label>
                    <Input
                      id="payment_date"
                      type="date"
                      required
                      disabled={isVoided}
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="method">Method</Label>
                    <Select
                      id="method"
                      disabled={isVoided}
                      value={method}
                      onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="account">Account</Label>
                    <Select id="account" disabled={isVoided} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                      <option value="">No account</option>
                      {accounts?.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="reference_no">Reference no.</Label>
                    <Input
                      id="reference_no"
                      disabled={isVoided}
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                    />
                  </div>
                  {method === "cheque" && (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cheque_number">Cheque number</Label>
                        <Input
                          id="cheque_number"
                          disabled={isVoided}
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cheque_date">Cheque date</Label>
                        <Input
                          id="cheque_date"
                          type="date"
                          disabled={isVoided}
                          value={chequeDate}
                          onChange={(e) => setChequeDate(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input id="notes" disabled={isVoided} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>

                <FormError>{formError}</FormError>
                <FormSuccess>{formSuccess}</FormSuccess>

                {!isVoided && (
                  <div className="flex gap-3">
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? "Saving…" : "Save changes"}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => router.push("/payments")}>
                      Cancel
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {!isVoided && payment.customer_id && unallocatedAmount > 0 && (
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Allocate to invoices</CardTitle>
                <CardDescription>
                  Unallocated balance: {payment.amount} − {allocatedTotal.toFixed(2)} = {unallocatedAmount.toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-3" onSubmit={handleAllocate}>
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
                            const checked = r.invoice_id in newAllocations;
                            const defaultAmount = Math.min(Number(r.balance_due), unallocatedAmount).toFixed(2);
                            return (
                              <tr key={r.invoice_id} className="border-b border-border last:border-0">
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => toggleAllocation(r.invoice_id, defaultAmount, e.target.checked)}
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
                                    value={newAllocations[r.invoice_id] ?? ""}
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
                  <p className="text-body-sm text-muted-foreground">
                    Allocating: {newAllocationTotal.toFixed(2)} of {unallocatedAmount.toFixed(2)} unallocated
                  </p>

                  <FormError>{allocationError}</FormError>
                  <FormSuccess>{allocationSuccess}</FormSuccess>

                  {customerReceivables.length > 0 && (
                    <div>
                      <Button type="submit" disabled={allocateMutation.isPending}>
                        {allocateMutation.isPending ? "Allocating…" : "Allocate"}
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {!isVoided && (
            <Card className="max-w-2xl border-danger-500/30">
              <CardHeader>
                <CardTitle className="text-danger-500">Void payment</CardTitle>
                <CardDescription>
                  Voiding reverses this payment&apos;s effect on the account balance and linked invoice statuses. The
                  record is kept for audit purposes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="void_reason">Reason</Label>
                    <Input
                      id="void_reason"
                      placeholder="e.g. Entered by mistake"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                    />
                  </div>
                  <div>
                    <Button type="button" variant="destructive" onClick={handleVoid} disabled={voidMutation.isPending}>
                      {voidMutation.isPending ? "Voiding…" : "Void payment"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
