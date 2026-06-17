"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { reportsApi } from "@/lib/api/reports";
import { tenantsApi } from "@/lib/api/tenants";
import { downloadCsv } from "@/lib/csv";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yearStartIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export default function ProfitLossPage() {
  const [dateFrom, setDateFrom] = useState(yearStartIso());
  const [dateTo, setDateTo] = useState(todayIso());

  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: pl, isLoading } = useQuery({
    queryKey: ["reports", "profit-loss", dateFrom, dateTo],
    queryFn: () => reportsApi.profitLoss({ dateFrom, dateTo }),
  });

  const currency = tenant?.currency ?? "AED";

  function exportCsv() {
    if (!pl) return;
    downloadCsv(`profit-loss-${dateFrom}-to-${dateTo}.csv`, [
      ["Sales revenue", pl.sales_revenue],
      ["Sales returns", pl.sales_returns],
      ["Net revenue", pl.net_revenue],
      ["Cost of goods sold", pl.cost_of_goods_sold],
      ["Gross profit", pl.gross_profit],
      [],
      ["Expenses by category"],
      ...pl.expenses_by_category.map((expense) => [expense.category, expense.amount]),
      ["Total expenses", pl.total_expenses],
      [],
      ["Net profit", pl.net_profit],
    ]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/reports" className="text-body-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Back to reports
          </Link>
          <h1 className="mt-2 text-h1 text-foreground">Profit &amp; Loss</h1>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={!pl}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <span className="text-body-sm font-medium text-foreground">Period</span>
        <Input id="date_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36 text-body-sm" />
        <span className="text-body-sm text-muted-foreground">to</span>
        <Input id="date_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36 text-body-sm" />
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Income statement</CardTitle>
          <CardDescription>Revenue, cost of goods sold, and expenses for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-body-sm text-muted-foreground">Loading…</p>}
          {pl && (
            <div className="flex flex-col gap-2 text-body-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sales revenue</span>
                <span className="tabular-nums">
                  {currency} {pl.sales_revenue}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sales returns</span>
                <span className="tabular-nums">
                  ({currency} {pl.sales_returns})
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
                <span>Net revenue</span>
                <span className="tabular-nums">
                  {currency} {pl.net_revenue}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cost of goods sold</span>
                <span className="tabular-nums">
                  ({currency} {pl.cost_of_goods_sold})
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
                <span>Gross profit</span>
                <span className="tabular-nums">
                  {currency} {pl.gross_profit}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-1">
                <span className="font-medium text-foreground">Expenses</span>
                {pl.expenses_by_category.length === 0 && (
                  <span className="text-muted-foreground">No expenses recorded.</span>
                )}
                {pl.expenses_by_category.map((expense) => (
                  <div key={expense.category} className="flex items-center justify-between pl-2">
                    <span className="text-muted-foreground">{expense.category}</span>
                    <span className="tabular-nums">
                      {currency} {expense.amount}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
                <span>Total expenses</span>
                <span className="tabular-nums">
                  ({currency} {pl.total_expenses})
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-2 text-h3 font-semibold text-foreground">
                <span>Net profit</span>
                <span className="tabular-nums">
                  {currency} {pl.net_profit}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
