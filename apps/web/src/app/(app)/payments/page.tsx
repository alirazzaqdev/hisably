"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customersApi } from "@/lib/api/customers";
import { Badge } from "@/components/ui/badge";
import { paymentsApi, type ChequeStatus } from "@/lib/api/payments";
import { InvoiceStatusBadge } from "../invoices/status-badge";

const TABS = [
  { value: "history", label: "Payment history" },
  { value: "receivables", label: "Receivables" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>("history");
  const queryClient = useQueryClient();

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => paymentsApi.list({ pageSize: 50 }),
  });
  const { data: receivables, isLoading: receivablesLoading } = useQuery({
    queryKey: ["receivables"],
    queryFn: () => paymentsApi.receivables(),
    enabled: tab === "receivables",
  });
  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });

  const customerName = (id: string | null) => customers?.items.find((c) => c.id === id)?.name ?? "—";

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const chequeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ChequeStatus }) => paymentsApi.setChequeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-foreground">Payments</h1>
        <Button asChild>
          <Link href="/payments/new">
            <Plus className="h-4 w-4" />
            Record payment
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`border-b-2 px-3 py-2 text-body-sm font-medium transition-colors ${
              tab === t.value
                ? "border-accent-600 text-accent-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "history" && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-body">
            <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Cheque</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {paymentsLoading && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                    Loading…
                  </td>
                </tr>
              )}
              {!paymentsLoading && payments?.items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                    No payments recorded yet.
                  </td>
                </tr>
              )}
              {payments?.items.map((payment) => (
                <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3 text-muted-foreground">{payment.payment_date}</td>
                  <td className="px-4 py-3">{customerName(payment.customer_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{payment.method.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{payment.reference_no ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {payment.method === "cheque" ? (
                      <div className="flex flex-col gap-1">
                        <span>
                          {payment.cheque_number} · {payment.cheque_date}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              payment.cheque_status === "cleared"
                                ? "success"
                                : payment.cheque_status === "bounced"
                                  ? "danger"
                                  : "neutral"
                            }
                            className="capitalize"
                          >
                            {payment.cheque_status}
                          </Badge>
                          {payment.cheque_status === "pending" && (
                            <>
                              <button
                                className="text-caption text-accent-700 hover:underline"
                                onClick={() => chequeStatusMutation.mutate({ id: payment.id, status: "cleared" })}
                                disabled={chequeStatusMutation.isPending}
                              >
                                Mark cleared
                              </button>
                              <button
                                className="text-caption text-danger-500 hover:underline"
                                onClick={() => chequeStatusMutation.mutate({ id: payment.id, status: "bounced" })}
                                disabled={chequeStatusMutation.isPending}
                              >
                                Mark bounced
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{payment.amount}</td>
                  <td className="px-2 py-3 text-center">
                    <button
                      onClick={() => deleteMutation.mutate(payment.id)}
                      disabled={deleteMutation.isPending}
                      className="text-muted-foreground hover:text-danger-500"
                      aria-label="Delete payment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "receivables" && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-body">
            <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Due date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Balance due</th>
              </tr>
            </thead>
            <tbody>
              {receivablesLoading && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                    Loading…
                  </td>
                </tr>
              )}
              {!receivablesLoading && receivables?.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                    No outstanding invoices.
                  </td>
                </tr>
              )}
              {receivables?.map((r) => (
                <tr key={r.invoice_id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${r.invoice_id}`} className="font-medium text-foreground hover:text-accent-700">
                      {r.invoice_number ?? r.draft_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{customerName(r.customer_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.due_date ?? "—"}</td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.currency} {r.grand_total}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {r.currency} {r.balance_due}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
