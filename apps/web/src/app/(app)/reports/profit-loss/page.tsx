"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reportsApi } from "@/lib/api/reports";
import { tenantsApi } from "@/lib/api/tenants";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ProfitLossPage() {
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());

  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: pl, isLoading } = useQuery({
    queryKey: ["reports", "profit-loss", dateFrom, dateTo],
    queryFn: () => reportsApi.profitLoss({ dateFrom, dateTo }),
  });

  const currency = tenant?.currency ?? "AED";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/reports" className="text-body-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 inline h-4 w-4" />
          Back to reports
        </Link>
        <h1 className="mt-2 text-h1 text-foreground">Profit &amp; Loss</h1>
      </div>

      <Card className="max-w-md">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date_from">From</Label>
            <Input id="date_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date_to">To</Label>
            <Input id="date_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

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
