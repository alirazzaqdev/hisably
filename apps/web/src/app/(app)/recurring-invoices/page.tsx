"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { customersApi } from "@/lib/api/customers";
import { recurringInvoicesApi, type RecurrenceFrequency } from "@/lib/api/recurring-invoices";
import { TableErrorRow, TableStateRow } from "@/components/ui/table-state";

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
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-foreground">Recurring invoices</h1>
        <Button asChild>
          <Link href="/recurring-invoices/new">
            <Plus className="h-4 w-4" />
            New recurring invoice
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
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
            {isLoading && <TableStateRow colSpan={7}>Loading…</TableStateRow>}
            {isError && <TableErrorRow colSpan={7} />}
            {!isLoading && !isError && data?.items.length === 0 && (
              <TableStateRow colSpan={7}>No recurring invoices set up yet.</TableStateRow>
            )}
            {data?.items.map((recurring) => (
              <tr key={recurring.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">{customerName(recurring.customer_id)}</td>
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
    </div>
  );
}
