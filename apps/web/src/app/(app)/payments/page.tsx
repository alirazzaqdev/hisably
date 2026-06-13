"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Plus, Receipt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customersApi } from "@/lib/api/customers";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { paymentsApi, type ChequeStatus, type Receivable } from "@/lib/api/payments";
import { InvoiceStatusBadge } from "../invoices/status-badge";

const TABS = [
  { value: "history", label: "Payment history" },
  { value: "receivables", label: "Receivables" },
] as const;

type Tab = (typeof TABS)[number]["value"];

function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9+]/g, "").replace(/^00/, "+");
  return `https://wa.me/${digits.replace("+", "")}?text=${encodeURIComponent(message)}`;
}

function sortReceivables(receivables: Receivable[]): Receivable[] {
  return [...receivables].sort((a, b) => {
    const aOverdue = a.status === "overdue" ? 0 : 1;
    const bOverdue = b.status === "overdue" ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });
}

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>("history");
  const queryClient = useQueryClient();

  const { data: payments, isLoading: paymentsLoading, isError: paymentsError } = useQuery({
    queryKey: ["payments"],
    queryFn: () => paymentsApi.list({ pageSize: 50 }),
  });
  const { data: receivables, isLoading: receivablesLoading, isError: receivablesError } = useQuery({
    queryKey: ["receivables"],
    queryFn: () => paymentsApi.receivables(),
    enabled: tab === "receivables",
  });
  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });

  const customerById = useMemo(
    () => new Map(customers?.items.map((c) => [c.id, c]) ?? []),
    [customers]
  );
  const customerName = (id: string | null) => customerById.get(id ?? "")?.name ?? "—";

  const sortedReceivables = useMemo(() => (receivables ? sortReceivables(receivables) : []), [receivables]);
  const totalOutstanding = useMemo(
    () => sortedReceivables.reduce((sum, r) => sum + Number(r.balance_due), 0),
    [sortedReceivables]
  );
  const overdueCount = sortedReceivables.filter((r) => r.status === "overdue").length;

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
      <PageHeader
        title="Payments"
        description="Record payments received and track outstanding receivables."
        action={
          <Button asChild>
            <Link href="/payments/new">
              <Plus className="h-4 w-4" />
              Record payment
            </Link>
          </Button>
        }
      />

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
        <>
          {paymentsLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
          {paymentsError && (
            <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
          )}
          {!paymentsLoading && !paymentsError && payments?.items.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-body font-medium text-foreground">No payments recorded yet</p>
                <p className="text-body-sm text-muted-foreground">Record a payment to see it here.</p>
              </div>
              <Button asChild>
                <Link href="/payments/new">
                  <Plus className="h-4 w-4" />
                  Record payment
                </Link>
              </Button>
            </div>
          )}

          {!paymentsLoading && !paymentsError && payments && payments.items.length > 0 && (
            <>
              {/* Desktop / tablet table */}
              <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
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
                    {payments.items.map((payment) => (
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
                                      aria-label={`Mark cheque ${payment.cheque_number} as cleared`}
                                    >
                                      Mark cleared
                                    </button>
                                    <button
                                      className="text-caption text-danger-500 hover:underline"
                                      onClick={() => chequeStatusMutation.mutate({ id: payment.id, status: "bounced" })}
                                      disabled={chequeStatusMutation.isPending}
                                      aria-label={`Mark cheque ${payment.cheque_number} as bounced`}
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

              {/* Mobile cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {payments.items.map((payment) => (
                  <div key={payment.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{customerName(payment.customer_id)}</p>
                        <p className="text-body-sm text-muted-foreground">
                          {payment.payment_date} · <span className="capitalize">{payment.method.replace("_", " ")}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-body font-medium tabular-nums text-foreground">{payment.amount}</p>
                        <button
                          onClick={() => deleteMutation.mutate(payment.id)}
                          disabled={deleteMutation.isPending}
                          className="text-muted-foreground hover:text-danger-500"
                          aria-label="Delete payment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {payment.reference_no && (
                      <p className="text-body-sm text-muted-foreground">Ref: {payment.reference_no}</p>
                    )}
                    {payment.method === "cheque" && (
                      <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
                        <span>
                          {payment.cheque_number} · {payment.cheque_date}
                        </span>
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
                      </div>
                    )}
                    {payment.method === "cheque" && payment.cheque_status === "pending" && (
                      <div className="flex items-center gap-3">
                        <button
                          className="text-body-sm text-accent-700 hover:underline"
                          onClick={() => chequeStatusMutation.mutate({ id: payment.id, status: "cleared" })}
                          disabled={chequeStatusMutation.isPending}
                          aria-label={`Mark cheque ${payment.cheque_number} as cleared`}
                        >
                          Mark cleared
                        </button>
                        <button
                          className="text-body-sm text-danger-500 hover:underline"
                          onClick={() => chequeStatusMutation.mutate({ id: payment.id, status: "bounced" })}
                          disabled={chequeStatusMutation.isPending}
                          aria-label={`Mark cheque ${payment.cheque_number} as bounced`}
                        >
                          Mark bounced
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "receivables" && (
        <>
          {!receivablesLoading && !receivablesError && sortedReceivables.length > 0 && (
            <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="text-body-sm text-muted-foreground">Total outstanding</p>
                <p className="text-h3 tabular-nums text-foreground">{totalOutstanding.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-body-sm text-muted-foreground">Overdue invoices</p>
                <p className={`text-h3 tabular-nums ${overdueCount > 0 ? "text-danger-500" : "text-foreground"}`}>
                  {overdueCount}
                </p>
              </div>
            </div>
          )}

          {receivablesLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
          {receivablesError && (
            <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
          )}
          {!receivablesLoading && !receivablesError && sortedReceivables.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-body font-medium text-foreground">No outstanding invoices</p>
                <p className="text-body-sm text-muted-foreground">Everything has been paid. Nice work.</p>
              </div>
            </div>
          )}

          {!receivablesLoading && !receivablesError && sortedReceivables.length > 0 && (
            <>
              {/* Desktop / tablet table */}
              <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
                <table className="w-full text-left text-body">
                  <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Invoice #</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Due date</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                      <th className="px-4 py-3 text-right font-medium">Balance due</th>
                      <th className="w-10 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReceivables.map((r) => {
                      const customer = customerById.get(r.customer_id ?? "");
                      return (
                        <tr key={r.invoice_id} className="border-b border-border last:border-0 hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <Link href={`/invoices/${r.invoice_id}`} className="font-medium text-foreground hover:text-accent-700">
                              {r.invoice_number ?? r.draft_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{customer?.name ?? "—"}</td>
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
                          <td className="px-2 py-3 text-center">
                            {customer?.phone && (
                              <a
                                href={whatsappLink(
                                  customer.phone,
                                  `Hi ${customer.name}, this is a reminder that invoice ${r.invoice_number ?? r.draft_number} for ${r.currency} ${r.balance_due} is outstanding${r.due_date ? ` (due ${r.due_date})` : ""}. Please let us know if you have any questions.`
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground hover:text-success-500"
                                aria-label={`Send WhatsApp reminder to ${customer.name}`}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {sortedReceivables.map((r) => {
                  const customer = customerById.get(r.customer_id ?? "");
                  return (
                    <div key={r.invoice_id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link href={`/invoices/${r.invoice_id}`} className="font-medium text-foreground hover:text-accent-700">
                            {r.invoice_number ?? r.draft_number}
                          </Link>
                          <p className="text-body-sm text-muted-foreground">{customer?.name ?? "—"}</p>
                        </div>
                        <InvoiceStatusBadge status={r.status} />
                      </div>
                      <div className="flex items-center justify-between text-body-sm">
                        <span className="text-muted-foreground">Due {r.due_date ?? "—"}</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {r.currency} {r.balance_due}
                        </span>
                      </div>
                      {customer?.phone && (
                        <a
                          href={whatsappLink(
                            customer.phone,
                            `Hi ${customer.name}, this is a reminder that invoice ${r.invoice_number ?? r.draft_number} for ${r.currency} ${r.balance_due} is outstanding${r.due_date ? ` (due ${r.due_date})` : ""}. Please let us know if you have any questions.`
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-success-500"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Send WhatsApp reminder
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
