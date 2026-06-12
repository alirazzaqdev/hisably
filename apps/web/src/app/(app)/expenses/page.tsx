"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { expensesApi } from "@/lib/api/expenses";
import { TableErrorRow, TableStateRow } from "@/components/ui/table-state";

export default function ExpensesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => expensesApi.list({ pageSize: 50 }),
  });

  const total = data?.items.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-foreground">Expenses</h1>
        <Button asChild>
          <Link href="/expenses/new">
            <Plus className="h-4 w-4" />
            Add expense
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-body">
          <thead className="border-b border-border bg-muted text-body-sm text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 text-right font-medium">VAT paid</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableStateRow colSpan={5}>Loading…</TableStateRow>}
            {isError && <TableErrorRow colSpan={5} />}
            {!isLoading && !isError && data?.items.length === 0 && (
              <TableStateRow colSpan={5}>No expenses recorded yet.</TableStateRow>
            )}
            {data?.items.map((expense) => (
              <tr key={expense.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3 text-muted-foreground">{expense.expense_date}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/expenses/${expense.id}/edit`}
                    className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-accent-700"
                  >
                    {expense.category}
                    {expense.attachment_id && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{expense.notes ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{expense.vat_paid}</td>
                <td className="px-4 py-3 text-right tabular-nums">{expense.amount}</td>
              </tr>
            ))}
          </tbody>
          {data && data.items.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-muted/50 font-medium">
                <td className="px-4 py-3" colSpan={4}>
                  Total
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
