"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Mail, MessageCircle, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { accountsApi } from "@/lib/api/accounts";
import { customersApi } from "@/lib/api/customers";
import { invoicesApi } from "@/lib/api/invoices";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { paymentsApi, type ChequeStatus, type PaymentMethod, type Receivable } from "@/lib/api/payments";
import { InvoiceStatusBadge } from "../invoices/status-badge";

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

const TABS = [
  { value: "history", label: "Payment history" },
  { value: "receivables", label: "Receivables" },
] as const;

type Tab = (typeof TABS)[number]["value"];

function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9+]/g, "").replace(/^00/, "+");
  return `https://wa.me/${digits.replace("+", "")}?text=${encodeURIComponent(message)}`;
}

function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

interface AgingBuckets {
  current: number;
  d1_30: number;
  d31_60: number;
  d60_plus: number;
}

interface CustomerAging {
  customerId: string;
  buckets: AgingBuckets;
  total: number;
  currency: string;
  invoiceCount: number;
}

function agingByCustomer(receivables: Receivable[]): CustomerAging[] {
  const today = new Date();
  const byCustomer = new Map<string, CustomerAging>();

  for (const r of receivables) {
    if (!r.customer_id) continue;
    const balance = Number(r.balance_due);
    if (balance <= 0) continue;

    let entry = byCustomer.get(r.customer_id);
    if (!entry) {
      entry = {
        customerId: r.customer_id,
        buckets: { current: 0, d1_30: 0, d31_60: 0, d60_plus: 0 },
        total: 0,
        currency: r.currency,
        invoiceCount: 0,
      };
      byCustomer.set(r.customer_id, entry);
    }

    let bucket: keyof AgingBuckets = "current";
    if (r.due_date) {
      const dueDate = new Date(r.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 60) bucket = "d60_plus";
      else if (daysOverdue > 30) bucket = "d31_60";
      else if (daysOverdue > 0) bucket = "d1_30";
    }

    entry.buckets[bucket] += balance;
    entry.total += balance;
    entry.invoiceCount += 1;
  }

  return Array.from(byCustomer.values()).sort((a, b) => b.total - a.total);
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

  const [customerFilter, setCustomerFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const filters = {
    customerId: customerFilter || undefined,
    accountId: accountFilter || undefined,
    method: methodFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: search || undefined,
  };

  const { data: payments, isLoading: paymentsLoading, isError: paymentsError } = useQuery({
    queryKey: ["payments", filters],
    queryFn: () => paymentsApi.list({ ...filters, pageSize: 50 }),
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
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list(),
  });
  const { data: invoices } = useQuery({
    queryKey: ["invoices", "all"],
    queryFn: () => invoicesApi.list({ pageSize: 100 }),
  });

  const customerById = useMemo(
    () => new Map(customers?.items.map((c) => [c.id, c]) ?? []),
    [customers]
  );
  const customerName = (id: string | null) => customerById.get(id ?? "")?.name ?? "—";

  const accountById = useMemo(() => new Map(accounts?.map((a) => [a.id, a]) ?? []), [accounts]);
  const accountName = (id: string | null) => accountById.get(id ?? "")?.name ?? "—";

  const invoiceById = useMemo(
    () => new Map(invoices?.items.map((inv) => [inv.id, inv]) ?? []),
    [invoices]
  );
  const documentLabel = (allocations: { invoice_id: string }[]) => {
    if (allocations.length === 0) return "—";
    return allocations
      .map((a) => {
        const inv = invoiceById.get(a.invoice_id);
        return inv ? inv.invoice_number ?? inv.draft_number : a.invoice_id.slice(0, 8);
      })
      .join(", ");
  };

  const sortedReceivables = useMemo(() => (receivables ? sortReceivables(receivables) : []), [receivables]);
  const totalOutstanding = useMemo(
    () => sortedReceivables.reduce((sum, r) => sum + Number(r.balance_due), 0),
    [sortedReceivables]
  );
  const overdueCount = sortedReceivables.filter((r) => r.status === "overdue").length;
  const customerAgings = useMemo(() => agingByCustomer(sortedReceivables), [sortedReceivables]);

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
          <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-customer">Customer</Label>
              <Select id="filter-customer" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
                <option value="">All customers</option>
                {customers?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-account">Account</Label>
              <Select id="filter-account" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                <option value="">All accounts</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-method">Method</Label>
              <Select
                id="filter-method"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | "")}
              >
                <option value="">All methods</option>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-date-from">From</Label>
              <Input id="filter-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-date-to">To</Label>
              <Input id="filter-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-search">Reference search</Label>
              <Input
                id="filter-search"
                placeholder="Search reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {paymentsLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
          {paymentsError && (
            <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
          )}
          {!paymentsLoading && !paymentsError && payments?.items.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-body font-medium text-foreground">No payments found</p>
                <p className="text-body-sm text-muted-foreground">
                  Record a payment or adjust your filters to see results here.
                </p>
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
                      <th className="px-4 py-3 font-medium">Document</th>
                      <th className="px-4 py-3 font-medium">Method</th>
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium">Account</th>
                      <th className="px-4 py-3 font-medium">Cheque</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="w-10 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {payments.items.map((payment) => (
                      <tr
                        key={payment.id}
                        className={`border-b border-border last:border-0 hover:bg-muted/50 ${payment.voided_at ? "opacity-60" : ""}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground">{payment.payment_date}</td>
                        <td className="px-4 py-3">
                          {customerName(payment.customer_id)}
                          {payment.voided_at && (
                            <Badge variant="danger" className="ml-2">
                              Voided
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{documentLabel(payment.allocations)}</td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">{payment.method.replace("_", " ")}</td>
                        <td className="px-4 py-3 text-muted-foreground">{payment.reference_no ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{accountName(payment.account_id)}</td>
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
                          <Link
                            href={`/payments/${payment.id}`}
                            className="text-muted-foreground hover:text-accent-700"
                            aria-label="View payment"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {payments.items.map((payment) => (
                  <div
                    key={payment.id}
                    className={`flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 ${payment.voided_at ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">
                          {customerName(payment.customer_id)}
                          {payment.voided_at && (
                            <Badge variant="danger" className="ml-2">
                              Voided
                            </Badge>
                          )}
                        </p>
                        <p className="text-body-sm text-muted-foreground">
                          {payment.payment_date} · <span className="capitalize">{payment.method.replace("_", " ")}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-body font-medium tabular-nums text-foreground">{payment.amount}</p>
                        <Link
                          href={`/payments/${payment.id}`}
                          className="text-muted-foreground hover:text-accent-700"
                          aria-label="View payment"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                    <p className="text-body-sm text-muted-foreground">
                      {documentLabel(payment.allocations)} · {accountName(payment.account_id)}
                    </p>
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

          {!receivablesLoading && !receivablesError && customerAgings.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <p className="font-medium text-foreground">Receivables by customer (aging)</p>
                <p className="text-body-sm text-muted-foreground">
                  Outstanding balances grouped by how overdue they are, with quick reminders.
                </p>
              </div>
              {/* Desktop / tablet table */}
              <div className="hidden md:block">
                <table className="w-full text-left text-body">
                  <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 text-right font-medium">Current</th>
                      <th className="px-4 py-3 text-right font-medium">1-30 days</th>
                      <th className="px-4 py-3 text-right font-medium">31-60 days</th>
                      <th className="px-4 py-3 text-right font-medium">60+ days</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                      <th className="w-20 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {customerAgings.map((a) => {
                      const customer = customerById.get(a.customerId);
                      const reminderMessage = `Hi ${customer?.name ?? "there"}, this is a reminder that you have an outstanding balance of ${a.currency} ${a.total.toFixed(2)} across ${a.invoiceCount} invoice(s). Please let us know if you have any questions.`;
                      return (
                        <tr key={a.customerId} className="border-b border-border last:border-0 hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium text-foreground">{customer?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{a.buckets.current.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{a.buckets.d1_30.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{a.buckets.d31_60.toFixed(2)}</td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums ${a.buckets.d60_plus > 0 ? "text-danger-500" : ""}`}
                          >
                            {a.buckets.d60_plus.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {a.currency} {a.total.toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {customer?.phone && (
                                <a
                                  href={whatsappLink(customer.phone, reminderMessage)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted-foreground hover:text-success-500"
                                  aria-label={`Send WhatsApp reminder to ${customer.name}`}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </a>
                              )}
                              {customer?.email && (
                                <a
                                  href={mailtoLink(customer.email, "Payment reminder", reminderMessage)}
                                  className="text-muted-foreground hover:text-accent-700"
                                  aria-label={`Send email reminder to ${customer.name}`}
                                >
                                  <Mail className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col gap-3 p-3 md:hidden">
                {customerAgings.map((a) => {
                  const customer = customerById.get(a.customerId);
                  const reminderMessage = `Hi ${customer?.name ?? "there"}, this is a reminder that you have an outstanding balance of ${a.currency} ${a.total.toFixed(2)} across ${a.invoiceCount} invoice(s). Please let us know if you have any questions.`;
                  return (
                    <div key={a.customerId} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground">{customer?.name ?? "—"}</p>
                        <p className="font-medium tabular-nums text-foreground">
                          {a.currency} {a.total.toFixed(2)}
                        </p>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-body-sm text-muted-foreground">
                        <div>
                          <p className="text-caption">Current</p>
                          <p className="tabular-nums text-foreground">{a.buckets.current.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-caption">1-30d</p>
                          <p className="tabular-nums text-foreground">{a.buckets.d1_30.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-caption">31-60d</p>
                          <p className="tabular-nums text-foreground">{a.buckets.d31_60.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-caption">60+d</p>
                          <p className={`tabular-nums ${a.buckets.d60_plus > 0 ? "text-danger-500" : "text-foreground"}`}>
                            {a.buckets.d60_plus.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {(customer?.phone || customer?.email) && (
                        <div className="flex items-center gap-4">
                          {customer?.phone && (
                            <a
                              href={whatsappLink(customer.phone, reminderMessage)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-body-sm font-medium text-success-500"
                            >
                              <MessageCircle className="h-4 w-4" />
                              WhatsApp
                            </a>
                          )}
                          {customer?.email && (
                            <a
                              href={mailtoLink(customer.email, "Payment reminder", reminderMessage)}
                              className="inline-flex items-center gap-1.5 text-body-sm font-medium text-accent-700"
                            >
                              <Mail className="h-4 w-4" />
                              Email
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
