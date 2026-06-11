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

const TYPE_LABELS: Record<string, string> = {
  tax_invoice: "Sale invoice",
  credit_note: "Credit note",
  debit_note: "Debit note",
  purchase_bill: "Purchase bill",
  payment: "Payment",
  expense: "Expense",
};

export default function DayBookPage() {
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());

  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: dayBook, isLoading } = useQuery({
    queryKey: ["reports", "day-book", dateFrom, dateTo],
    queryFn: () => reportsApi.dayBook({ dateFrom, dateTo }),
  });

  const currency = tenant?.currency ?? "AED";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/reports" className="text-body-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 inline h-4 w-4" />
          Back to reports
        </Link>
        <h1 className="mt-2 text-h1 text-foreground">Day book</h1>
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

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>All sales, purchases, payments, and expenses for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border bg-muted text-caption text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">Party</th>
                  <th className="px-3 py-2 text-right font-medium">In</th>
                  <th className="px-3 py-2 text-right font-medium">Out</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-3 py-4 text-center text-muted-foreground" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading && (!dayBook || dayBook.entries.length === 0) && (
                  <tr>
                    <td className="px-3 py-4 text-center text-muted-foreground" colSpan={6}>
                      No transactions for this period.
                    </td>
                  </tr>
                )}
                {dayBook?.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{entry.entry_date}</td>
                    <td className="px-3 py-2">{TYPE_LABELS[entry.type] ?? entry.type}</td>
                    <td className="px-3 py-2">{entry.reference}</td>
                    <td className="px-3 py-2">{entry.party_name ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {entry.direction === "in" ? entry.amount : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {entry.direction === "out" ? entry.amount : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
              {dayBook && dayBook.entries.length > 0 && (
                <tfoot className="border-t border-border bg-muted font-semibold text-foreground">
                  <tr>
                    <td className="px-3 py-2" colSpan={4}>
                      Total ({currency})
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{dayBook.total_in}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{dayBook.total_out}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
