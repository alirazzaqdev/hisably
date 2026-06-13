"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { customersApi } from "@/lib/api/customers";
import { recurringInvoicesApi, type RecurrenceFrequency } from "@/lib/api/recurring-invoices";

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export default function RecurringInvoicesPage() {
  const queryClient = useQueryClient();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["recurring-invoices"],
    queryFn: () => recurringInvoicesApi.list({ pageSize: 50 }),
  });
  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });

  const customerName = (id: string | null) => customers?.items.find((c) => c.id === id)?.name ?? "—";

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      recurringInvoicesApi.update(id, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recurringInvoicesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] }),
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => recurringInvoicesApi.generateNow(id),
    onMutate: (id) => setGeneratingId(id),
    onSettled: () => setGeneratingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recurring invoices"
        description="Automatically generate invoices on a schedule."
        action={
          <Button asChild>
            <Link href="/recurring-invoices/new">
              <Plus className="h-4 w-4" />
              New recurring invoice
            </Link>
          </Button>
        }
      />

      {isLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
      )}

      {!isLoading && !isError && data?.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <Repeat className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-body font-medium text-foreground">No recurring invoices yet</p>
            <p className="text-body-sm text-muted-foreground">
              Set up a schedule to automatically generate invoices for repeat customers.
            </p>
          </div>
          <Button asChild>
            <Link href="/recurring-invoices/new">
              <Plus className="h-4 w-4" />
              New recurring invoice
            </Link>
          </Button>
        </div>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
            <table className="w-full text-left text-body">
              <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Frequency</th>
                  <th className="px-4 py-3 font-medium">Next run</th>
                  <th className="px-4 py-3 font-medium">End date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((recurring) => (
                  <tr key={recurring.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{customerName(recurring.customer_id)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{FREQUENCY_LABELS[recurring.frequency]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{recurring.next_run_date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{recurring.end_date ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={recurring.is_active ? "success" : "neutral"}>
                        {recurring.is_active ? "Active" : "Paused"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          className="text-caption text-accent-700 hover:underline disabled:opacity-50"
                          onClick={() => generateMutation.mutate(recurring.id)}
                          disabled={!recurring.is_active || generatingId === recurring.id}
                          aria-label={`Generate invoice now for ${customerName(recurring.customer_id)}`}
                        >
                          {generatingId === recurring.id ? "Generating…" : "Generate now"}
                        </button>
                        <button
                          className="text-caption text-muted-foreground hover:underline"
                          onClick={() => toggleMutation.mutate({ id: recurring.id, isActive: !recurring.is_active })}
                          disabled={toggleMutation.isPending}
                          aria-label={
                            recurring.is_active
                              ? `Pause recurring invoice for ${customerName(recurring.customer_id)}`
                              : `Resume recurring invoice for ${customerName(recurring.customer_id)}`
                          }
                        >
                          {recurring.is_active ? "Pause" : "Resume"}
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => deleteMutation.mutate(recurring.id)}
                        disabled={deleteMutation.isPending}
                        className="text-muted-foreground hover:text-danger-500"
                        aria-label="Delete recurring invoice"
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
            {data.items.map((recurring) => (
              <div key={recurring.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{customerName(recurring.customer_id)}</p>
                    <p className="text-body-sm text-muted-foreground">
                      {FREQUENCY_LABELS[recurring.frequency]} · Next: {recurring.next_run_date}
                    </p>
                    {recurring.end_date && (
                      <p className="text-body-sm text-muted-foreground">Ends: {recurring.end_date}</p>
                    )}
                  </div>
                  <Badge variant={recurring.is_active ? "success" : "neutral"}>
                    {recurring.is_active ? "Active" : "Paused"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-4">
                    <button
                      className="text-body-sm font-medium text-accent-700 hover:underline disabled:opacity-50"
                      onClick={() => generateMutation.mutate(recurring.id)}
                      disabled={!recurring.is_active || generatingId === recurring.id}
                      aria-label={`Generate invoice now for ${customerName(recurring.customer_id)}`}
                    >
                      {generatingId === recurring.id ? "Generating…" : "Generate now"}
                    </button>
                    <button
                      className="text-body-sm text-muted-foreground hover:underline"
                      onClick={() => toggleMutation.mutate({ id: recurring.id, isActive: !recurring.is_active })}
                      disabled={toggleMutation.isPending}
                      aria-label={
                        recurring.is_active
                          ? `Pause recurring invoice for ${customerName(recurring.customer_id)}`
                          : `Resume recurring invoice for ${customerName(recurring.customer_id)}`
                      }
                    >
                      {recurring.is_active ? "Pause" : "Resume"}
                    </button>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(recurring.id)}
                    disabled={deleteMutation.isPending}
                    className="text-muted-foreground hover:text-danger-500"
                    aria-label="Delete recurring invoice"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
