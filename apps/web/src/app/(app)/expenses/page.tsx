"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip, Plus, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { expensesApi } from "@/lib/api/expenses";

export default function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["expenses", { search, category, dateFrom, dateTo }],
    queryFn: () =>
      expensesApi.list({
        search: search || undefined,
        category: category || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        pageSize: 50,
      }),
  });

  const { data: allExpenses } = useQuery({
    queryKey: ["expenses", "categories"],
    queryFn: () => expensesApi.list({ pageSize: 100 }),
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    allExpenses?.items.forEach((e) => set.add(e.category));
    return Array.from(set).sort();
  }, [allExpenses]);

  const totalAmount = data?.items.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;
  const totalVat = data?.items.reduce((sum, e) => sum + Number(e.vat_paid), 0) ?? 0;

  const hasFilters = Boolean(search || category || dateFrom || dateTo);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expenses"
        description="Track business expenses, VAT paid, and receipts."
        action={
          <Button asChild>
            <Link href="/expenses/new">
              <Plus className="h-4 w-4" />
              Add expense
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search category or notes"
            className="pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-body-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:max-w-[180px]"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="sm:max-w-[160px]"
          aria-label="From date"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="sm:max-w-[160px]"
          aria-label="To date"
        />
      </div>

      {isLoading && <div className="py-12 text-center text-body text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="py-12 text-center text-body text-danger-500">Something went wrong. Please try again.</div>
      )}

      {!isLoading && !isError && data?.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <Receipt className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-body font-medium text-foreground">
              {hasFilters ? "No expenses match these filters" : "No expenses recorded yet"}
            </p>
            <p className="text-body-sm text-muted-foreground">
              {hasFilters ? "Try adjusting your search or date range." : "Add an expense to start tracking spending."}
            </p>
          </div>
          {!hasFilters && (
            <Button asChild>
              <Link href="/expenses/new">
                <Plus className="h-4 w-4" />
                Add expense
              </Link>
            </Button>
          )}
        </div>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
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
                {data.items.map((expense) => (
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
              <tfoot>
                <tr className="border-t border-border bg-muted/50 font-medium">
                  <td className="px-4 py-3" colSpan={3}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{totalVat.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totalAmount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {data.items.map((expense) => (
              <Link
                key={expense.id}
                href={`/expenses/${expense.id}/edit`}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      {expense.category}
                      {expense.attachment_id && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                    </p>
                    <p className="text-body-sm text-muted-foreground">{expense.expense_date}</p>
                  </div>
                  <p className="text-body font-medium tabular-nums text-foreground">{expense.amount}</p>
                </div>
                {expense.notes && <p className="text-body-sm text-muted-foreground">{expense.notes}</p>}
                <p className="text-body-sm text-muted-foreground">VAT paid: {expense.vat_paid}</p>
              </Link>
            ))}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4 font-medium">
              <span className="text-body text-foreground">Total</span>
              <div className="text-right">
                <p className="tabular-nums text-foreground">{totalAmount.toFixed(2)}</p>
                <p className="text-body-sm tabular-nums text-muted-foreground">VAT: {totalVat.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
