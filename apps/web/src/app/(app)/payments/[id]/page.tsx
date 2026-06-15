"use client";

import { useEffect, useState } from "react";
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
