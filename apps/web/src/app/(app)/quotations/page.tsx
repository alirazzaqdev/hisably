"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSignature, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { customersApi } from "@/lib/api/customers";
import type { QuotationStatus } from "@/lib/api/invoices";
import { quotationsApi } from "@/lib/api/quotations";
import { QuotationStatusBadge } from "./status-badge";

const PAGE_SIZE = 20;

const TABS: { value: QuotationStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && typeof error.detail === "string") return error.detail;
  return fallback;
}

export default function QuotationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<QuotationStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewDate, setRenewDate] = useState("");

  const { data: counts } = useQuery({
    queryKey: ["quotation-counts"],
    queryFn: () => quotationsApi.counts(),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["quotations", search, tab, page],
    queryFn: () =>
      quotationsApi.list({
        search: search || undefined,
        status: tab === "all" ? undefined : tab,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });

  const customerName = (id: string | null) => customers?.items.find((c) => c.id === id)?.name ?? "—";

  const statusMutation = useMutation({
    mutationFn: ({ id, status, dueDate }: { id: string; status: QuotationStatus; dueDate?: string }) =>
      quotationsApi.setStatus(id, status, dueDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["quotation-counts"] });
      toast({ title: "Quotation updated", variant: "success" });
      setRenewingId(null);
      setRenewDate("");
    },
    onError: (error) => {
      toast({ title: "Couldn't update quotation", description: errorMessage(error, "Try again."), variant: "danger" });
    },
  });

  function handleTabChange(value: string) {
    setTab(value as QuotationStatus | "all");
    setPage(1);
  }

  function submitRenew() {
    if (!renewingId || !renewDate) return;
    statusMutation.mutate({ id: renewingId, status: "pending", dueDate: renewDate });
  }

  const renewingQuotation = data?.items.find((q) => q.id === renewingId);
  const renewingIsDraft = (renewingQuotation?.effective_quotation_status ?? renewingQuotation?.quotation_status) === "draft";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quotations"
        description="Send rate offers to customers. Convert approved quotations to invoices when work is confirmed."
        action={
          <Button asChild>
            <Link href="/invoices/new?type=quotation">
              <Plus className="h-4 w-4" />
              New quotation
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {counts && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-caption font-medium text-muted-foreground">
                  {t.value === "all" ? counts.total : counts[t.value]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by quotation number"
          className="pl-9"
        />
      </div>

      {isLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
      )}

      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState
          icon={FileSignature}
          title="No quotations yet"
          description={
            search || tab !== "all"
              ? "No quotations match your search or filter."
              : "Create your first quotation to send a rate offer to a customer."
          }
          action={
            <Button asChild>
              <Link href="/invoices/new?type=quotation">
                <Plus className="h-4 w-4" />
                New quotation
              </Link>
            </Button>
          }
        />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
            <table className="w-full text-left text-body">
              <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Quotation #</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Issue date</th>
                  <th className="px-4 py-3 font-medium">Valid until</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((quotation) => {
                  const effectiveStatus = quotation.effective_quotation_status ?? quotation.quotation_status ?? "draft";
                  return (
                    <tr key={quotation.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/invoices/${quotation.id}`}
                          className="font-medium text-foreground hover:text-accent-700"
                        >
                          {quotation.invoice_number ?? quotation.draft_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{customerName(quotation.customer_id)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{quotation.issue_date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{quotation.due_date ?? "—"}</td>
                      <td className="px-4 py-3">
                        <QuotationStatusBadge status={effectiveStatus} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {quotation.currency} {quotation.grand_total}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {effectiveStatus === "draft" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={statusMutation.isPending}
                              onClick={() => {
                                setRenewingId(quotation.id);
                                setRenewDate("");
                              }}
                            >
                              Finalize
                            </Button>
                          )}
                          {effectiveStatus === "pending" && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: quotation.id, status: "approved" })}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: quotation.id, status: "rejected" })}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {effectiveStatus === "expired" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={statusMutation.isPending}
                              onClick={() => {
                                setRenewingId(quotation.id);
                                setRenewDate("");
                              }}
                            >
                              Renew
                            </Button>
                          )}
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/invoices/${quotation.id}`}>View</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {data.items.map((quotation) => {
              const effectiveStatus = quotation.effective_quotation_status ?? quotation.quotation_status ?? "draft";
              return (
                <Link
                  key={quotation.id}
                  href={`/invoices/${quotation.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{quotation.invoice_number ?? quotation.draft_number}</p>
                      <p className="text-body-sm text-muted-foreground">{customerName(quotation.customer_id)}</p>
                    </div>
                    <QuotationStatusBadge status={effectiveStatus} />
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2 text-body-sm">
                    <span className="text-muted-foreground">{quotation.issue_date}</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {quotation.currency} {quotation.grand_total}
                    </span>
                  </div>
                  {(effectiveStatus === "draft" || effectiveStatus === "pending" || effectiveStatus === "expired") && (
                    <div className="flex items-center gap-2 border-t border-border pt-2">
                      {effectiveStatus === "draft" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={statusMutation.isPending}
                          onClick={(e) => {
                            e.preventDefault();
                            setRenewingId(quotation.id);
                            setRenewDate("");
                          }}
                        >
                          Finalize
                        </Button>
                      )}
                      {effectiveStatus === "pending" && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={statusMutation.isPending}
                            onClick={(e) => {
                              e.preventDefault();
                              statusMutation.mutate({ id: quotation.id, status: "approved" });
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={statusMutation.isPending}
                            onClick={(e) => {
                              e.preventDefault();
                              statusMutation.mutate({ id: quotation.id, status: "rejected" });
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {effectiveStatus === "expired" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={statusMutation.isPending}
                          onClick={(e) => {
                            e.preventDefault();
                            setRenewingId(quotation.id);
                            setRenewDate("");
                          }}
                        >
                          Renew
                        </Button>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        </>
      )}

      <Dialog open={renewingId !== null} onOpenChange={(open) => !open && setRenewingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{renewingIsDraft ? "Finalize quotation" : "Renew quotation"}</DialogTitle>
            <DialogDescription>
              {renewingIsDraft
                ? "Set a validity date to send this quotation to the customer as Pending."
                : "This quotation expired. Choose a new validity date to move it back to Pending."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="renew_due_date">Valid until</Label>
            <Input
              id="renew_due_date"
              type="date"
              value={renewDate}
              onChange={(e) => setRenewDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={submitRenew} disabled={!renewDate || statusMutation.isPending}>
              {statusMutation.isPending ? "Renewing…" : "Renew"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
